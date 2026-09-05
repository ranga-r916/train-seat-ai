from sqlalchemy import Column, String, Float, ForeignKey, Enum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from database import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"     # Order created, user hasn't paid yet
    SUCCESS = "SUCCESS"     # Payment received
    FAILED = "FAILED"       # Payment failed or timed out
    REFUNDED = "REFUNDED"   # Cancelled booking — money returned


class PaymentMethod(str, enum.Enum):
    UPI = "UPI"
    CARD = "CARD"
    NET_BANKING = "NET_BANKING"
    WALLET = "WALLET"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)

    # Amount
    amount = Column(Float, nullable=False)          # in INR
    currency = Column(String(5), default="INR")

    # Razorpay details
    razorpay_order_id = Column(String(200), nullable=True)    # from Razorpay
    razorpay_payment_id = Column(String(200), nullable=True)  # after success
    razorpay_signature = Column(String(500), nullable=True)   # for verification

    # Payment state
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    method = Column(Enum(PaymentMethod), nullable=True)

    paid_at = Column(DateTime(timezone=True), nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    booking = relationship("Booking", back_populates="payment")

    def __repr__(self):
        return f"<Payment ₹{self.amount} | {self.status}>"
