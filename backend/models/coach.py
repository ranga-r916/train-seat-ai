from sqlalchemy import Column, String, Integer, ForeignKey, Enum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from database import Base


class CoachType(str, enum.Enum):
    SENIOR_DISABLED = "SENIOR_DISABLED"  # Coach A — P1 + P2 priority passengers
    LADIES = "LADIES"                    # Coach B — women only
    GENERAL = "GENERAL"                  # Coach C–F — all passengers


class Coach(Base):
    __tablename__ = "coaches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    train_id = Column(UUID(as_uuid=True), ForeignKey("trains.id"), nullable=False)
    coach_number = Column(String(5), nullable=False)   # "A", "B", "C" etc.
    coach_type = Column(Enum(CoachType), nullable=False)
    total_seats = Column(Integer, nullable=False)       # 64 or 72

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    train = relationship("Train", back_populates="coaches")
    seats = relationship("Seat", back_populates="coach", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Coach {self.coach_number} | {self.coach_type} | {self.total_seats} seats>"
