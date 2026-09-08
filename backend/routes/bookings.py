from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
import uuid

from database import get_db
from models.user import User, PriorityLevel
from models.coach import Coach
from models.seat import Seat, SeatStatus
from models.train import Train
from models.booking import Booking, BookingStatus
from models.payment import Payment, PaymentStatus
from utils.auth import get_current_user
from agents.seat_allocator import find_best_seat, check_no_shows, find_adjacent_seats, is_coach_overcrowded, TRAIN_ROUTES, is_seat_occupied_for_leg
from routes.seats import release_expired_locks
from config import settings

router = APIRouter(prefix="/bookings", tags=["Bookings"])

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class BookingRequest(BaseModel):
    train_id: str
    journey_date: date
    source_station: str
    destination_station: str
    seat_id: Optional[str] = None
    coach_class: Optional[str] = "SL"

class FamilyBookingRequest(BaseModel):
    train_id: str
    journey_date: date
    source_station: str
    destination_station: str
    passenger_ids: List[str]  # List of user IDs in the family group
    coach_class: Optional[str] = "SL"

class BookingResponse(BaseModel):
    id: str
    seat_number: Optional[str] = None
    coach: Optional[str] = None
    train_name: str
    journey_date: str
    source_station: str
    destination_station: str
    status: str
    priority_used: str
    qr_code: Optional[str] = None
    is_emergency: bool
    waitlist_position: Optional[str] = None
    fare: float
    razorpay_order_id: Optional[str] = None
    seat_status: Optional[str] = None
    entry_scanned: bool = False
    exit_scanned: bool = False

    class Config:
        from_attributes = True

# ── Station Distance and Fare Helpers ──────────────────────────────────────────

STATION_DISTANCES = {
    # Existing local route mappings (relative to KSR Bengaluru = 2270)
    "ksr bengaluru": 2270,
    "bengaluru city local": 2270,
    "bengaluru": 2270,
    "yesvantpur": 2276,
    "chikbanavar": 2283,
    "nelamangala": 2298,
    "kunigal": 2343,
    "tumkur": 2340,
    "kengeri": 2258,
    "bidadi": 2240,
    "ramanagara": 2225,
    "channapatna": 2214,
    "maddur": 2190,
    "mandya": 2177,
    "srirangapatna": 2145,
    "mysuru junction": 2132,
    "mysore": 2132,
    "krishnarajapuram": 2284,
    "bangarapet": 2340,
    "jolarpettai": 2415,
    "katpadi": 2499,
    "arakkonam": 2555,
    "chennai central": 2629,
    "chennai": 2629,

    # New All-India Route Mappings (relative to New Delhi = 0)
    "new delhi": 0,
    "delhi": 0,
    "kota junction": 460,
    "ratlam junction": 730,
    "vadodara junction": 990,
    "surat": 1120,
    "mumbai central": 1380,
    "mumbai": 1380,
    "kanpur central": 440,
    "prayagraj junction": 630,
    "patna junction": 1000,
    "howrah junction": 1450,
    "kolkata": 1450,
    "bhopal junction": 700,
    "nagpur junction": 1090,
    "secunderabad junction": 1670,
    "hyderabad": 1670,
    "pune junction": 1570,
    "pune": 1570,
    "solapur": 1830,
    "bhubaneswar": 1200,
    "visakhapatnam": 1640,
    "vijayawada": 2000,
    "jaipur junction": 300,
    "jaipur": 300,
    "ahmedabad junction": 930,
    "ahmedabad": 930,
    "lucknow charbagh": 510,
    "lucknow": 510,
    "guwahati": 1950,
}

def get_coach_class_code(coach_number: str) -> str:
    c_num = coach_number.upper()
    if c_num in ["A", "B"]:
        return "3A"
    elif c_num in ["C", "D"]:
        return "SL"
    return "2S"

def calculate_fare(source: str, destination: str, priority_level: str, coach_class: str = "SL", train_id: Optional[str] = None, db: Optional[Session] = None) -> float:
    src = source.strip().lower()
    dst = destination.strip().lower()
    
    dist_src = STATION_DISTANCES.get(src, 0)
    dist_dst = STATION_DISTANCES.get(dst, 70) # Default to Tumkur distance
    distance = abs(dist_dst - dist_src)
    if distance == 0:
        distance = 10 # Minimum fallback distance
        
    base_fare_per_km = 2.0  # ₹2.00 per kilometer
    fare = base_fare_per_km * distance
    
    # Apply coach class multipliers (3A is 2.0x, SL is 1.0x, 2S is 0.5x)
    multiplier = 1.0
    c_cls = coach_class.upper()
    if "3A" in c_cls:
        multiplier = 2.0
    elif "2S" in c_cls:
        multiplier = 0.5
        
    fare = fare * multiplier
    
    # Dynamic occupancy-based pricing surge
    demand_multiplier = 1.0
    if train_id and db:
        try:
            t_uuid = uuid.UUID(train_id) if isinstance(train_id, str) else train_id
            total_seats = db.query(func.count(Seat.id)).join(Coach).filter(Coach.train_id == t_uuid).scalar() or 416
            occupied_seats = db.query(func.count(Seat.id)).join(Coach).filter(
                Coach.train_id == t_uuid,
                Seat.status.in_([SeatStatus.BOOKED, SeatStatus.OCCUPIED])
            ).scalar() or 0
            
            occupancy_rate = occupied_seats / total_seats
            if occupancy_rate >= 0.8:
                demand_multiplier = 1.5
            elif occupancy_rate >= 0.5:
                demand_multiplier = 1.2
            elif occupancy_rate < 0.2:
                demand_multiplier = 0.9
        except Exception as e:
            print(f"⚠️ calculate_fare surge exception: {str(e)}")
            
    fare = fare * demand_multiplier
    
    # 50% concession for Senior Citizens (P1) and Disabled (P2)
    if priority_level in [PriorityLevel.P1_SENIOR.value, PriorityLevel.P2_DISABLED.value]:
        fare = fare * 0.5
        
    return round(fare, 2)

def create_razorpay_order(amount: float, booking_id: str) -> str:
    """Create a Razorpay order or fallback to generating a mock ID."""
    if (
        "mock" in str(settings.RAZORPAY_KEY_ID).lower()
        or "rzp_test_" in str(settings.RAZORPAY_KEY_ID)
        or "sandbox" in str(settings.RAZORPAY_KEY_ID).lower()
        or "your-razorpay" in str(settings.RAZORPAY_KEY_SECRET).lower()
        or "your-razorpay" in str(settings.RAZORPAY_KEY_ID).lower()
        or not settings.RAZORPAY_KEY_SECRET
        or settings.RAZORPAY_KEY_SECRET == "your-razorpay-secret"
    ):
        return f"order_mock_{uuid.uuid4().hex[:12]}"
        
    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        order = client.order.create({
            "amount": int(amount * 100), # Razorpay amount is in paise
            "currency": "INR",
            "receipt": booking_id,
            "payment_capture": 1
        })
        return order["id"]
    except Exception as e:
        print(f"❌ Failed to create Razorpay order: {str(e)}. Falling back to mock order.")
        return f"order_mock_{uuid.uuid4().hex[:12]}"

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/book", response_model=BookingResponse, status_code=201)
def book_seat(
    data: BookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Book a seat (locks it for 3 minutes).
    If no seats are available, registers user on waitlist.
    """
    # 0. Self-heal expired locks first
    release_expired_locks(db)

    # 1. Enforce Aadhaar verification
    if not current_user.aadhaar_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aadhaar verification is required to book a seat. Please upload your Aadhaar Card in your profile."
        )

    # 1.1 Enforce journey date is not in the past
    if data.journey_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid journey date '{data.journey_date}'. Past dates cannot be booked; please select today ({date.today().isoformat()}) or a future date."
        )

    train_uuid = uuid.UUID(data.train_id)
    train = db.query(Train).filter(Train.id == train_uuid).first()
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")

    seat = None
    is_emergency = False
    waitlist_pos = None

    # Determine class code
    class_code = data.coach_class or "SL"
    if data.seat_id:
        seat_uuid = uuid.UUID(data.seat_id)
        selected_seat = db.query(Seat).filter(Seat.id == seat_uuid).first()
        if selected_seat:
            class_code = get_coach_class_code(selected_seat.coach.coach_number)

    # Calculate individual fare
    fare = calculate_fare(data.source_station, data.destination_station, current_user.priority.value, class_code, train.id, db)

    # 2. Check seat allocation
    if data.seat_id:
        # Manual seat choice
        seat_uuid = uuid.UUID(data.seat_id)
        seat = db.query(Seat).filter(Seat.id == seat_uuid, Seat.status == SeatStatus.AVAILABLE).first()
        if not seat:
            raise HTTPException(status_code=400, detail="Selected seat is not available")
        
        # Verify if manual seat coach has hit capacity limit
        if is_coach_overcrowded(seat.coach, db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Coach {seat.coach.coach_number} has reached its 95% capacity limit. Please select a seat in another coach."
            )
    else:
        # AI Seating Allocation Agent
        seat = find_best_seat(current_user.priority, data.train_id, db, data.source_station, data.destination_station)
        
        # 3. Emergency no-show reallocation fallback
        if not seat:
            no_shows = check_no_shows(data.train_id, db)
            if no_shows:
                # Conditionally allocate the no-show seat
                seat = no_shows[0].seat
                is_emergency = True
                print(f"🚨 AI Agent: Conditionally allocated no-show seat {seat.seat_number} to emergency passenger.")
            else:
                # 4. Waitlist registration fallback
                # Find current waitlisted count for this train and date
                wl_count = db.query(Booking).filter(
                    Booking.train_id == train.id,
                    Booking.journey_date == data.journey_date,
                    Booking.seat_id == None,
                    Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
                ).count()
                waitlist_pos = f"WL-{wl_count + 1}"
                print(f"📋 AI Agent: No seats available. Placing passenger on waitlist at position: {waitlist_pos}")

    # 5. Lock seat if allocated
    if seat:
        seat.status = SeatStatus.LOCKED
        seat.locked_at = datetime.utcnow()
        seat_id_val = seat.id
        seat_number = seat.seat_number
        coach_number = seat.coach.coach_number
    else:
        seat_id_val = None
        seat_number = None
        coach_number = None

    booking = Booking(
        user_id=current_user.id,
        train_id=train.id,
        seat_id=seat_id_val,
        journey_date=data.journey_date,
        source_station=data.source_station,
        destination_station=data.destination_station,
        status=BookingStatus.PENDING,
        is_emergency=is_emergency,
        waitlist_position=waitlist_pos
    )
    db.add(booking)
    db.flush()

    # 6. Initialize Payment and create Razorpay order
    razorpay_order_id = create_razorpay_order(fare, str(booking.id))
    
    payment = Payment(
        booking_id=booking.id,
        amount=fare,
        razorpay_order_id=razorpay_order_id,
        status=PaymentStatus.PENDING
    )
    db.add(payment)
    db.commit()

    return BookingResponse(
        id=str(booking.id),
        seat_number=seat_number,
        coach=coach_number,
        train_name=train.train_name,
        journey_date=str(data.journey_date),
        source_station=data.source_station,
        destination_station=data.destination_station,
        status="pending",
        priority_used=current_user.priority.value,
        qr_code=None,
        is_emergency=is_emergency,
        waitlist_position=waitlist_pos,
        fare=fare,
        razorpay_order_id=razorpay_order_id
    )


@router.post("/book-family", response_model=List[BookingResponse], status_code=201)
def book_family(
    data: FamilyBookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    P5: Family Group Booking.
    AI Agent allocates adjacent seats in the same coach.
    Creates a unified booking transaction with a single Razorpay order for the total sum.
    """
    # 0. Self-heal locks
    release_expired_locks(db)

    # 1. Enforce Aadhaar verification for booking leader
    if not current_user.aadhaar_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aadhaar verification is required to book tickets. Please verify your identity first."
        )

    # 2. Gather passenger list and verify their identity
    passenger_ids_uuids = [uuid.UUID(pid) for pid in data.passenger_ids]
    passengers = db.query(User).filter(User.id.in_(passenger_ids_uuids)).all()
    if len(passengers) != len(data.passenger_ids):
        raise HTTPException(status_code=400, detail="Some passenger accounts in the group were not found")

    for p in passengers:
        if not p.aadhaar_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Passenger {p.name} must be Aadhaar verified to book as part of a family group."
            )

    train_uuid = uuid.UUID(data.train_id)
    train = db.query(Train).filter(Train.id == train_uuid).first()
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")

    # Enforce journey date is not in the past
    if data.journey_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid journey date '{data.journey_date}'. Past dates cannot be booked; please select today ({date.today().isoformat()}) or a future date."
        )

    num_passengers = len(passengers)
    
    # 3. AI Agent: Seeks adjacent seats in same coach
    allocated_seats = find_adjacent_seats(data.train_id, num_passengers, db, data.source_station, data.destination_station)
    
    # Fallback: if adjacent seats not found, try to book any random available seats
    if not allocated_seats:
        all_seats = db.query(Seat).join(Coach).filter(
            Coach.train_id == train_uuid,
            Seat.status != SeatStatus.LOCKED
        ).order_by(Seat.seat_number).all()
        
        available_seats = [s for s in all_seats if not is_seat_occupied_for_leg(s, db, data.source_station, data.destination_station)]
        
        if len(available_seats) >= num_passengers:
            allocated_seats = available_seats[:num_passengers]
            print("⚠️ AI Agent: Could not find adjacent seats for the group. Assigning nearest individual seats.")
            
    # 4. Generate Bookings and compute total fare
    family_id = uuid.uuid4()
    bookings_created = []
    total_fare = 0.0
    
    # Generate mock/real order ID for the entire group
    group_lead_booking_id = str(uuid.uuid4())
    
    # Calculate fares
    fares = []
    class_code = data.coach_class or "SL"
    for i, p in enumerate(passengers):
        p_class = class_code
        if allocated_seats and i < len(allocated_seats):
            p_class = get_coach_class_code(allocated_seats[i].coach.coach_number)
        f = calculate_fare(data.source_station, data.destination_station, p.priority.value, p_class, train.id, db)
        fares.append(f)
        total_fare += f
        
    razorpay_order_id = create_razorpay_order(total_fare, group_lead_booking_id)

    # If seats are available, book them. Otherwise, waitlist them.
    for i, p in enumerate(passengers):
        seat = allocated_seats[i] if allocated_seats else None
        
        is_emergency = False
        waitlist_pos = None
        
        if seat:
            seat.status = SeatStatus.LOCKED
            seat.locked_at = datetime.utcnow()
            seat_id_val = seat.id
            seat_num = seat.seat_number
            coach_num = seat.coach.coach_number
        else:
            seat_id_val = None
            seat_num = None
            coach_num = None
            
            # Place on waitlist
            wl_count = db.query(Booking).filter(
                Booking.train_id == train.id,
                Booking.journey_date == data.journey_date,
                Booking.seat_id == None,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
            ).count()
            waitlist_pos = f"WL-{wl_count + 1}"
            
        b = Booking(
            id=uuid.UUID(group_lead_booking_id) if i == 0 else uuid.uuid4(),
            user_id=p.id,
            train_id=train.id,
            seat_id=seat_id_val,
            journey_date=data.journey_date,
            source_station=data.source_station,
            destination_station=data.destination_station,
            status=BookingStatus.PENDING,
            is_emergency=is_emergency,
            waitlist_position=waitlist_pos,
            family_booking_id=family_id
        )
        db.add(b)
        db.flush()
        
        # Payment entry: Lead booking takes total amount; others take 0.0 (linked by family_booking_id)
        payment_amount = total_fare if i == 0 else 0.0
        pay_rec = Payment(
            booking_id=b.id,
            amount=payment_amount,
            razorpay_order_id=razorpay_order_id,
            status=PaymentStatus.PENDING
        )
        db.add(pay_rec)
        
        bookings_created.append(BookingResponse(
            id=str(b.id),
            seat_number=seat_num,
            coach=coach_num,
            train_name=train.train_name,
            journey_date=str(data.journey_date),
            source_station=data.source_station,
            destination_station=data.destination_station,
            status="pending",
            priority_used=p.priority.value,
            qr_code=None,
            is_emergency=is_emergency,
            waitlist_position=waitlist_pos,
            fare=fares[i],
            razorpay_order_id=razorpay_order_id
        ))
        
    db.commit()
    return bookings_created


@router.get("/my", response_model=List[BookingResponse])
def get_my_bookings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bookings = db.query(Booking).filter(
        Booking.user_id == current_user.id
    ).order_by(Booking.created_at.desc()).all()

    result = []
    for b in bookings:
        # Load associated payment order ID
        pay = db.query(Payment).filter(Payment.booking_id == b.id).first()
        r_order_id = pay.razorpay_order_id if pay else None
        b_amount = pay.amount if pay else 0.0
        
        # In case booking was waitlisted, fare needs to be calculated
        if b_amount == 0.0:
            b_class = get_coach_class_code(b.seat.coach.coach_number) if b.seat else "SL"
            b_amount = calculate_fare(b.source_station, b.destination_station, current_user.priority.value, b_class, b.train_id, db)

        is_entry = b.entry_scanned_at is not None
        is_exit = b.exit_scanned_at is not None
        seat_stat = b.seat.status.value if b.seat else None

        display_status = b.status.value
        if is_exit or b.status == BookingStatus.COMPLETED:
            display_status = "COMPLETED"
        elif is_entry or seat_stat == "OCCUPIED":
            display_status = "OCCUPIED"

        result.append(BookingResponse(
            id=str(b.id),
            seat_number=b.seat.seat_number if b.seat else None,
            coach=b.seat.coach.coach_number if b.seat else None,
            train_name=b.train.train_name,
            journey_date=str(b.journey_date),
            source_station=b.source_station,
            destination_station=b.destination_station,
            status=display_status,
            priority_used=current_user.priority.value,
            qr_code=b.qr_code,
            is_emergency=b.is_emergency,
            waitlist_position=b.waitlist_position,
            fare=b_amount,
            razorpay_order_id=r_order_id,
            seat_status=seat_stat,
            entry_scanned=is_entry,
            exit_scanned=is_exit
        ))
    return result


@router.delete("/cancel/{booking_id}")
def cancel_booking(booking_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    booking_uuid = uuid.UUID(booking_id)
    booking = db.query(Booking).filter(
        Booking.id == booking_uuid,
        Booking.user_id == current_user.id
    ).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Booking already cancelled")
    if booking.status == BookingStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot cancel a completed journey")

    # If seat was occupied/booked, release it
    if booking.seat:
        booking.seat.status = SeatStatus.AVAILABLE
        booking.seat.locked_at = None
        
    booking.status = BookingStatus.CANCELLED
    
    # Process refund
    payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
    if payment and payment.status == PaymentStatus.SUCCESS:
        payment.status = PaymentStatus.REFUNDED
        payment.refunded_at = datetime.utcnow()
        print(f"💸 Refunded ₹{payment.amount} to user account.")
        
    db.commit()

    # Trigger waitlist allocation to instantly fill the newly empty seat
    if booking.seat:
        # Import inside function to avoid circular references
        from routes.bookings import auto_allocate_waitlist
        auto_allocate_waitlist(booking.train_id, booking.journey_date, booking.seat, db)

    return {"message": "Booking cancelled and refund processed successfully."}


def auto_allocate_waitlist(train_id: uuid.UUID, journey_date: date, seat: Seat, db: Session):
    """
    AI Agent: Automatically reallocates a vacated seat to the highest priority waitlisted passenger.
    """
    import qrcode
    import io
    import base64
    
    # Find highest priority waitlisted passenger
    # We sort by waitlist position (WL-1, WL-2)
    waitlist_booking = db.query(Booking).join(User).filter(
        Booking.train_id == train_id,
        Booking.journey_date == journey_date,
        Booking.seat_id == None,
        Booking.status == BookingStatus.CONFIRMED # Must be paid/confirmed to get allocated
    ).order_by(
        User.priority.asc(), # P1 first, then P2, etc.
        Booking.created_at.asc() # FC-FS
    ).first()
    
    if not waitlist_booking:
        print(f"ℹ️ Seat {seat.seat_number} is vacant. No waitlisted bookings found.")
        return
        
    # Allocate seat to waitlist booking
    waitlist_booking.seat_id = seat.id
    waitlist_booking.waitlist_position = None
    seat.status = SeatStatus.BOOKED
    
    # Generate new journey QR Code
    def generate_qr(booking_id: str, seat_number: str, train_number: str, journey_date_str: str) -> str:
        data = f"BOOKING:{booking_id}|SEAT:{seat_number}|TRAIN:{train_number}|DATE:{journey_date_str}"
        qr = qrcode.QRCode(version=1, box_size=6, border=2)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    waitlist_booking.qr_code = generate_qr(
        str(waitlist_booking.id),
        seat.seat_number,
        waitlist_booking.train.train_number,
        str(waitlist_booking.journey_date)
    )
    
    db.commit()
    print(f"🎉 AI Agent auto-allocated seat {seat.seat_number} to waitlisted passenger: {waitlist_booking.user.name}")


@router.post("/scan-entry/{booking_id}")
def scan_entry(booking_id: str, db: Session = Depends(get_db)):
    booking_uuid = uuid.UUID(booking_id)
    booking = db.query(Booking).filter(Booking.id == booking_uuid).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Invalid QR code")
    if booking.status != BookingStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail=f"Cannot scan — booking status is {booking.status.value}")

    seat = booking.seat
    if not seat:
         raise HTTPException(status_code=400, detail="Booking has no seat assigned yet")

    # EMERGENCY RELOCATION:
    # If this seat is conditionally occupied by an emergency passenger and the original passenger boards:
    if booking.is_emergency == False and seat.status == SeatStatus.OCCUPIED:
        # Find another seat for the emergency passenger who is currently occupying it
        emergency_booking = db.query(Booking).filter(
            Booking.seat_id == seat.id,
            Booking.is_emergency == True,
            Booking.status == BookingStatus.CONFIRMED
        ).first()
        
        if emergency_booking:
            print(f"🚨 Double booking conflict! Original passenger {booking.user.name} scanned for seat {seat.seat_number}.")
            # Find next best seat for emergency passenger
            new_seat = find_best_seat(emergency_booking.user.priority, str(booking.train_id), db, emergency_booking.source_station, emergency_booking.destination_station)
            if new_seat:
                # Lock and update emergency passenger's seat
                new_seat.status = SeatStatus.OCCUPIED
                emergency_booking.seat_id = new_seat.id
                print(f"🔄 AI Agent upgraded/relocated emergency passenger to seat {new_seat.seat_number}.")
            else:
                # Put emergency passenger on waitlist
                emergency_booking.seat_id = None
                emergency_booking.is_emergency = False
                wl_count = db.query(Booking).filter(
                    Booking.train_id == booking.train_id,
                    Booking.journey_date == booking.journey_date,
                    Booking.seat_id == None,
                    Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
                ).count()
                emergency_booking.waitlist_position = f"WL-{wl_count + 1}"
                print("⚠️ AI Agent: No seats available for relocation. Moving emergency passenger to waitlist.")
            db.flush()

    passenger_name = booking.user.name
    booking.entry_scanned_at = datetime.utcnow()
    seat.status = SeatStatus.OCCUPIED
    db.commit()

    return {
        "message": f"Entry confirmed! Seat {seat.seat_number} is now OCCUPIED.",
        "passenger": passenger_name,
        "seat": seat.seat_number,
        "coach": seat.coach.coach_number
    }


@router.post("/scan-exit/{booking_id}")
def scan_exit(booking_id: str, db: Session = Depends(get_db)):
    booking_uuid = uuid.UUID(booking_id)
    booking = db.query(Booking).filter(Booking.id == booking_uuid).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Invalid QR code")

    seat = booking.seat
    if not seat:
         raise HTTPException(status_code=400, detail="Booking has no seat assigned")

    booking.exit_scanned_at = datetime.utcnow()
    booking.status = BookingStatus.COMPLETED
    seat.status = SeatStatus.AVAILABLE
    db.commit()

    print(f"🚪 Passenger exited. Seat {seat.seat_number} is now VACANT.")

    # AI Agent: Auto allocate to waitlist
    auto_allocate_waitlist(booking.train_id, booking.journey_date, seat, db)

    return {
        "message": f"Journey complete! Seat {seat.seat_number} is now AVAILABLE.",
        "seat": seat.seat_number,
        "coach": seat.coach.coach_number
    }


@router.get("/public-details/{booking_id}")
def get_public_booking_details(booking_id: str, db: Session = Depends(get_db)):
    try:
        b_uuid = uuid.UUID(booking_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid booking ID format.")
        
    booking = db.query(Booking).filter(Booking.id == b_uuid).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    return {
        "id": str(booking.id),
        "passenger_name": booking.user.name,
        "train_name": booking.train.train_name,
        "train_number": booking.train.train_number,
        "source_station": booking.source_station,
        "destination_station": booking.destination_station,
        "coach": booking.seat.coach.coach_number if booking.seat else "WL",
        "seat_number": booking.seat.seat_number if booking.seat else "WL",
        "status": booking.status.value,
        "waitlist_position": booking.waitlist_position
    }


@router.get("/ticket-pdf/{booking_id}")
def download_ticket_pdf(booking_id: str, db: Session = Depends(get_db)):
    """
    Generate and stream an official electronic reservation slip (ERS) PDF for the ticket.
    Includes train schedule, passenger details, seating allocation, fare breakdown, and QR code.
    """
    from fastapi.responses import Response
    from utils.ticket_pdf import build_ticket_pdf

    try:
        b_uuid = uuid.UUID(booking_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid booking ID format.")

    booking = db.query(Booking).filter(Booking.id == b_uuid).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    pdf_bytes = build_ticket_pdf(booking)
    pnr_short = f"TSA-{str(booking.id).replace('-', '').upper()[:8]}"
    filename = f"Train_Ticket_{pnr_short}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )