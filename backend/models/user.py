from sqlalchemy import Column, String, Integer, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from database import Base


class PriorityLevel(str, enum.Enum):
    P1_SENIOR = "P1_SENIOR"          # Age >= 60 — highest priority
    P2_DISABLED = "P2_DISABLED"      # Persons with disabilities
    P3_FEMALE = "P3_FEMALE"          # Women
    P4_GENERAL = "P4_GENERAL"        # General male passengers
    P5_FAMILY = "P5_FAMILY"          # Family group bookings


class UserRole(str, enum.Enum):
    PASSENGER = "passenger"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Basic info (entered during registration)
    name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    mobile = Column(String(15), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.PASSENGER)

    # Aadhaar-verified fields (filled by OCR agent)
    aadhaar_number_hash = Column(String(255), nullable=True)  # store hash only, never raw
    verified_name = Column(String(100), nullable=True)
    verified_age = Column(Integer, nullable=True)
    verified_gender = Column(String(10), nullable=True)       # Male / Female / Other
    is_disabled = Column(Boolean, default=False)
    aadhaar_verified = Column(Boolean, default=False)
    is_flagged_for_review = Column(Boolean, default=False)
    is_blocked = Column(Boolean, default=False)

    # AI-assigned priority (set automatically after Aadhaar verification)
    priority = Column(Enum(PriorityLevel), default=PriorityLevel.P4_GENERAL)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    bookings = relationship("Booking", back_populates="user")

    def __repr__(self):
        return f"<User {self.name} | {self.priority}>"
