"""
AI Seat Allocator Agent (Multi-Leg Optimized)
-----------------------
Reads passenger priority and finds the best available seat automatically.
Supports leg-wise capacity allocation to maximize seat utilization across train routes.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import uuid
from datetime import datetime, date, timedelta
from models.seat import Seat, SeatStatus, SeatZone
from models.coach import Coach, CoachType
from models.user import PriorityLevel
from models.booking import Booking, BookingStatus

# Route Sequences mapped by official train numbers
TUMKUR_ROUTE = ["KSR Bengaluru", "Yesvantpur", "Chikbanavar", "Nelamangala", "Kunigal", "Tumkur"]
MYSURU_ROUTE = ["KSR Bengaluru", "Kengeri", "Bidadi", "Ramanagara", "Channapatna", "Maddur", "Mandya", "Srirangapatna", "Mysuru Junction"]
CHENNAI_ROUTE = ["KSR Bengaluru", "Krishnarajapuram", "Bangarapet", "Jolarpettai", "Katpadi", "Arakkonam", "Chennai Central"]
MUMBAI_DELHI_ROUTE = ["New Delhi", "Kota Junction", "Ratlam Junction", "Vadodara Junction", "Surat", "Mumbai Central"]
HOWRAH_DELHI_ROUTE = ["New Delhi", "Kanpur Central", "Prayagraj Junction", "Patna Junction", "Howrah Junction"]
DELHI_BLR_ROUTE = ["New Delhi", "Bhopal Junction", "Nagpur Junction", "Secunderabad Junction", "KSR Bengaluru"]
MUMBAI_CHENNAI_ROUTE = ["Mumbai Central", "Pune Junction", "Solapur", "Chennai Central"]
HOWRAH_CHENNAI_ROUTE = ["Howrah Junction", "Bhubaneswar", "Visakhapatnam", "Vijayawada", "Chennai Central"]

TRAIN_ROUTES = {
    # Tumkur route trains
    "12079": TUMKUR_ROUTE, "17326": TUMKUR_ROUTE, "16579": TUMKUR_ROUTE,
    "06571": TUMKUR_ROUTE, "17316": TUMKUR_ROUTE, "12725": TUMKUR_ROUTE,
    "06575": TUMKUR_ROUTE, "12629": TUMKUR_ROUTE, "17309": TUMKUR_ROUTE,
    "16535": TUMKUR_ROUTE, "16589": TUMKUR_ROUTE, "16227": TUMKUR_ROUTE,
    
    # Mysuru route trains
    "16021": MYSURU_ROUTE, "16231": MYSURU_ROUTE, "16591": MYSURU_ROUTE,
    "16235": MYSURU_ROUTE, "20607": MYSURU_ROUTE, "12007": MYSURU_ROUTE,
    "16558": MYSURU_ROUTE, "12976": MYSURU_ROUTE, "12614": MYSURU_ROUTE,
    "16216": MYSURU_ROUTE, "12609": MYSURU_ROUTE,
    
    # Chennai route trains
    "12608": CHENNAI_ROUTE, "12610": CHENNAI_ROUTE, "12578": CHENNAI_ROUTE,
    "22626": CHENNAI_ROUTE, "20608": CHENNAI_ROUTE, "12640": CHENNAI_ROUTE,
    "12008": CHENNAI_ROUTE, "12658": CHENNAI_ROUTE, "12692": CHENNAI_ROUTE,
    
    # All India routes
    "12628": DELHI_BLR_ROUTE, "22691": DELHI_BLR_ROUTE,
    "12952": MUMBAI_DELHI_ROUTE, "12302": HOWRAH_DELHI_ROUTE,
    "12163": MUMBAI_CHENNAI_ROUTE, "12842": HOWRAH_CHENNAI_ROUTE,
}

def is_coach_overcrowded(coach: Coach, db: Session) -> bool:
    """Overcrowding prevention: Check if coach capacity exceeds 95%."""
    total = coach.total_seats
    active_count = db.query(func.count(Seat.id)).filter(
        Seat.coach_id == coach.id,
        Seat.status.in_([SeatStatus.BOOKED, SeatStatus.OCCUPIED, SeatStatus.LOCKED])
    ).scalar()
    
    return active_count >= int(total * 0.95)

def is_seat_occupied_for_leg(seat: Seat, db: Session, source: str | None = None, dest: str | None = None) -> bool:
    """
    Checks if a seat is occupied for a specific leg of the journey.
    If no source/dest are provided, checks if the seat status is currently not AVAILABLE.
    """
    if seat.status == SeatStatus.LOCKED:
        return True  # LOCKED seats are in checkout process, completely blocked.
        
    if not source or not dest:
        return seat.status in [SeatStatus.BOOKED, SeatStatus.OCCUPIED]

    train = seat.coach.train
    route = TRAIN_ROUTES.get(train.train_number)
    if not route:
        return seat.status in [SeatStatus.BOOKED, SeatStatus.OCCUPIED]

    route_lower = [s.lower().strip() for s in route]
    src_lower = source.lower().strip()
    dst_lower = dest.lower().strip()

    if src_lower not in route_lower or dst_lower not in route_lower:
        return seat.status in [SeatStatus.BOOKED, SeatStatus.OCCUPIED]

    req_start = route_lower.index(src_lower)
    req_end = route_lower.index(dst_lower)
    if req_start > req_end:
        req_start, req_end = req_end, req_start

    # Query all active bookings for this seat
    bookings = db.query(Booking).filter(
        Booking.seat_id == seat.id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
    ).all()

    for b in bookings:
        b_src_lower = b.source_station.lower().strip()
        b_dst_lower = b.destination_station.lower().strip()
        if b_src_lower not in route_lower or b_dst_lower not in route_lower:
            return True # Overlap assumed if stations mismatch route
            
        b_start = route_lower.index(b_src_lower)
        b_end = route_lower.index(b_dst_lower)
        if b_start > b_end:
            b_start, b_end = b_end, b_start

        # Check interval overlap: req_start < b_end AND b_start < req_end
        if req_start < b_end and b_start < req_end:
            return True

    return False

def find_best_seat(user_priority: PriorityLevel, train_id: str, db: Session, source: str | None = None, dest: str | None = None) -> Seat | None:
    """
    AI Agent Seat Allocator: Given passenger priority and segment, find the best seat,
    respecting capacity checks and multi-leg utilization.
    """
    if isinstance(train_id, str):
        train_id = uuid.UUID(train_id)
        
    # Helper to find first available seat matching a filter query
    def select_first_available(query_filter) -> Seat | None:
        seats = db.query(Seat).filter(query_filter).order_by(Seat.row_number, Seat.seat_number).all()
        for s in seats:
            if not is_seat_occupied_for_leg(s, db, source, dest):
                return s
        return None

    # 1. P1 Senior Citizens (Coach A, rows 1-4)
    if user_priority == PriorityLevel.P1_SENIOR:
        coach_a = db.query(Coach).filter(Coach.train_id == train_id, Coach.coach_number == "A").first()
        if coach_a and not is_coach_overcrowded(coach_a, db):
            seat = select_first_available(and_(
                Seat.coach_id == coach_a.id,
                Seat.seat_zone == SeatZone.PRIORITY_1_2,
                Seat.row_number <= 4
            ))
            if seat:
                return seat
            
            # Fallback within Coach A (rows 5+)
            seat = select_first_available(Seat.coach_id == coach_a.id)
            if seat:
                return seat

        # Fallback to Coach B
        coach_b = db.query(Coach).filter(Coach.train_id == train_id, Coach.coach_number == "B").first()
        if coach_b and not is_coach_overcrowded(coach_b, db):
            seat = select_first_available(Seat.coach_id == coach_b.id)
            if seat:
                return seat

        # Fallback to General
        return _get_general_seat(train_id, db, source, dest)

    # 2. P2 Persons with Disabilities (Coach A, rows 5-8)
    elif user_priority == PriorityLevel.P2_DISABLED:
        coach_a = db.query(Coach).filter(Coach.train_id == train_id, Coach.coach_number == "A").first()
        if coach_a and not is_coach_overcrowded(coach_a, db):
            seat = select_first_available(and_(
                Seat.coach_id == coach_a.id,
                Seat.row_number >= 5
            ))
            if seat:
                return seat
            
            seat = select_first_available(Seat.coach_id == coach_a.id)
            if seat:
                return seat

        return _get_general_seat(train_id, db, source, dest)

    # 3. P3 Women (Coach B)
    elif user_priority == PriorityLevel.P3_FEMALE:
        coach_b = db.query(Coach).filter(Coach.train_id == train_id, Coach.coach_number == "B").first()
        if coach_b and not is_coach_overcrowded(coach_b, db):
            seat = select_first_available(Seat.coach_id == coach_b.id)
            if seat:
                return seat

        return _get_general_seat(train_id, db, source, dest)

    # 4. P4 General
    else:
        return _get_general_seat(train_id, db, source, dest)

def _get_general_seat(train_id: str, db: Session, source: str | None = None, dest: str | None = None) -> Seat | None:
    """Finds best available seat in general coaches checking overcrowding and leg occupancy."""
    if isinstance(train_id, str):
        train_id = uuid.UUID(train_id)
        
    for coach_letter in ["C", "D", "E", "F"]:
        coach = db.query(Coach).filter(Coach.train_id == train_id, Coach.coach_number == coach_letter).first()
        if coach and not is_coach_overcrowded(coach, db):
            seats = db.query(Seat).filter(Seat.coach_id == coach.id).order_by(Seat.row_number, Seat.seat_number).all()
            for s in seats:
                if not is_seat_occupied_for_leg(s, db, source, dest):
                    return s
                    
    # Absolute backup: try placing in Ladies (B) or Priority (A) if general is completely full
    for coach_letter in ["B", "A"]:
        coach = db.query(Coach).filter(Coach.train_id == train_id, Coach.coach_number == coach_letter).first()
        if coach and not is_coach_overcrowded(coach, db):
            seats = db.query(Seat).filter(Seat.coach_id == coach.id).order_by(Seat.row_number, Seat.seat_number).all()
            for s in seats:
                if not is_seat_occupied_for_leg(s, db, source, dest):
                    return s
                    
    return None

def find_adjacent_seats(train_id: str, num_seats: int, db: Session, source: str | None = None, dest: str | None = None) -> list[Seat] | None:
    """AI agent: Find adjacent seats in the same coach for a family group booking (P5)."""
    if isinstance(train_id, str):
        train_id = uuid.UUID(train_id)
        
    for coach_letter in ["C", "D", "E", "F", "B", "A"]:
        coach = db.query(Coach).filter(Coach.train_id == train_id, Coach.coach_number == coach_letter).first()
        if not coach or is_coach_overcrowded(coach, db):
            continue
            
        seats = db.query(Seat).filter(Seat.coach_id == coach.id).order_by(Seat.row_number, Seat.seat_number).all()
        available_seats = [s for s in seats if not is_seat_occupied_for_leg(s, db, source, dest)]
        
        if len(available_seats) < num_seats:
            continue
            
        # 1. Try to find seats in the exact same row
        seats_by_row = {}
        for seat in available_seats:
            seats_by_row.setdefault(seat.row_number, []).append(seat)
            
        for row_num, row_seats in sorted(seats_by_row.items()):
            if len(row_seats) >= num_seats:
                return row_seats[:num_seats]
                
        # 2. Try to find seats in adjacent rows
        return available_seats[:num_seats]
        
    return None

def check_no_shows(train_id: str, db: Session):
    """Emergency protocol: find BOOKED seats where passenger hasn't scanned entry."""
    if isinstance(train_id, str):
        train_id = uuid.UUID(train_id)
    cutoff = datetime.utcnow() - timedelta(minutes=15)
    no_shows = db.query(Booking).join(Seat).join(Coach).filter(
        Coach.train_id == train_id,
        Booking.status == BookingStatus.CONFIRMED,
        Booking.entry_scanned_at == None,
        Booking.created_at < cutoff
    ).all()
    return no_shows