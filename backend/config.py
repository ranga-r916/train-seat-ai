from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/train_seat_db"

    # JWT
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Google Vision API (for Aadhaar OCR)
    GOOGLE_APPLICATION_CREDENTIALS: str = "credentials.json"

    # Gemini AI
    GEMINI_API_KEY: str = "your-gemini-api-key"

    # Razorpay (test mode)
    RAZORPAY_KEY_ID: str = "your-razorpay-key-id"
    RAZORPAY_KEY_SECRET: str = "your-razorpay-key-secret"

    # App
    APP_NAME: str = "Train Seat AI"
    DEBUG: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
