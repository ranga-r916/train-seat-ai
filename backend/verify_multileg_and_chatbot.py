"""
Integration Verification for Multi-Leg Seating, Dynamic Pricing, and Chatbot
----------------------------------------------------------------------------
Verifies that:
- A single seat can be booked by different passengers on non-overlapping journey legs.
- Fares dynamically increase/decrease based on occupancy rates.
- Chatbot endpoint handles conversational queries and actions correctly.
"""
import sys
import os
from datetime import datetime, date, time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Force SQLite for test verification
os.environ["DATABASE_URL"] = "sqlite:///./test_multileg_db.db"

if os.path.exists("./test_multileg_db.db"):
    os.remove("./test_multileg_db.db")

from database import engine, SessionLocal, Base
from models import Train, Coach, Seat, User, Booking, CoachType, SeatStatus, SeatZone, PriorityLevel, BookingStatus
from routes.bookings import calculate_fare
from agents.seat_allocator import find_best_seat, TRAIN_ROUTES, is_seat_occupied_for_leg
from routes.chatbot import handle_mock_chat

# Initialize database
print("🛠️  Initializing test database...")
Base.metadata.create_all(bind=engine)
db = SessionLocal()

def run_tests():
    print("\n🟢 Step 1: Seeding Test Train & Route...")
    train = Train(
        train_number="KSR-101",
        train_name="Bengaluru City Local",
        source_station="KSR Bengaluru",
        destination_station="Tumkur",
        departure_time=time(7, 30),
        arrival_time=time(9, 0),
        is_active=True
    )
    db.add(train)
    db.flush()
    
    coach = Coach(
        train_id=train.id,
        coach_number="C",
        coach_type=CoachType.GENERAL,
        total_seats=8
    )
    db.add(coach)
    db.flush()
    
    # Create 8 seats
    seats = []
    for i in range(1, 9):
        s = Seat(
            coach_id=coach.id,
            seat_number=f"C-0{i}",
            row_number=1,
            seat_zone=SeatZone.GENERAL,
            status=SeatStatus.AVAILABLE
        )
        db.add(s)
        seats.append(s)
    db.commit()
    print("✅ Seed complete! Train KSR-101 (Route: Bengaluru -> Yesvantpur -> Chikbanavar -> Nelamangala -> Kunigal -> Tumkur) created with 8 seats.")

    # Users
    u1 = User(name="User A", email="usera@gmail.com", mobile="9000000010", hashed_password="pw", priority=PriorityLevel.P4_GENERAL, aadhaar_verified=True)
    u2 = User(name="User B", email="userb@gmail.com", mobile="9000000011", hashed_password="pw", priority=PriorityLevel.P4_GENERAL, aadhaar_verified=True)
    db.add(u1)
    db.add(u2)
    db.commit()

    print("\n🟢 Step 2: Testing Multi-Leg Seat Allocation...")
    # Passenger A books Bengaluru -> Nelamangala
    seat_a = find_best_seat(u1.priority, str(train.id), db, "KSR Bengaluru", "Nelamangala")
    print(f"   - Passenger A booked KSR Bengaluru -> Nelamangala. Allocated Seat: {seat_a.seat_number}")
    assert seat_a.seat_number == "C-01"
    
    booking_a = Booking(
        user_id=u1.id,
        train_id=train.id,
        seat_id=seat_a.id,
        journey_date=date.today(),
        source_station="KSR Bengaluru",
        destination_station="Nelamangala",
        status=BookingStatus.CONFIRMED
    )
    db.add(booking_a)
    db.commit()
    
    # Seat C-01 should be occupied for Bengaluru -> Nelamangala
    assert is_seat_occupied_for_leg(seat_a, db, "KSR Bengaluru", "Nelamangala") == True
    # Seat C-01 should NOT be occupied for Nelamangala -> Tumkur (non-overlapping leg)
    assert is_seat_occupied_for_leg(seat_a, db, "Nelamangala", "Tumkur") == False
    print("✅ Seat leg-wise occupancy status successfully validated!")

    # Passenger B books Nelamangala -> Tumkur.
    # AI Seat Allocator should successfully re-allocate the SAME seat C-01 because the legs do not overlap!
    seat_b = find_best_seat(u2.priority, str(train.id), db, "Nelamangala", "Tumkur")
    print(f"   - Passenger B books Nelamangala -> Tumkur. Allocated Seat: {seat_b.seat_number}")
    assert seat_b.id == seat_a.id
    print("✅ Leg-wise seat reuse/optimization validated successfully!")

    print("\n🟢 Step 3: Testing Dynamic Surge Pricing...")
    # Base fare for Bengaluru -> Tumkur (70 km) is 140.0, but with <20% occupancy a 10% discount is applied (₹126.0)
    fare_base = calculate_fare("KSR Bengaluru", "Tumkur", u1.priority.value, "SL", train.id, db)
    print(f"   - Fare at low occupancy (0.9x Discount): ₹{fare_base}")
    assert fare_base == 126.0
    
    # Fill 6 out of 8 seats (75% occupancy) to trigger 1.2x surge
    for s in seats[:6]:
        s.status = SeatStatus.BOOKED
    db.commit()
    
    fare_surged = calculate_fare("KSR Bengaluru", "Tumkur", u1.priority.value, "SL", train.id, db)
    print(f"   - Fare at 75% occupancy (1.2x Surge): ₹{fare_surged}")
    assert fare_surged == 168.0 # 140 * 1.2 = 168.0
    print("✅ Dynamic occupancy-based pricing validated successfully!")

    print("\n🟢 Step 4: Testing Conversational Chatbot Mock Router...")
    # Check chatbot listing trains
    res = handle_mock_chat("Find trains from Bengaluru to Tumkur", db, u1)
    print(f"   - Chatbot query: 'Find trains from Bengaluru to Tumkur'")
    print(f"   - Chatbot reply: {res.response}")
    assert "Bengaluru City Local" in res.response
    
    # Check chatbot active bookings
    res_b = handle_mock_chat("Show my bookings", db, u1)
    print(f"   - Chatbot query: 'Show my bookings'")
    print(f"   - Chatbot reply: {res_b.response}")
    assert "Booking ID" in res_b.response
    print("✅ Chatbot endpoint query and tool execution validated successfully!")

    print("\n🎉 ALL custom RouteIQ features validated successfully!")

if __name__ == "__main__":
    try:
        run_tests()
    finally:
        db.close()
        engine.dispose()
        if os.path.exists("./test_multileg_db.db"):
            os.remove("./test_multileg_db.db")
