"""Recommendations, ratings and the "Under the hood" model information."""
import math

from fastapi import APIRouter, HTTPException, Query, Request

from backend.app import db
from backend.app.routers.users import require_user
from backend.app.schemas import RatingIn

router = APIRouter(tags=["recommendations"])


def _recommend(request, user, model, k):
    try:
        return request.app.state.rec.recommend(
            db.get_ratings(user["id"]), model, k, user["genres"], user["ml_user_idx"])
    except KeyError:
        raise HTTPException(400, f"Unknown model '{model}'. See GET /models.")


@router.get("/recommendations/{user_id}")
def recommendations(user_id: int, request: Request, model: str = "hybrid",
                    k: int = Query(12, ge=1, le=50)):
    return _recommend(request, require_user(user_id), model, k)


@router.post("/ratings")
def rate(body: RatingIn, request: Request):
    """Add or update a rating, then return the refreshed recommendations."""
    user = require_user(body.user_id)
    if not request.app.state.catalog.exists(body.movie_id):
        raise HTTPException(404, "Movie not found")
    db.upsert_ratings(body.user_id, [(body.movie_id, body.rating)])
    return {"saved": {"movie_id": body.movie_id, "rating": body.rating},
            "recommendations": _recommend(request, user, body.model, body.k)}


@router.delete("/ratings/{user_id}/{movie_id}")
def unrate(user_id: int, movie_id: int):
    require_user(user_id)
    db.delete_rating(user_id, movie_id)
    return {"deleted": True}


@router.get("/models")
def models(request: Request):
    """Model registry + offline evaluation results for the model switcher."""
    info = request.app.state.rec.model_info()
    res, _ = request.app.state.rec.results
    info["results_table"] = [
        {k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in row.items()}
        for row in res.reset_index().to_dict("records")]
    info["plots"] = sorted(p.name for p in request.app.state.plots_dir.glob("*.png"))
    return info
