from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
import uuid
import qrcode
import io
import base64

from database import get_db
from models.user import User, UserRole, PriorityLevel
from models.booking import Booking, BookingStatus
from models.seat import Seat, SeatStatus
from models.payment import Payment, PaymentStatus
from models.coach import Coach
from models.train import Train
from utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AdminStatsResponse(BaseModel):
    total_seats: int
    occupied: int
    available: int
    locked: int
    booked: int
    waitlisted: int
    flagged_users: int

class UserAdminResponse(BaseModel):
    id: str
    name: str
    email: str
    mobile: str
    role: str
    priority: str
    aadhaar_verified: bool
    is_flagged_for_review: bool
    is_blocked: bool
    age: Optional[int]
    gender: Optional[str]

    class Config:
        from_attributes = True

class BookingAdminResponse(BaseModel):
    id: str
    passenger_name: str
    passenger_email: str
    train_number: str
    train_name: str
    coach_number: Optional[str] = None
    seat_number: Optional[str] = None
    journey_date: str
    source_station: str
    destination_station: str
    status: str
    is_emergency: bool
    waitlist_position: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True

class SeatOverrideRequest(BaseModel):
    booking_id: str
    seat_id: str

class PaymentAdminResponse(BaseModel):
    id: str
    booking_id: str
    passenger_name: str
    amount: float
    status: str
    method: Optional[str] = None
    paid_at: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Retrieve system-wide booking and seat statistics for the admin dashboard."""
    total_seats = db.query(func.sum(Coach.total_seats)).scalar() or 0
    
    occupied = db.query(func.count(Seat.id)).filter(Seat.status == SeatStatus.OCCUPIED).scalar() or 0
    available = db.query(func.count(Seat.id)).filter(Seat.status == SeatStatus.AVAILABLE).scalar() or 0
    locked = db.query(func.count(Seat.id)).filter(Seat.status == SeatStatus.LOCKED).scalar() or 0
    booked = db.query(func.count(Seat.id)).filter(Seat.status == SeatStatus.BOOKED).scalar() or 0
    
    waitlisted = db.query(func.count(Booking.id)).filter(
        Booking.seat_id == None,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
    ).scalar() or 0
    
    flagged = db.query(func.count(User.id)).filter(User.is_flagged_for_review == True).scalar() or 0

    return AdminStatsResponse(
        total_seats=total_seats,
        occupied=occupied,
        available=available,
        locked=locked,
        booked=booked,
        waitlisted=waitlisted,
        flagged_users=flagged
    )


@router.get("/users", response_model=List[UserAdminResponse])
def get_users(db: Session = Depends(get_db)):
    """Get list of all users in the system."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users


@router.post("/users/{user_id}/block")
def block_user(user_id: str, db: Session = Depends(get_db)):
    """Block a user from logging in and booking tickets."""
    user_uuid = uuid.UUID(user_id)
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_blocked = True
    db.commit()
    return {"message": f"User {user.name} has been BLOCKED successfully."}


@router.post("/users/{user_id}/unblock")
def unblock_user(user_id: str, db: Session = Depends(get_db)):
    """Unblock a user."""
    user_uuid = uuid.UUID(user_id)
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_blocked = False
    db.commit()
    return {"message": f"User {user.name} has been UNBLOCKED successfully."}


@router.post("/users/{user_id}/resolve-flag")
def resolve_flag(user_id: str, approve: bool, db: Session = Depends(get_db)):
    """Admin resolution for flagged Aadhaar mismatch review."""
    user_uuid = uuid.UUID(user_id)
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if approve:
        user.aadhaar_verified = True
        user.is_flagged_for_review = False
    else:
        # Reject: clear temp fields
        user.aadhaar_verified = False
        user.is_flagged_for_review = False
        user.verified_name = None
        user.verified_age = None
        user.verified_gender = None
        user.is_disabled = False
        user.priority = PriorityLevel.P4_GENERAL
        
    db.commit()
    status_str = "Approved" if approve else "Rejected"
    return {"message": f"Aadhaar verification request resolved as {status_str}."}


@router.get("/bookings", response_model=List[BookingAdminResponse])
def get_bookings(
    passenger_name: Optional[str] = None,
    train_id: Optional[str] = None,
    journey_date: Optional[date] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieve and filter all bookings."""
    query = db.query(Booking).join(User).join(Train)
    
    if passenger_name:
        query = query.filter(User.name.ilike(f"%{passenger_name}%"))
    if train_id:
        query = query.filter(Booking.train_id == uuid.UUID(train_id))
    if journey_date:
        query = query.filter(Booking.journey_date == journey_date)
    if status:
        query = query.filter(Booking.status == BookingStatus[status.upper()])
        
    bookings = query.order_by(Booking.created_at.desc()).all()
    
    result = []
    for b in bookings:
        result.append(BookingAdminResponse(
            id=str(b.id),
            passenger_name=b.user.name,
            passenger_email=b.user.email,
            train_number=b.train.train_number,
            train_name=b.train.train_name,
            coach_number=b.seat.coach.coach_number if b.seat else None,
            seat_number=b.seat.seat_number if b.seat else None,
            journey_date=str(b.journey_date),
            source_station=b.source_station,
            destination_station=b.destination_station,
            status=b.status.value,
            is_emergency=b.is_emergency,
            waitlist_position=b.waitlist_position,
            created_at=b.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ))
        
    return result


@router.post("/override-seat")
def override_seat(data: SeatOverrideRequest, db: Session = Depends(get_db)):
    """
    Admin override: manually reassign a passenger to a different seat.
    Releases the passenger's current seat and assigns the new one.
    """
    booking_uuid = uuid.UUID(data.booking_id)
    seat_uuid = uuid.UUID(data.seat_id)
    
    booking = db.query(Booking).filter(Booking.id == booking_uuid).first()
    seat = db.query(Seat).filter(Seat.id == seat_uuid).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
    if seat.status != SeatStatus.AVAILABLE:
        raise HTTPException(status_code=400, detail="Target seat is not available")
        
    # Release old seat
    if booking.seat:
        booking.seat.status = SeatStatus.AVAILABLE
        booking.seat.locked_at = None
        print(f"🔄 Admin: Released old seat {booking.seat.seat_number}")
        
    # Allocate new seat
    booking.seat_id = seat.id
    booking.waitlist_position = None  # In case they were waitlisted, assign seat now!
    
    if booking.entry_scanned_at:
        seat.status = SeatStatus.OCCUPIED
    else:
        seat.status = SeatStatus.BOOKED
        
    # Regenerate QR code
    def generate_qr(booking_id: str, seat_number: str, train_number: str, journey_date_str: str) -> str:
        data_qr = f"BOOKING:{booking_id}|SEAT:{seat_number}|TRAIN:{train_number}|DATE:{journey_date_str}"
        qr = qrcode.QRCode(version=1, box_size=6, border=2)
        qr.add_data(data_qr)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    booking.qr_code = generate_qr(
        str(booking.id),
        seat.seat_number,
        booking.train.train_number,
        str(booking.journey_date)
    )
    
    db.commit()
    print(f"🎉 Admin successfully reassigned booking {booking.id} to seat {seat.seat_number}.")
    return {
        "message": f"Seat override successful! Passenger reassigned to seat {seat.seat_number}.",
        "seat_number": seat.seat_number,
        "coach_number": seat.coach.coach_number
    }


@router.post("/cancel-booking/{booking_id}")
def admin_cancel_booking(booking_id: str, db: Session = Depends(get_db)):
    """Admin cancellation: cancels booking, processes refund, and triggers waitlist."""
    booking_uuid = uuid.UUID(booking_id)
    booking = db.query(Booking).filter(Booking.id == booking_uuid).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Booking already cancelled")
        
    seat = booking.seat
    booking.status = BookingStatus.CANCELLED
    
    if seat:
        seat.status = SeatStatus.AVAILABLE
        seat.locked_at = None
        
    # Process refund
    payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
    if payment and payment.status == PaymentStatus.SUCCESS:
        payment.status = PaymentStatus.REFUNDED
        payment.refunded_at = datetime.utcnow()
        
    db.commit()
    print(f"❌ Admin cancelled booking {booking.id}. Refund processed.")
    
    # Auto reallocate waitlist
    if seat:
        from routes.bookings import auto_allocate_waitlist
        auto_allocate_waitlist(booking.train_id, booking.journey_date, seat, db)
        
    return {"message": "Booking cancelled and refunded successfully by Administrator."}


@router.get("/payments", response_model=List[PaymentAdminResponse])
def get_payments(db: Session = Depends(get_db)):
    """View payment history logs."""
    payments = db.query(Payment).join(Booking).join(User).order_by(Payment.created_at.desc()).all()
    result = []
    for p in payments:
        result.append(PaymentAdminResponse(
            id=str(p.id),
            booking_id=str(p.booking_id),
            passenger_name=p.booking.user.name,
            amount=p.amount,
            status=p.status.value,
            method=p.method.value if p.method else None,
            paid_at=p.paid_at.strftime("%Y-%m-%d %H:%M:%S") if p.paid_at else None,
            created_at=p.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ))
    return result


@router.get("/reports/occupancy")
def get_occupancy_report(db: Session = Depends(get_db)):
    """Generate train and coach-wise occupancy report."""
    coaches = db.query(Coach).all()
    report = []
    for c in coaches:
        total = c.total_seats
        occupied = db.query(func.count(Seat.id)).filter(Seat.coach_id == c.id, Seat.status == SeatStatus.OCCUPIED).scalar() or 0
        booked = db.query(func.count(Seat.id)).filter(Seat.coach_id == c.id, Seat.status == SeatStatus.BOOKED).scalar() or 0
        locked = db.query(func.count(Seat.id)).filter(Seat.coach_id == c.id, Seat.status == SeatStatus.LOCKED).scalar() or 0
        available = total - occupied - booked - locked
        
        utilization = round(((occupied + booked) / total) * 100, 1)
        
        report.append({
            "train_number": c.train.train_number,
            "coach_number": c.coach_number,
            "coach_type": c.coach_type.value,
            "total_seats": total,
            "available": available,
            "booked": booked,
            "occupied": occupied,
            "locked": locked,
            "utilization_percentage": utilization
        })
    return report
