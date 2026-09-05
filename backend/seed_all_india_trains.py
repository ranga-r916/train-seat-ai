from database import SessionLocal
from models import Train, Coach, Seat, CoachType, SeatStatus, SeatZone
from datetime import time

db = SessionLocal()

print("Seeding All-India Trains...")

trains_config = [
    {
        "number": "NDLS-12952",
        "name": "Mumbai Rajdhani Express",
        "source": "New Delhi",
        "dest": "Mumbai Central",
        "dep_time": time(16, 55),
        "arr_time": time(8, 35)
    },
    {
        "number": "HWH-12302",
        "name": "Howrah Rajdhani Express",
        "source": "New Delhi",
        "dest": "Howrah Junction",
        "dep_time": time(16, 50),
        "arr_time": time(9, 55)
    },
    {
        "number": "SBC-12628",
        "name": "Karnataka Express",
        "source": "New Delhi",
        "dest": "KSR Bengaluru",
        "dep_time": time(20, 15),
        "arr_time": time(12, 0)
    },
    {
        "number": "LTT-12163",
        "name": "Mumbai Chennai Express",
        "source": "Mumbai Central",
        "dest": "Chennai Central",
        "dep_time": time(18, 45),
        "arr_time": time(16, 30)
    },
    {
        "number": "MAS-12842",
        "name": "Coromandel Express",
        "source": "Howrah Junction",
        "dest": "Chennai Central",
        "dep_time": time(13, 50),
        "arr_time": time(17, 0)
    }
]

coach_config = [
    ("A", CoachType.SENIOR_DISABLED, 64),
    ("B", CoachType.LADIES, 64),
    ("C", CoachType.GENERAL, 72),
    ("D", CoachType.GENERAL, 72),
    ("E", CoachType.GENERAL, 72),
    ("F", CoachType.GENERAL, 72),
]

for t_info in trains_config:
    # Check if train already exists to avoid duplicates
    existing = db.query(Train).filter(Train.train_number == t_info["number"]).first()
    if existing:
        print(f"Train {t_info['number']} already exists. Skipping.")
        continue

    train = Train(
        train_number=t_info["number"],
        train_name=t_info["name"],
        source_station=t_info["source"],
        destination_station=t_info["dest"],
        departure_time=t_info["dep_time"],
        arrival_time=t_info["arr_time"],
        is_active=True
    )
    db.add(train)
    db.flush()

    print(f"Creating coaches and seats for Train {train.train_number}...")
    for coach_letter, coach_type, total_seats in coach_config:
        coach = Coach(
            train_id=train.id,
            coach_number=coach_letter,
            coach_type=coach_type,
            total_seats=total_seats
        )
        db.add(coach)
        db.flush()

        for i in range(1, total_seats + 1):
            seat_number = f"{coach_letter}-{i:02d}"
            row_number = (i - 1) // 8 + 1  # 8 seats per row

            # Determine zone
            if coach_letter == "A" and row_number <= 4:
                zone = SeatZone.PRIORITY_1_2   # rows 1–4 for seniors + disabled
            elif coach_letter == "B":
                zone = SeatZone.PRIORITY_3     # entire Coach B for ladies
            else:
                zone = SeatZone.GENERAL

            seat = Seat(
                coach_id=coach.id,
                seat_number=seat_number,
                row_number=row_number,
                seat_zone=zone,
                status=SeatStatus.AVAILABLE
            )
            db.add(seat)

db.commit()
db.close()
print("✅ Database seeding complete for All-India Trains!")
