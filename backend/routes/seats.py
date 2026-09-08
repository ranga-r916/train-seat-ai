import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime, timedelta

from database import get_db
from models.user import User, PriorityLevel
from models.seat import Seat, SeatStatus, SeatZone
from models.coach import Coach, CoachType
from models.train import Train
from models.booking import Booking, BookingStatus
from utils.auth import get_current_user

router = APIRouter(prefix="/seats", tags=["Seats"])


class SeatResponse(BaseModel):
    id: str
    seat_number: str
    row_number: int
    seat_zone: str
    status: str
    coach_number: str
    coach_type: str

    class Config:
        from_attributes = True


def release_expired_locks(db: Session):
    """
    Self-healing lock release mechanism:
    Releases all seats stuck in LOCKED state for more than 3 minutes,
    marking their corresponding pending bookings as CANCELLED.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=3)
    expired_seats = db.query(Seat).filter(
        Seat.status == SeatStatus.LOCKED,
        Seat.locked_at < cutoff
    ).all()

    for s in expired_seats:
        s.status = SeatStatus.AVAILABLE
        s.locked_at = None
        
        # Cancel corresponding pending booking
        booking = db.query(Booking).filter(
            Booking.seat_id == s.id,
            Booking.status == BookingStatus.PENDING
        ).first()
        if booking:
            booking.status = BookingStatus.CANCELLED
            
    if expired_seats:
        db.commit()
        print(f"🔒 Released {len(expired_seats)} expired seat locks.")


@router.post("/release-expired-locks")
def release_locks(db: Session = Depends(get_db)):
    """Manually/programmatically trigger release of expired locks."""
    release_expired_locks(db)
    return {"message": "Expired seat locks released successfully"}


@router.get("/trains")
def get_trains(db: Session = Depends(get_db)):
    """Get all active trains in the system."""
    trains = db.query(Train).filter(Train.is_active == True).all()
    return [{
        "id": str(t.id),
        "train_number": t.train_number,
        "train_name": t.train_name,
        "source": t.source_station,
        "dest": t.destination_station,
        "source_station": t.source_station,
        "destination_station": t.destination_station,
        "departure_time": t.departure_time.strftime("%H:%M") if t.departure_time else None,
        "arrival_time": t.arrival_time.strftime("%H:%M") if t.arrival_time else None
    } for t in trains]


@router.get("/available/{train_id}", response_model=List[SeatResponse])
def get_available_seats(
    train_id: str,
    coach: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all available seats for a train, optionally filtered by coach."""
    # Self-heal expired locks before querying
    release_expired_locks(db)

    try:
        t_uuid = uuid.UUID(str(train_id))
    except Exception:
        t_uuid = train_id

    query = db.query(Seat).join(Coach).filter(
        Coach.train_id == t_uuid,
        Seat.status == SeatStatus.AVAILABLE
    )
    if coach:
        query = query.filter(Coach.coach_number == coach.upper())

    seats = query.all()
    result = []
    for s in seats:
        result.append(SeatResponse(
            id=str(s.id),
            seat_number=s.seat_number,
            row_number=s.row_number,
            seat_zone=s.seat_zone.value,
            status=s.status.value,
            coach_number=s.coach.coach_number,
            coach_type=s.coach.coach_type.value,
        ))
    return result


@router.get("/map/{train_id}")
def get_seat_map(train_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get full seat map grouped by coach — used for the dashboard seat grid."""
    # Self-heal expired locks before returning map
    release_expired_locks(db)

    try:
        t_uuid = uuid.UUID(str(train_id))
    except Exception:
        t_uuid = train_id

    coaches = db.query(Coach).filter(Coach.train_id == t_uuid).order_by(Coach.coach_number).all()
    result = []
    for c in coaches:
        seats = db.query(Seat).filter(Seat.coach_id == c.id).order_by(Seat.seat_number).all()
        result.append({
            "coach": c.coach_number,
            "coach_type": c.coach_type.value,
            "total": c.total_seats,
            "available": sum(1 for s in seats if s.status == SeatStatus.AVAILABLE),
            "booked": sum(1 for s in seats if s.status == SeatStatus.BOOKED),
            "occupied": sum(1 for s in seats if s.status == SeatStatus.OCCUPIED),
            "seats": [{"id": str(s.id), "number": s.seat_number, "status": s.status.value, "zone": s.seat_zone.value} for s in seats]
        })
    return result