from sqlalchemy import Column, String, Date, ForeignKey, Enum, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from database import Base


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"         # Seat locked, awaiting payment
    CONFIRMED = "CONFIRMED"     # Payment done, QR generated
    CANCELLED = "CANCELLED"     # Cancelled by passenger or admin
    COMPLETED = "COMPLETED"     # Journey done — passenger exited


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Who is booking
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Which train + seat
    train_id = Column(UUID(as_uuid=True), ForeignKey("trains.id"), nullable=False)
    seat_id = Column(UUID(as_uuid=True), ForeignKey("seats.id"), nullable=True)

    # Journey details
    journey_date = Column(Date, nullable=False)
    source_station = Column(String(100), nullable=False)
    destination_station = Column(String(100), nullable=False)

    # Booking state
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING, nullable=False)

    # QR code (stored as a string path or base64)
    qr_code = Column(String, nullable=True)

    # Journey tracking
    entry_scanned_at = Column(DateTime(timezone=True), nullable=True)
    exit_scanned_at = Column(DateTime(timezone=True), nullable=True)

    # Is this an emergency/conditional booking?
    is_emergency = Column(Boolean, default=False)

    # Waitlist position (null = not on waitlist)
    waitlist_position = Column(String(10), nullable=True)
    family_booking_id = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="bookings")
    train = relationship("Train", back_populates="bookings")
    seat = relationship("Seat", back_populates="bookings")
    payment = relationship("Payment", back_populates="booking", uselist=False)

    def __repr__(self):
        return f"<Booking {self.id} | {self.status} | Seat {self.seat_id}>"
