"""
=============================================================================
🚆 TRAIN SEAT AI - ONE-CLICK APPLICATION LAUNCHER
=============================================================================
Run this file directly in VS Code (hit 'Run' or press F5) or via terminal:
    python app.py

Features:
- Auto-detects and activates the backend virtual environment if present.
- Auto-selects an available port (default 7860, Hugging Face compatible).
- Initializes the database and seeds train routes/coaches if empty.
- Serves both the complete React frontend SPA and FastAPI REST backend.
- Automatically opens the web application in your default web browser!
- 100% compatible with Hugging Face Spaces (runs python app.py on port 7860).
=============================================================================
"""

import os
import sys
import time
import socket
import threading
import webbrowser

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Resolve project directories
CURRENT_DIR = os.path.abspath(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(CURRENT_DIR, "backend") if os.path.exists(os.path.join(CURRENT_DIR, "backend")) else CURRENT_DIR

# Auto-re-execute with backend virtualenv python if running outside the venv
venv_candidates = [
    os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe"),
    os.path.join(BACKEND_DIR, "venv", "bin", "python"),
    os.path.join(CURRENT_DIR, "venv", "Scripts", "python.exe"),
    os.path.join(CURRENT_DIR, "venv", "bin", "python"),
]
venv_python = next((p for p in venv_candidates if os.path.exists(p)), None)
if venv_python and os.path.normcase(os.path.abspath(sys.executable)) != os.path.normcase(os.path.abspath(venv_python)):
    import subprocess
    print(f"[*] Activating project virtual environment: {venv_python}", flush=True)
    result = subprocess.run([venv_python, os.path.abspath(__file__)] + sys.argv[1:])
    sys.exit(result.returncode)

# Add backend to sys.path and set working directory
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

from main import app  # FastAPI unified app

def get_free_port(default: int = 7860) -> int:
    """Check if the default port is free; if not, find the next available port."""
    env_port = os.environ.get("PORT")
    if env_port:
        return int(env_port)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", default)) != 0:
            return default
    for p in range(default + 1, default + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                print(f"[*] Port {default} is currently in use; switched to available port {p}", flush=True)
                return p
    return default

PORT = get_free_port(7860)
HOST = "0.0.0.0"
APP_URL = f"http://localhost:{PORT}/login"
DOCS_URL = f"http://localhost:{PORT}/docs"


def open_browser_delayed(url: str, delay: float = 1.8):
    """Wait for uvicorn to bind and start, then open the default browser."""
    time.sleep(delay)
    try:
        print(f"\n[*] Opening browser at: {url}\n", flush=True)
        webbrowser.open_new_tab(url)
    except Exception as err:
        print(f"Notice: Could not automatically open browser ({err}). Please open manually: {url}", flush=True)


def print_banner():
    banner = f"""
======================================================================
  TRAIN SEAT AI - AUTONOMOUS ALLOCATION SYSTEM
======================================================================
  [+] Status:           Server Running
  [+] Web Application:  {APP_URL}
  [+] API Docs:         {DOCS_URL}
  [+] Mode:             Single Unified Server (Frontend + Backend)
======================================================================
  Opening web application in your browser automatically...
  (Press Ctrl + C in this terminal to stop the server)
======================================================================
"""
    print(banner, flush=True)


if __name__ == "__main__":
    # Launch browser opener thread
    threading.Thread(target=open_browser_delayed, args=(APP_URL,), daemon=True).start()

    # Print friendly launcher banner
    print_banner()

    # Start Uvicorn ASGI server
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
