"""
Run this once after setting up the DB:
    python seed.py

Creates: 10 trains, 60 coaches, 4160 seats total
"""
from database import SessionLocal, engine, Base
import models
from models import Train, Coach, Seat, CoachType, SeatStatus, SeatZone
import uuid
from datetime import time

# Ensure tables are created
Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("Seeding database with multiple trains...")

# 1. Train configurations (10 popular routes)
trains_config = [
    # Route 1: Bengaluru - Tumkur
    {
        "number": "KSR-101",
        "name": "Bengaluru City Local",
        "source": "KSR Bengaluru",
        "dest": "Tumkur",
        "dep_time": time(7, 30),
        "arr_time": time(9, 0)
    },
    {
        "number": "SBC-12629",
        "name": "Karnataka Sampark Kranti",
        "source": "KSR Bengaluru",
        "dest": "Tumkur",
        "dep_time": time(13, 50),
        "arr_time": time(14, 55)
    },
    {
        "number": "KPG-22691",
        "name": "Rajdhani Express",
        "source": "KSR Bengaluru",
        "dest": "Tumkur",
        "dep_time": time(20, 0),
        "arr_time": time(21, 10)
    },
    
    # Route 2: Bengaluru - Mysuru
    {
        "number": "SHT-12008",
        "name": "Mysuru Shatabdi Express",
        "source": "KSR Bengaluru",
        "dest": "Mysuru Junction",
        "dep_time": time(11, 0),
        "arr_time": time(13, 0)
    },
    {
        "number": "MYS-16231",
        "name": "Mayiladuturai Express",
        "source": "Mysuru Junction",
        "dest": "KSR Bengaluru",
        "dep_time": time(5, 45),
        "arr_time": time(8, 0)
    },

    # Route 3: Chennai - Bengaluru
    {
        "number": "MAS-12608",
        "name": "Lalbagh Express",
        "source": "Chennai Central",
        "dest": "KSR Bengaluru",
        "dep_time": time(15, 30),
        "arr_time": time(21, 15)
    },
    {
        "number": "MAS-12639",
        "name": "Brindavan Express",
        "source": "Chennai Central",
        "dest": "KSR Bengaluru",
        "dep_time": time(7, 40),
        "arr_time": time(13, 45)
    },
    {
        "number": "SBC-12657",
        "name": "Chennai Mail",
        "source": "KSR Bengaluru",
        "dest": "Chennai Central",
        "dep_time": time(22, 40),
        "arr_time": time(4, 45)
    },

    # Route 4: Chennai - Bengaluru - Mysuru Combo
    {
        "number": "MYS-12007",
        "name": "Chennai Mysuru Shatabdi",
        "source": "Chennai Central",
        "dest": "Mysuru Junction",
        "dep_time": time(6, 0),
        "arr_time": time(13, 0)
    },
    {
        "number": "MAS-20607",
        "name": "Mysuru Vande Bharat Express",
        "source": "Chennai Central",
        "dest": "Mysuru Junction",
        "dep_time": time(5, 50),
        "arr_time": time(12, 20)
    }
]

# Coach configuration per train
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
print("✅ Database seeding complete!")
