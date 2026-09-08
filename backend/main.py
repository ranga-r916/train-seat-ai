import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import engine, Base, SessionLocal

import models
from routes.auth import router as auth_router
from routes.seats import router as seats_router
from routes.bookings import router as bookings_router
from routes.payments import router as payments_router
from routes.admin import router as admin_router
from routes.chatbot import router as chatbot_router

app = FastAPI(
    title="Train Seat AI",
    description="Autonomous AI agent for train seat allocation",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(auth_router)
app.include_router(seats_router)
app.include_router(bookings_router)
app.include_router(payments_router)
app.include_router(admin_router)
app.include_router(chatbot_router)

@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)
    print("[+] All database tables verified successfully")
    
    # Auto-seed database if empty (ensures zero-config cloud deployment on Render and Hugging Face)
    try:
        from models.train import Train
        db = SessionLocal()
        train_count = db.query(Train).count()
        if train_count == 0:
            print("[+] Fresh database detected on startup. Seeding official train routes and coach layouts...")
            try:
                from seed import seed
                seed(db)
            except Exception as e:
                print(f"Seed warning: {e}")
            try:
                from seed_all_india_trains import seed_all_india_trains
                seed_all_india_trains(db)
            except Exception as e:
                print(f"All-India trains seed warning: {e}")
            print("[+] Auto-seeding complete!")
        db.close()
    except Exception as e:
        print(f"Startup check warning: {e}")

@app.get("/health")
def health():
    return {"status": "ok", "service": "Train Seat AI"}

# Mount frontend dist directory if available (for unified single-container deployment)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
dist_path = os.path.join(BASE_DIR, "dist")
if not os.path.exists(dist_path):
    dist_path = os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist")

if os.path.exists(dist_path):
    assets_path = os.path.join(dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Do not intercept API namespace routes or docs
        if full_path.startswith(("auth", "seats", "bookings", "payments", "admin", "chatbot", "api", "docs", "openapi.json", "health")):
            return None
        candidate = os.path.join(dist_path, full_path)
        if full_path and os.path.exists(candidate) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(dist_path, "index.html"))
else:
    @app.get("/")
    def root():
        return {"message": "Train Seat AI API is running"}