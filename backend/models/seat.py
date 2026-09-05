from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, Enum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from database import Base


class SeatStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"    # Free to book
    LOCKED = "LOCKED"          # Held during payment (3-min window)
    BOOKED = "BOOKED"          # Payment confirmed, not yet scanned
    OCCUPIED = "OCCUPIED"      # Passenger scanned entry QR
    VACANT = "VACANT"          # Passenger scanned exit QR — will reset to AVAILABLE


class SeatZone(str, enum.Enum):
    PRIORITY_1_2 = "PRIORITY_1_2"   # Rows 1–4 in Coach A (seniors + disabled)
    PRIORITY_3 = "PRIORITY_3"       # Coach B (ladies)
    GENERAL = "GENERAL"             # Coach C–F


class Seat(Base):
    __tablename__ = "seats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    coach_id = Column(UUID(as_uuid=True), ForeignKey("coaches.id"), nullable=False)
    seat_number = Column(String(10), nullable=False)     # "A-01", "B-12" etc.
    row_number = Column(Integer, nullable=False)
    seat_zone = Column(Enum(SeatZone), nullable=False)
    status = Column(Enum(SeatStatus), default=SeatStatus.AVAILABLE, nullable=False)

    # When was the seat locked? Used to auto-release after 3 minutes
    locked_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    coach = relationship("Coach", back_populates="seats")
    bookings = relationship("Booking", back_populates="seat")

    def __repr__(self):
        return f"<Seat {self.seat_number} | {self.status}>"
