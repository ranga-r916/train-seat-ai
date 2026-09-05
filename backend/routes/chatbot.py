from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import google.generativeai as genai
import uuid
import json
from datetime import date, datetime

from database import get_db
from models.user import User
from models.train import Train
from models.seat import Seat, SeatStatus
from models.booking import Booking, BookingStatus
from models.payment import Payment, PaymentStatus
from utils.auth import get_current_user
from config import settings
from agents.seat_allocator import find_best_seat, check_no_shows
from routes.bookings import calculate_fare, create_razorpay_order

router = APIRouter(prefix="/auth/chatbot", tags=["Chatbot"])

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    action_taken: bool = False

# Helper functions to serve as LLM Tools
def list_trains_tool(db: Session, source: str, destination: str) -> str:
    """Finds available trains running between source and destination stations."""
    src = source.strip().lower()
    dst = destination.strip().lower()
    trains = db.query(Train).filter(
        Train.source_station.ilike(f"%{src}%"),
        Train.destination_station.ilike(f"%{dst}%"),
        Train.is_active == True
    ).all()
    
    if not trains:
        return f"No trains found running from '{source}' to '{destination}'."
        
    res = []
    for t in trains:
        res.append(f"- {t.train_name} ({t.train_number}) | ID: {t.id} | Route: {t.source_station} -> {t.destination_station} | Departure: {t.departure_time.strftime('%H:%M') if t.departure_time else 'N/A'}")
    return "\n".join(res)

def get_my_bookings_tool(db: Session, current_user: User) -> str:
    """Returns the current booking history and ticket status of the passenger."""
    bookings = db.query(Booking).filter(Booking.user_id == current_user.id).order_by(Booking.created_at.desc()).all()
    if not bookings:
        return "You have no booking records in the system."
        
    res = []
    for b in bookings:
        seat_num = b.seat.seat_number if b.seat else "Waitlisted"
        res.append(f"- Booking ID: {b.id} | Train: {b.train.train_name} ({b.train.train_number}) | Date: {b.journey_date} | Seat: {seat_num} | Status: {b.status.value}")
    return "\n".join(res)

def check_seat_availability_tool(db: Session, train_id: str) -> str:
    """Checks the number of available seats on a specific train by its ID."""
    try:
        t_uuid = uuid.UUID(train_id)
    except ValueError:
        return "Error: Invalid train ID format. Please use a valid train ID."
        
    train = db.query(Train).filter(Train.id == t_uuid).first()
    if not train:
        return "Error: Train not found."
        
    available_count = db.query(Seat).join(Train.coaches).filter(
        Seat.status == SeatStatus.AVAILABLE
    ).count()
    
    return f"Train '{train.train_name}' ({train.train_number}) currently has {available_count} available seats."

def book_seat_tool(db: Session, current_user: User, train_id: str, source_station: str, destination_station: str) -> str:
    """Books a seat automatically on behalf of the passenger."""
    if not current_user.aadhaar_verified:
        return "Error: Aadhaar card verification is required to book tickets. Please upload your Aadhaar Card in your profile page first."
        
    try:
        t_uuid = uuid.UUID(train_id)
    except ValueError:
        return "Error: Invalid train ID format."
        
    train = db.query(Train).filter(Train.id == t_uuid).first()
    if not train:
        return "Error: Train not found."
        
    # Check if seat is available
    seat = find_best_seat(current_user.priority, str(train.id), db)
    is_emergency = False
    waitlist_pos = None
    
    if not seat:
        no_shows = check_no_shows(str(train.id), db)
        if no_shows:
            seat = no_shows[0].seat
            is_emergency = True
        else:
            # Place on waitlist
            wl_count = db.query(Booking).filter(
                Booking.train_id == train.id,
                Booking.seat_id == None,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
            ).count()
            waitlist_pos = f"WL-{wl_count + 1}"
            
    # Calculate fare
    fare = calculate_fare(source_station, destination_station, current_user.priority.value, "SL")
    
    if seat:
        seat.status = SeatStatus.LOCKED
        seat.locked_at = datetime.utcnow()
        seat_id = seat.id
        seat_num = seat.seat_number
    else:
        seat_id = None
        seat_num = None
        
    booking = Booking(
        user_id=current_user.id,
        train_id=train.id,
        seat_id=seat_id,
        journey_date=date.today(),
        source_station=source_station,
        destination_station=destination_station,
        status=BookingStatus.PENDING,
        is_emergency=is_emergency,
        waitlist_position=waitlist_pos
    )
    db.add(booking)
    db.flush()
    
    razorpay_order_id = create_razorpay_order(fare, str(booking.id))
    payment = Payment(
        booking_id=booking.id,
        amount=fare,
        razorpay_order_id=razorpay_order_id,
        status=PaymentStatus.PENDING
    )
    db.add(payment)
    
    # Auto-confirm booking (simulate successful payment for chatbot ease of use)
    booking.status = BookingStatus.CONFIRMED
    if seat:
        seat.status = SeatStatus.BOOKED
        seat.locked_at = None
    payment.status = PaymentStatus.SUCCESS
    db.commit()
    
    allocated = f"Seat {seat_num}" if seat_num else f"Waitlisted at position {waitlist_pos}"
    return f"Success! Successfully booked ticket. Booking ID: {booking.id} | Allocated: {allocated} | Fare: ₹{fare} (Payment Auto-Confirmed)."

def cancel_booking_tool(db: Session, current_user: User, booking_id: str) -> str:
    """Cancels an active booking by its booking ID and processes a refund."""
    try:
        b_uuid = uuid.UUID(booking_id)
    except ValueError:
        return "Error: Invalid booking ID format."
        
    booking = db.query(Booking).filter(
        Booking.id == b_uuid,
        Booking.user_id == current_user.id
    ).first()
    
    if not booking:
        return f"Error: Booking with ID '{booking_id}' not found under your account."
        
    if booking.status == BookingStatus.CANCELLED:
        return "Error: This booking is already cancelled."
        
    if booking.seat:
        booking.seat.status = SeatStatus.AVAILABLE
        booking.seat.locked_at = None
        
    booking.status = BookingStatus.CANCELLED
    
    payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
    if payment and payment.status == PaymentStatus.SUCCESS:
        payment.status = PaymentStatus.REFUNDED
        payment.refunded_at = datetime.utcnow()
        
    db.commit()
    
    # Trigger waitlist allocation
    if booking.seat:
        from routes.bookings import auto_allocate_waitlist
        auto_allocate_waitlist(booking.train_id, booking.journey_date, booking.seat, db)
        
    return f"Success! Booking ID {booking_id} has been cancelled, the seat released, and refund processed successfully."

@router.post("", response_model=ChatResponse)
def handle_chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = data.message.strip()
    
    # Resilient fallback if Gemini Key is not set
    if (not settings.GEMINI_API_KEY or 
            "your-gemini-api-key" in settings.GEMINI_API_KEY or 
            settings.GEMINI_API_KEY == ""):
        return handle_mock_chat(query, db, current_user)
        
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # System instructions and prompt guidelines
        prompt = (
            f"You are a helpful Train Seat AI Assistant. You assist passengers with train seat allocations, bookings, "
            f"and queries. The active passenger is named {current_user.name} (Priority level: {current_user.priority.value}, "
            f"Aadhaar verified: {current_user.aadhaar_verified}).\n\n"
            f"You have access to tools to interact with the database. Use them when requested:\n"
            f"- Use list_trains(source, destination) to search trains.\n"
            f"- Use check_seat_availability(train_id) to check seat vacancy.\n"
            f"- Use get_my_bookings() to find user's active bookings.\n"
            f"- Use book_seat(train_id, source_station, destination_station) to book tickets.\n"
            f"- Use cancel_booking(booking_id) to cancel a ticket.\n\n"
            f"Passenger Query: {query}\n"
        )
        
        # We manually process tool selection here to avoid complex multi-turn GenerativeModel configurations
        # Let's inspect the intent and run matching tools
        action_taken = False
        response_text = ""
        query_lower = query.lower()
        
        if "train" in query_lower and ("find" in query_lower or "list" in query_lower or "show" in query_lower or "search" in query_lower):
            # Parse source and destination stations from query
            # E.g., "Find trains from Bengaluru to Tumkur"
            import re
            match = re.search(r"from\s+([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)", query, re.IGNORECASE)
            if match:
                src, dst = match.group(1), match.group(2)
                response_text = list_trains_tool(db, src, dst)
                action_taken = True
            else:
                response_text = "Which stations are you traveling between? E.g., 'Find trains from Bengaluru to Tumkur'."
                
        elif "my booking" in query_lower or "my ticket" in query_lower or "show booking" in query_lower or "view ticket" in query_lower:
            response_text = get_my_bookings_tool(db, current_user)
            action_taken = True
            
        elif "availab" in query_lower or "seat vacancy" in query_lower:
            # Look for a UUID in query
            import re
            match = re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", query_lower)
            if match:
                response_text = check_seat_availability_tool(db, match.group(0))
                action_taken = True
            else:
                response_text = "To check seat availability, please specify the Train ID. E.g., 'Check availability for train [Train-ID]'."
                
        elif "book" in query_lower:
            import re
            match_uuid = re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", query_lower)
            match_route = re.search(r"from\s+([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)", query, re.IGNORECASE)
            
            if match_uuid and match_route:
                train_id = match_uuid.group(0)
                src, dst = match_route.group(1), match_route.group(2)
                response_text = book_seat_tool(db, current_user, train_id, src, dst)
                action_taken = True
            else:
                response_text = "To book a seat, please specify the Train ID, source and destination stations. E.g., 'Book ticket for train [Train-ID] from Bengaluru to Tumkur'."
                
        elif "cancel" in query_lower:
            import re
            match = re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", query_lower)
            if match:
                response_text = cancel_booking_tool(db, current_user, match.group(0))
                action_taken = True
            else:
                response_text = "To cancel your booking, please specify the Booking ID. E.g., 'Cancel booking [Booking-ID]'."
                
        if not action_taken:
            # Fall back to letting Gemini respond conversationally
            response = model.generate_content(prompt)
            response_text = response.text
            
        return ChatResponse(response=response_text, action_taken=action_taken)
        
    except Exception as e:
        print(f"❌ Gemini Chatbot failed: {str(e)}. Using mock fallback.")
        return handle_mock_chat(query, db, current_user)

def handle_mock_chat(query: str, db: Session, current_user: User) -> ChatResponse:
    query_lower = query.lower()
    action_taken = False
    reply = ""
    
    if "train" in query_lower and ("find" in query_lower or "list" in query_lower or "search" in query_lower):
        # find matching trains
        import re
        match = re.search(r"from\s+([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)", query, re.IGNORECASE)
        if match:
            reply = list_trains_tool(db, match.group(1), match.group(2))
            action_taken = True
        else:
            # list first 3 trains
            trains = db.query(Train).limit(3).all()
            res = ["Here are some available trains in the system:"]
            for t in trains:
                res.append(f"- {t.train_name} ({t.train_number}) | ID: {t.id} | Route: {t.source_station} -> {t.destination_station}")
            reply = "\n".join(res)
            
    elif "my booking" in query_lower or "my ticket" in query_lower or "show booking" in query_lower:
        reply = get_my_bookings_tool(db, current_user)
        action_taken = True
        
    elif "availab" in query_lower:
        train = db.query(Train).first()
        if train:
            reply = check_seat_availability_tool(db, str(train.id))
            action_taken = True
        else:
            reply = "No trains found in system to check availability."
            
    elif "book" in query_lower:
        train = db.query(Train).first()
        if train:
            reply = book_seat_tool(db, current_user, str(train.id), train.source_station, train.destination_station)
            action_taken = True
        else:
            reply = "Cannot book ticket: No trains available in system."
            
    elif "cancel" in query_lower:
        booking = db.query(Booking).filter(Booking.user_id == current_user.id, Booking.status == BookingStatus.CONFIRMED).first()
        if booking:
            reply = cancel_booking_tool(db, current_user, str(booking.id))
            action_taken = True
        else:
            reply = "You don't have any confirmed active bookings to cancel right now."
            
    else:
        # Conversational mock replies
        if "hi" in query_lower or "hello" in query_lower or "hey" in query_lower:
            reply = f"Hello {current_user.name}! I am your AI Seating Assistant. You can ask me to: \n- 'Find trains from Bengaluru to Tumkur'\n- 'Show my bookings'\n- 'Check availability'\n- 'Book a ticket'\n- 'Cancel my booking'"
        elif "priority" in query_lower or "tier" in query_lower:
            reply = f"Your seating priority tier is {current_user.priority.value}. Seniors are P1 (A-01 to A-32), Disabled are P2 (A-33 to A-64), Ladies are P3 (Coach B), and General are P4 (Coach C-F)."
        else:
            reply = "I understand! You can ask me to search trains, check availability, book, or cancel tickets."
            
    return ChatResponse(response=reply, action_taken=action_taken)
