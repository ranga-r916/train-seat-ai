from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

DATABASE_URL = settings.DATABASE_URL

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    try:
        engine = create_engine(DATABASE_URL)
        # Test connection
        with engine.connect():
            pass
    except Exception as e:
        print(f"⚠️ PostgreSQL connection failed ({e}). Falling back to embedded SQLite database for zero-config operation.")
        DATABASE_URL = "sqlite:///./train_allocation.db"
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

Base = declarative_base()

# Dependency — use this in every FastAPI route
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
