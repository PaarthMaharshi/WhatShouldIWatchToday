"""Mood match endpoints: picker options and mood-based recommendations."""
from fastapi import APIRouter, HTTPException, Request

from backend.app import db
from backend.app.schemas import MoodIn
from ml import mood as mood_lib

router = APIRouter(prefix="/mood", tags=["mood"])


@router.get("/options")
def options():
    return mood_lib.options()


@router.post("")
def recommend(body: MoodIn, request: Request):
    catalog, rec = request.app.state.catalog, request.app.state.rec
    bad = [g for g in body.genres if g not in catalog.genres]
    if bad:
        raise HTTPException(422, f"Unknown genres: {bad}")
    query = mood_lib.MoodQuery(mood=body.mood, genres=body.genres, company=body.company,
                               era=body.era, runtime=body.runtime, discovery=body.discovery,
                               text=body.text)
    try:
        mood_lib.validate(query)
    except ValueError as e:
        raise HTTPException(422, str(e))
    ratings, ml_idx = None, None
    if body.user_id is not None:
        user = db.get_user(body.user_id)
        if user:
            ratings, ml_idx = db.get_ratings(body.user_id), user["ml_user_idx"]
    return rec.mood(query, body.k, ratings, ml_idx)
