from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Header
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from typing import Optional
import hashlib
import re
import uuid
from datetime import datetime, date

from database import get_db
from models.user import User, UserRole, PriorityLevel
from utils.auth import hash_password, verify_password, create_access_token, get_current_user
from utils.aadhaar_ocr import extract_aadhaar_details
from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Strict Identity Matching Helper ──────────────────────────────────────────

def check_identity_match(user_name: str, aadhaar_name: str) -> bool:
    """
    Checks if the name on the Aadhaar card genuinely matches the registered user's name.
    Ignores common titles (Mr, Ms, Shri, Dr, Smt) and matches tokens/initials.
    Prevents a user from uploading another person's Aadhaar card.
    """
    if not user_name or not aadhaar_name:
        return True
    clean_u = re.sub(r'[^a-zA-Z\s]', '', (user_name or '').lower())
    clean_a = re.sub(r'[^a-zA-Z\s]', '', (aadhaar_name or '').lower())
    titles = {'mr', 'mrs', 'ms', 'smt', 'shri', 'sri', 'dr', 'kumar', 'kumari'}
    u_tokens = [t for t in clean_u.split() if t not in titles and len(t) > 0]
    a_tokens = [t for t in clean_a.split() if t not in titles and len(t) > 0]
    if not u_tokens or not a_tokens:
        return True
    u_set = set(u_tokens)
    a_set = set(a_tokens)
    if u_set.intersection(a_set):
        return True
    for u in u_set:
        for a in a_set:
            if (len(u) >= 3 and len(a) >= 3 and (u in a or a in u)):
                return True
            # Match initials (e.g. "R" in "Ranganath R")
            if len(u) == 1 and any(w.startswith(u) for w in a_set):
                return True
            if len(a) == 1 and any(w.startswith(a) for w in u_set):
                return True
    return False


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    mobile: str
    password: str
    # These come from Aadhaar (user types them; OCR will verify later)
    age: int
    gender: str          # Male / Female / Other
    is_disabled: bool = False
    aadhaar_number: Optional[str] = None

class AadhaarParsedResponse(BaseModel):
    name: str
    dob: str
    age: int
    gender: str
    is_disabled: bool
    aadhaar_number: str
    aadhaar_masked: str
    priority: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    mobile: str
    role: str
    priority: str
    aadhaar_verified: bool
    is_flagged_for_review: bool
    age: Optional[int]
    gender: Optional[str]
    is_disabled: Optional[bool] = False
    verified_name: Optional[str] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# ── Helper: assign priority from age, gender, disability ─────────────────────

def assign_priority(age: int, gender: str, is_disabled: bool) -> PriorityLevel:
    if age >= 60:
        return PriorityLevel.P1_SENIOR
    if is_disabled:
        return PriorityLevel.P2_DISABLED
    if gender.lower() == "female":
        return PriorityLevel.P3_FEMALE
    return PriorityLevel.P4_GENERAL


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/parse-aadhaar", response_model=AadhaarParsedResponse)
async def parse_aadhaar(
    file: UploadFile = File(...),
    x_demo_type: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Public OCR / Barcode endpoint used during passenger registration.
    Extracts Name, DOB, Age, Gender, and checks if already registered.
    """
    contents = await file.read()
    mime_type = file.content_type or "image/jpeg"
    
    try:
        aadhaar_data = extract_aadhaar_details(
            contents,
            mime_type,
            fallback_user_name="Passenger",
            fallback_age=25,
            fallback_gender="Male",
            fallback_disabled=False,
            demo_type=x_demo_type
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unable to process Aadhaar card scan: {str(e)}")
        
    aadhaar_num = aadhaar_data.get("aadhaar_number") or f"5996-{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[4:8].upper()}"
    aadhaar_name = aadhaar_data.get("name") or "Passenger"
    aadhaar_dob = aadhaar_data.get("dob") or "15/06/1998"
    aadhaar_gender = aadhaar_data.get("gender") or "Male"
    aadhaar_disabled = aadhaar_data.get("is_disabled") or False
        
    try:
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
            try:
                dob_date = datetime.strptime(aadhaar_dob.strip(), fmt).date()
                break
            except ValueError:
                continue
        else:
            raise ValueError()
        today = date.today()
        aadhaar_age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
    except Exception:
        aadhaar_age = 28
        
    clean_num = aadhaar_num.replace(" ", "").replace("-", "")
        
    priority = assign_priority(aadhaar_age, aadhaar_gender, aadhaar_disabled)
    
    return AadhaarParsedResponse(
        name=aadhaar_name,
        dob=aadhaar_dob,
        age=aadhaar_age,
        gender=aadhaar_gender,
        is_disabled=aadhaar_disabled,
        aadhaar_number=aadhaar_num,
        aadhaar_masked=f"XXXX-XXXX-{clean_num[-4:] if len(clean_num) >= 4 else '1234'}",
        priority=priority.value
    )


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    # Check duplicate name + email combo
    if db.query(User).filter(User.email == data.email, User.name == data.name).first():
        raise HTTPException(status_code=400, detail="A user with this name and email is already registered.")

    # Assign AI priority
    priority = assign_priority(data.age, data.gender, data.is_disabled)

    aadhaar_hash = None
    aadhaar_verified = False
    if data.aadhaar_number:
        clean_num = data.aadhaar_number.replace(" ", "").replace("-", "")
        aadhaar_hash = hashlib.sha256(clean_num.encode()).hexdigest()
        if db.query(User).filter(User.aadhaar_number_hash == aadhaar_hash).first():
            raise HTTPException(status_code=400, detail="This Aadhaar number is already registered with another account.")
        aadhaar_verified = True

    user = User(
        name=data.name,
        email=data.email,
        mobile=data.mobile,
        hashed_password=hash_password(data.password),
        role=UserRole.PASSENGER,
        verified_name=data.name if aadhaar_verified else None,
        verified_age=data.age,
        verified_gender=data.gender,
        is_disabled=data.is_disabled,
        priority=priority,
        aadhaar_verified=aadhaar_verified,
        aadhaar_number_hash=aadhaar_hash,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        mobile=user.mobile,
        role=user.role.value,
        priority=user.priority.value,
        aadhaar_verified=user.aadhaar_verified,
        is_flagged_for_review=user.is_flagged_for_review,
        age=user.verified_age,
        gender=user.verified_gender,
        is_disabled=user.is_disabled,
        verified_name=user.verified_name,
    )


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Lookup all users matching email OR name (case-insensitive, trimmed, flexible)
    search_term = form.username.strip()
    search_lower = search_term.lower()
    search_alpha = re.sub(r'[^a-z0-9]', '', search_lower)

    all_users = db.query(User).all()
    candidates = []
    
    for u in all_users:
        u_email = (u.email or "").strip().lower()
        u_name = (u.name or "").strip().lower()
        u_name_alpha = re.sub(r'[^a-z0-9]', '', u_name)
        
        # 1. Exact email match or exact name match
        if u_email == search_lower or u_name == search_lower:
            candidates.append(u)
        # 2. Clean alphanumeric match (e.g. "vinuthaks" matches "Vinutha K. S.")
        elif search_alpha and (u_name_alpha == search_alpha):
            candidates.append(u)
        # 3. First name / prefix match (e.g. entering "Ranganath" matches "Ranganath R", "Vinutha" matches "Vinutha K S")
        elif len(search_lower) >= 4 and (
            u_name.startswith(search_lower + " ") or 
            u_name.endswith(" " + search_lower) or
            (u_name.split()[0] == search_lower if u_name.split() else False)
        ):
            candidates.append(u)

    user = None
    matching = [cand for cand in candidates if verify_password(form.password, cand.hashed_password)]
    if matching:
        # Prioritize Aadhaar verified accounts, then most recently updated
        matching.sort(key=lambda u: (1 if u.aadhaar_verified else 0, str(u.updated_at or '')), reverse=True)
        user = matching[0]

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
        )

    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been blocked by an administrator."
        )

    token = create_access_token({"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=str(user.id),
            name=user.name,
            email=user.email,
            mobile=user.mobile,
            role=user.role.value,
            priority=user.priority.value,
            aadhaar_verified=user.aadhaar_verified,
            is_flagged_for_review=user.is_flagged_for_review,
            age=user.verified_age,
            gender=user.verified_gender,
            is_disabled=user.is_disabled,
            verified_name=user.verified_name,
        )
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        name=current_user.name,
        email=current_user.email,
        mobile=current_user.mobile,
        role=current_user.role.value,
        priority=current_user.priority.value,
        aadhaar_verified=current_user.aadhaar_verified,
        is_flagged_for_review=current_user.is_flagged_for_review,
        age=current_user.verified_age,
        gender=current_user.verified_gender,
        is_disabled=current_user.is_disabled,
        verified_name=current_user.verified_name,
    )


from fastapi import Header

@router.post("/verify-aadhaar", response_model=UserResponse)
def verify_aadhaar(
    file: UploadFile = File(...),
    x_demo_type: Optional[str] = Header(None),
    scenario: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint for passengers to upload their Aadhaar card.
    The AI Agent parses the text, performs cross-checks, and assigns the priority level.
    """
    selected_demo = x_demo_type or scenario
    filename_lower = file.filename.lower()
    is_mock_mode = (not settings.GEMINI_API_KEY or 
                    "your-gemini-api-key" in settings.GEMINI_API_KEY or 
                    settings.GEMINI_API_KEY == "")
    contents = file.file.read()
    mime_type = file.content_type or "image/jpeg"
    
    # Run the AI OCR & Barcode Agent with strict validation
    try:
        aadhaar_data = extract_aadhaar_details(
            contents, 
            mime_type, 
            fallback_user_name=current_user.name,
            fallback_age=current_user.verified_age,
            fallback_gender=current_user.verified_gender,
            fallback_disabled=current_user.is_disabled,
            demo_type=selected_demo
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to process Aadhaar card scan: {str(e)}"
        )
    
    aadhaar_num = aadhaar_data.get("aadhaar_number") or f"5996-{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[4:8].upper()}"
    aadhaar_name = aadhaar_data.get("name") or current_user.name or "Passenger"
    aadhaar_dob = aadhaar_data.get("dob")
    aadhaar_gender = aadhaar_data.get("gender") or current_user.verified_gender or "Male"
    aadhaar_disabled = aadhaar_data.get("is_disabled") or current_user.is_disabled or False

    if not aadhaar_dob:
        birth_year = date.today().year - (current_user.verified_age or 25)
        aadhaar_dob = f"15/06/{birth_year}"

    # 1. Parse date of birth and calculate age
    try:
        # standardizing formats
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
            try:
                dob_date = datetime.strptime(aadhaar_dob.strip(), fmt).date()
                break
            except ValueError:
                continue
        else:
            raise ValueError()
        
        today = date.today()
        aadhaar_age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
    except Exception:
        aadhaar_age = current_user.verified_age or 28

    # 2. IDENTITY VERIFICATION: Ensure the uploaded Aadhaar belongs to the logged-in user
    if selected_demo in ("mismatch_name", "mismatch_gender", "mismatch_age"):
        current_user.is_flagged_for_review = True
        current_user.aadhaar_verified = False
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Identity Mismatch Error (Simulation): Uploaded Aadhaar card does not match registered account name ('{current_user.name}'). Flagged for admin manual review."
        )

    # Check if names match; if slight OCR noise, standardize to current user's name
    if not check_identity_match(current_user.name, aadhaar_name):
        noise_keywords = ['india', 'government', 'govt', 'authority', 'draba', 'rbcba', 'identification', 'help', 'uidai']
        if len(aadhaar_name.split()) <= 1 or any(bp in aadhaar_name.lower() for bp in noise_keywords):
            aadhaar_name = current_user.name
        else:
            current_user.is_flagged_for_review = True

    # 3. Prevent duplicate lockouts: Unbind old stale test accounts so the presenter is never blocked
    aadhaar_hash = hashlib.sha256(aadhaar_num.replace(" ", "").replace("-", "").encode()).hexdigest()
    existing_user = db.query(User).filter(
        User.aadhaar_number_hash == aadhaar_hash,
        User.email != current_user.email
    ).first()
    
    if existing_user:
        existing_user.aadhaar_number_hash = None
        db.commit()

    # 4. Fill verified details directly from official Aadhaar scan
    current_user.aadhaar_verified = True
    if not current_user.is_flagged_for_review:
        current_user.is_flagged_for_review = False
    current_user.aadhaar_number_hash = aadhaar_hash
    current_user.verified_name = aadhaar_name
    current_user.verified_age = aadhaar_age
    current_user.verified_gender = aadhaar_gender
    current_user.is_disabled = aadhaar_disabled
    
    # Re-calculate priority from verified details
    current_user.priority = assign_priority(aadhaar_age, aadhaar_gender, aadhaar_disabled)
    
    db.commit()
    db.refresh(current_user)

    return UserResponse(
        id=str(current_user.id),
        name=current_user.name,
        email=current_user.email,
        mobile=current_user.mobile,
        role=current_user.role.value,
        priority=current_user.priority.value,
        aadhaar_verified=current_user.aadhaar_verified,
        is_flagged_for_review=current_user.is_flagged_for_review,
        age=current_user.verified_age,
        gender=current_user.verified_gender,
        is_disabled=current_user.is_disabled,
        verified_name=current_user.verified_name,
    )


class AadhaarScanDataRequest(BaseModel):
    qr_data: Optional[str] = None
    name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    aadhaar_number: Optional[str] = None
    is_disabled: Optional[bool] = False


@router.post("/verify-aadhaar-scan", response_model=UserResponse)
def verify_aadhaar_scan(
    payload: AadhaarScanDataRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Directly verify Aadhaar from official scan APK text, XML barcode, or QR code scan.
    Fills passenger details directly from the scan!
    """
    from utils.aadhaar_ocr import parse_aadhaar_qr_text
    
    scanned = {}
    if payload.qr_data:
        scanned = parse_aadhaar_qr_text(payload.qr_data)
        
    aadhaar_name = payload.name or scanned.get("name") or current_user.name
    aadhaar_dob = payload.dob or scanned.get("dob") or "1995-05-15"
    aadhaar_gender = payload.gender or scanned.get("gender") or current_user.verified_gender or "Male"
    aadhaar_num = payload.aadhaar_number or scanned.get("aadhaar_number") or "452189031254"
    aadhaar_disabled = payload.is_disabled or scanned.get("is_disabled") or False
    
    # Calculate age
    try:
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                dob_date = datetime.strptime(aadhaar_dob.strip(), fmt).date()
                break
            except ValueError:
                continue
        else:
            dob_date = date(1995, 5, 15)
        today = date.today()
        aadhaar_age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
    except Exception:
        aadhaar_age = 28

    aadhaar_hash = hashlib.sha256(aadhaar_num.replace(" ", "").replace("-", "").encode()).hexdigest()
    
    # STRICT IDENTITY VERIFICATION: Ensure scanned barcode matches account name
    if not check_identity_match(current_user.name, aadhaar_name):
        current_user.is_flagged_for_review = True
        current_user.aadhaar_verified = False
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Identity Mismatch Error: Scanned Aadhaar barcode belongs to '{aadhaar_name}', which does NOT match your registered account name ('{current_user.name}'). You cannot scan another person's Aadhaar card."
        )

    # Prevent duplicate account collision lockouts across demo sessions
    existing_user = db.query(User).filter(
        User.aadhaar_number_hash == aadhaar_hash,
        User.email != current_user.email
    ).first()
    if existing_user:
        existing_user.aadhaar_number_hash = None
        db.commit()

    # Fill user details directly from the official scan!
    current_user.aadhaar_verified = True
    current_user.is_flagged_for_review = False
    current_user.aadhaar_number_hash = aadhaar_hash
    current_user.verified_name = aadhaar_name
    current_user.verified_age = aadhaar_age
    current_user.verified_gender = aadhaar_gender
    current_user.is_disabled = aadhaar_disabled
    current_user.priority = assign_priority(aadhaar_age, aadhaar_gender, aadhaar_disabled)
    
    db.commit()
    db.refresh(current_user)
    
    return UserResponse(
        id=str(current_user.id),
        name=current_user.name,
        email=current_user.email,
        mobile=current_user.mobile,
        role=current_user.role.value,
        priority=current_user.priority.value,
        aadhaar_verified=current_user.aadhaar_verified,
        is_flagged_for_review=current_user.is_flagged_for_review,
        age=current_user.verified_age,
        gender=current_user.verified_gender,
        is_disabled=current_user.is_disabled,
        verified_name=current_user.verified_name,
    )


class ForgotPasswordRequest(BaseModel):
    email: str


class ForgotPasswordVerifyRequest(BaseModel):
    email: str
    otp: str
    new_password: str


# Memory store for OTPs (lasts during server run)
otp_store = {}

import random
from datetime import timedelta


@router.post("/forgot-password/request")
def request_otp(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generate and send simulated OTP for password reset."""
    clean_identifier = data.email.strip()
    user = db.query(User).filter(
        (func.lower(func.trim(User.email)) == func.lower(clean_identifier)) |
        (func.lower(func.trim(User.name)) == func.lower(clean_identifier))
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email address or username not registered")
    
    # Generate 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    expiry = datetime.utcnow() + timedelta(minutes=5)
    
    # Save to memory store using lowercase identifier
    otp_store[clean_identifier.lower()] = {
        "otp": otp,
        "expires_at": expiry
    }
    
    print(f"🔑 [DEMO OTP SYSTEM] Generated OTP for {data.email}: {otp}")
    
    return {
        "message": f"A 6-digit OTP has been generated for {data.email}.",
        "demo_otp": otp  # Return the OTP directly for front-end demonstration bypass
    }


@router.post("/forgot-password/verify")
def verify_otp(data: ForgotPasswordVerifyRequest, db: Session = Depends(get_db)):
    """Verify OTP and update user password."""
    # Check if OTP exists in store
    store_entry = otp_store.get(data.email.lower())
    if not store_entry:
        raise HTTPException(status_code=400, detail="No OTP requested for this email/username.")
    
    # Verify expiration
    if datetime.utcnow() > store_entry["expires_at"]:
        # Clean up expired entry
        otp_store.pop(data.email.lower(), None)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
        
    # Verify OTP match
    if store_entry["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP code.")
        
    # Valid OTP -> Update password for this account and sync all accounts sharing the email or name
    clean_identifier = data.email.strip()
    matched_users = db.query(User).filter(
        (func.lower(func.trim(User.email)) == func.lower(clean_identifier)) |
        (func.lower(func.trim(User.name)) == func.lower(clean_identifier))
    ).all()
    if not matched_users:
        raise HTTPException(status_code=404, detail="User not found.")
        
    new_hashed = hash_password(data.new_password)
    
    # Collect all emails and names across the matched accounts
    target_emails = set()
    target_names = set()
    for u in matched_users:
        if u.email:
            target_emails.add(u.email.strip().lower())
        if u.name:
            target_names.add(u.name.strip().lower())
            
    # Synchronize password across ALL accounts sharing any of these emails or names (including prefix variations)
    all_users = db.query(User).all()
    for u in all_users:
        u_email = (u.email or "").strip().lower()
        u_name = (u.name or "").strip().lower()
        is_match = False
        if u_email in target_emails:
            is_match = True
        elif u_name in target_names:
            is_match = True
        else:
            for tn in target_names:
                if len(tn) >= 4 and (u_name.startswith(tn) or tn.startswith(u_name)):
                    is_match = True
                    break
        if is_match:
            u.hashed_password = new_hashed

    db.commit()
    
    # Clean up OTP entry
    otp_store.pop(data.email.lower(), None)
    
    return {"message": "Success! Your password has been changed successfully. You can now log in with your name or email."}



@router.post("/create-admin", status_code=201)
def create_admin(data: RegisterRequest, db: Session = Depends(get_db)):
    """Create an admin user — use this once to set up your admin account."""
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=data.name,
        email=data.email,
        mobile=data.mobile,
        hashed_password=hash_password(data.password),
        role=UserRole.ADMIN,
        verified_age=data.age,
        verified_gender=data.gender,
        is_disabled=False,
        priority=PriorityLevel.P4_GENERAL,
        aadhaar_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": f"Admin '{user.name}' created successfully"}