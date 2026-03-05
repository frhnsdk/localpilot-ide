"""
LocalPilot IDE – FastAPI entry point.
Serves the API and the static frontend.
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from routers import files, chat, completion
from config import FRONTEND_DIR

app = FastAPI(title="LocalPilot IDE", version="1.0.0")

# CORS – wide-open for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(files.router)
app.include_router(chat.router)
app.include_router(completion.router)

# Serve frontend as static files (mounted last so API routes take priority)
import os
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
