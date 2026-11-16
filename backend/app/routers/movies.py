"""Catalogue endpoints: browse, search, detail, trending, genres."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from backend.app import db

router = APIRouter(tags=["movies"])


def rated_ids(user_id):
    """Movie ids the user has already rated ("watched"), or an empty set."""
    if user_id is None or not db.get_user(user_id):
        return set()
    return set(db.get_ratings(user_id))


@router.get("/genres")
def genres(request: Request):
    movies = request.app.state.catalog.movies
    counts = movies["genres_list"].explode().value_counts()
    return [{"name": g, "count": int(counts.get(g, 0))} for g in request.app.state.catalog.genres]


@router.get("/movies")
def list_movies(request: Request,
                q: Optional[str] = None,
                genre: Optional[str] = None,
                tag: Optional[str] = None,
                min_rating: Optional[float] = Query(None, ge=0, le=5),
                year_from: Optional[int] = None,
                year_to: Optional[int] = None,
                sort: str = Query("popular", pattern="^(popular|rating|year|title|trending)$"),
                page: int = Query(1, ge=1),
                page_size: int = Query(24, ge=1, le=100),
                hide_rated_for: Optional[int] = None):
    """Browse/search. `hide_rated_for=<user_id>` drops movies that user has
    rated (used by suggestion lists such as the home page sections)."""
    return request.app.state.catalog.search(q, genre, tag, min_rating, year_from,
                                            year_to, sort, page, page_size,
                                            exclude=rated_ids(hide_rated_for))


@router.get("/trending")
def trending(request: Request, k: int = Query(20, ge=1, le=100), user_id: Optional[int] = None):
    return request.app.state.catalog.trending(k, exclude=rated_ids(user_id))


@router.get("/movies/{movie_id}")
def movie_detail(movie_id: int, request: Request, user_id: Optional[int] = None,
                 k: int = Query(12, ge=1, le=30)):
    catalog, rec = request.app.state.catalog, request.app.state.rec
    if not catalog.exists(movie_id):
        raise HTTPException(404, "Movie not found")
    out = catalog.detail(movie_id)
    rated = rated_ids(user_id)
    out["similar"] = rec.similar(movie_id, k, exclude=rated)   # Content-kNN, minus watched
    if user_id is not None and db.get_user(user_id):
        out["user_rating"] = db.get_ratings(user_id).get(movie_id)
        out["in_watchlist"] = movie_id in db.get_watchlist(user_id)
    return out
