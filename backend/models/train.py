from sqlalchemy import Column, String, Time, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from database import Base


class Train(Base):
    __tablename__ = "trains"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    train_number = Column(String(20), unique=True, nullable=False)  # e.g. "KSR-101"
    train_name = Column(String(100), nullable=False)                 # e.g. "Bengaluru Local"
    source_station = Column(String(100), nullable=False)             # e.g. "KSR Bengaluru"
    destination_station = Column(String(100), nullable=False)        # e.g. "Tumkur"

    departure_time = Column(Time, nullable=False)
    arrival_time = Column(Time, nullable=False)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    coaches = relationship("Coach", back_populates="train", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="train")

    def __repr__(self):
        return f"<Train {self.train_number} | {self.source_station} → {self.destination_station}>"
