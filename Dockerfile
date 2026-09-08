# =======================================================
# Stage 1: Build Frontend React SPA
# =======================================================
FROM node:20-slim AS frontend-builder
WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# =======================================================
# Stage 2: Python FastAPI Backend & Unified Server
# =======================================================
FROM python:3.11-slim
WORKDIR /app

# Install system libraries for ZBar (QR barcode reader) and OpenCV/RapidOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libzbar0 \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/ ./

# Copy compiled frontend from Stage 1 into /app/dist
COPY --from=frontend-builder /frontend/dist ./dist

# Hugging Face Spaces runs with user 1000 by default
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Port compatibility for Render ($PORT=10000) and Hugging Face ($PORT=7860)
ENV PORT=10000
ENV PYTHONUNBUFFERED=1
EXPOSE 10000
EXPOSE 7860

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
