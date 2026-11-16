"""Vercel serverless entry point.

Vercel runs this file as a Python function and rewrites every /api/* request
to it (see vercel.json). The FastAPI app is the same one used locally, served
under the /api prefix.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("API_PREFIX", "/api")

from backend.app.main import app  # noqa: E402,F401  (Vercel looks for `app`)
