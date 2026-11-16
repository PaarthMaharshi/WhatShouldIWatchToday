"""App users: onboarding, demo accounts, rating history, watchlist."""
import hashlib
import hmac
import os

from fastapi import APIRouter, HTTPException, Request

from backend.app import db
from backend.app.schemas import DemoUserCreate, LoginIn, UserCreate, UserUpdate, WatchlistIn

router = APIRouter(prefix="/users", tags=["users"])

_PBKDF2_ROUNDS = 200_000


def hash_password(password: str) -> str:
    """Salted PBKDF2-SHA256, stored as "pbkdf2$rounds$salt$hash" (hex)."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2${_PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str | None) -> bool:
    try:
        _, rounds, salt, digest = stored.split("$")
        got = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(got.hex(), digest)
    except (AttributeError, ValueError):
        return False            # profile has no password (demo user) or a malformed hash


def require_user(user_id):
    user = db.get_user(user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    return user


@router.post("", status_code=201)
def create_user(body: UserCreate, request: Request):
    """Onboarding: genres + favourite movies (stored as 5-star ratings)."""
    catalog = request.app.state.catalog
    bad = [g for g in body.genres if g not in catalog.genres]
    if bad:
        raise HTTPException(422, f"Unknown genres: {bad}")
    if (body.username is None) != (body.password is None):
        raise HTTPException(422, "Send both a username and a password, or neither.")
    username = body.username.lower() if body.username else None
    if username and db.username_taken(username):
        raise HTTPException(409, "That username is taken. Pick another, or log in instead.")
    uid = db.create_user(body.name, body.genres, username=username,
                         password_hash=hash_password(body.password) if body.password else None)
    favs = [m for m in body.favorite_movie_ids if catalog.exists(m)]
    db.upsert_ratings(uid, [(m, 5.0) for m in favs])
    return get_user(uid)


@router.post("/login")
def login(body: LoginIn):
    """Check a username and password and return the profile."""
    found = db.get_login(body.username.strip().lower())
    if found is None or not check_password(body.password, found[1]):
        raise HTTPException(401, "Wrong username or password.")
    return get_user(found[0])


@router.post("/demo", status_code=201)
def create_demo_user(body: DemoUserCreate, request: Request):
    """Clone an original MovieLens user (handy for showing rich-history recs)."""
    rec = request.app.state.rec
    if body.movielens_user_id not in rec.ml_user_index:
        raise HTTPException(404, "No such MovieLens user (valid ids: 1-610)")
    idx, ratings = rec.movielens_ratings(body.movielens_user_id)
    uid = db.create_user(f"MovieLens user {body.movielens_user_id}", ml_user_idx=idx)
    db.upsert_ratings(uid, ratings.items())
    return db.get_user(uid)


@router.get("/{user_id}")
def get_user(user_id: int):
    user = require_user(user_id)
    ratings = db.get_ratings(user_id)
    user["rating_count"] = len(ratings)
    user["watchlist_count"] = len(db.get_watchlist(user_id))
    return user


@router.patch("/{user_id}")
def update_user(user_id: int, body: UserUpdate, request: Request):
    """Edit name, favourite genres and favourite movies.

    Favourites are the user's 5-star ratings (that is how onboarding stores
    them), so the new list adds 5-star ratings and removes 5-star ratings that
    were dropped. Other ratings are left alone.
    """
    require_user(user_id)
    catalog = request.app.state.catalog
    if body.genres is not None:
        bad = [g for g in body.genres if g not in catalog.genres]
        if bad:
            raise HTTPException(422, f"Unknown genres: {bad}")
    db.update_user(user_id, name=body.name.strip() if body.name else None, genres=body.genres)
    if body.favorite_movie_ids is not None:
        wanted = {m for m in body.favorite_movie_ids if catalog.exists(m)}
        current = {m for m, r in db.get_ratings(user_id).items() if r >= 5.0}
        for m in current - wanted:
            db.delete_rating(user_id, m)
        db.upsert_ratings(user_id, [(m, 5.0) for m in wanted - current])
    return get_user(user_id)


@router.get("/{user_id}/favorites")
def favorites(user_id: int, request: Request):
    """The user's 5-star movies, newest first (what the profile editor shows)."""
    require_user(user_id)
    # All of them: the editor sends the full list back, so a cut-off list would delete the rest.
    ids = [m for m, r in db.get_ratings(user_id).items() if r >= 5.0]
    return request.app.state.catalog.cards([m for m in ids if request.app.state.catalog.exists(m)])


@router.get("/{user_id}/ratings")
def user_ratings(user_id: int, request: Request, limit: int = 100):
    require_user(user_id)
    ratings = db.get_ratings(user_id)
    catalog = request.app.state.catalog
    ids = [m for m in list(ratings)[:limit] if catalog.exists(m)]
    cards = catalog.cards(ids)
    for c in cards:
        c["user_rating"] = ratings[c["id"]]
    return cards


@router.get("/{user_id}/watchlist")
def watchlist(user_id: int, request: Request):
    require_user(user_id)
    return request.app.state.catalog.cards(db.get_watchlist(user_id))


@router.post("/{user_id}/watchlist")
def set_watchlist(user_id: int, body: WatchlistIn, request: Request):
    require_user(user_id)
    if not request.app.state.catalog.exists(body.movie_id):
        raise HTTPException(404, "Movie not found")
    db.set_watchlist(user_id, body.movie_id, body.on)
    return {"movie_id": body.movie_id, "in_watchlist": body.on}
