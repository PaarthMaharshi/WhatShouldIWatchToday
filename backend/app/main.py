"""FastAPI app.

Run from the project root:
    uvicorn backend.app.main:app --reload --port 8000
Interactive docs at http://localhost:8000/docs

On Vercel the same app runs as a serverless function (see api/index.py) with
API_PREFIX=/api, so every route lives under /api/... next to the static site.
"""
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app import db
from backend.app.routers import forum, mood, movies, recs, users
from backend.app.services.catalog import Catalog
from backend.app.services.recommender import RecommenderService

ROOT = Path(__file__).resolve().parents[2]
PLOTS = ROOT / "artifacts" / "plots"
PREFIX = os.getenv("API_PREFIX", "").rstrip("/")
load_dotenv(ROOT / ".env")

_init_lock = threading.Lock()


def init_state(app: FastAPI):
    """Load the catalogue and the offline-trained models once per process.

    Called at startup and, as a fallback, on the first request: serverless
    platforms do not always run ASGI startup events.
    """
    if getattr(app.state, "rec", None) is not None:
        return
    with _init_lock:
        if getattr(app.state, "rec", None) is not None:
            return
        db.init_db()
        catalog = Catalog()
        app.state.catalog = catalog
        app.state.rec = RecommenderService(catalog)
        app.state.plots_dir = PLOTS


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_state(app)
    yield


app = FastAPI(title="WhatShouldIWatchToday API", version="1.0", lifespan=lifespan,
              docs_url=f"{PREFIX}/docs", openapi_url=f"{PREFIX}/openapi.json", redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def ensure_loaded(request: Request, call_next):
    init_state(request.app)
    return await call_next(request)


if PLOTS.exists():
    app.mount(f"{PREFIX}/plots", StaticFiles(directory=PLOTS), name="plots")
app.include_router(movies.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(recs.router, prefix=PREFIX)
app.include_router(mood.router, prefix=PREFIX)
app.include_router(forum.router, prefix=PREFIX)


@app.get(f"{PREFIX}/health")
def health():
    # "database" lets you confirm a deployment really uses the permanent
    # PostgreSQL database (SQLite on a serverless host is wiped regularly).
    return {"status": "ok", "tmdb_key": bool(os.getenv("TMDB_API_KEY")),
            "database": "postgresql" if db.IS_POSTGRES else "sqlite"}
