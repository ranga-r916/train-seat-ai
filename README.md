---
title: Train Seat AI
emoji: 🚆
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# 🚆 Train Seat AI: Autonomous Priority Seat Allocation System

An autonomous, multi-agent AI train ticketing and real-time seating allocation platform built for Indian Railways commuter networks.

## 🌟 Key Features
- **Aadhaar Identity Scanner**: Rapid OCR & Barcode reader supporting both physical cards and e-Aadhaar PDF documents.
- **Strict Identity Mismatch Protection**: Verifies passenger name against uploaded card to prevent unauthorized uploads.
- **Dynamic Seating Priority Engine**: Auto-allocates optimal berths (Senior Citizens lower berth guarantee, Divyangjan accessible coaches, dedicated women safety coaches, and general commuter seats).
- **Contactless Turnstile Gate Transit**: QR code check-in & check-out that auto-updates train vacancy in real-time.
- **Official ERS Ticket PDF Download**: Downloadable Indian Railways electronic reservation slips with embedded QR gate passes.
- **AI Commuter Chatbot**: Instant NLP booking, status lookup, and assistance.

## 🛠️ Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons
- **Backend**: FastAPI, Python 3.11, SQLAlchemy, Uvicorn
- **AI / Computer Vision**: RapidOCR, PyZBar, PyPDFium2, ReportLab
