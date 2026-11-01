"""Storage for app users, their ratings and watchlists.

Two interchangeable backends, chosen by environment:
  * DATABASE_URL (or POSTGRES_URL) set -> PostgreSQL, e.g. a free Neon or
    Supabase database. Data is permanent; use this for any deployment.
  * otherwise -> a local SQLite file (data/app.db), ideal for development.

The MovieLens ratings stay in the offline artifacts; this database only holds
what people do in the web app. All SQL below is written once with "?"
placeholders and runs on both engines.
"""
import json
import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv

# .env.local is written by `neon init`; neither file overrides real env vars.
for _env in (".env.local", ".env"):
    load_dotenv(Path(__file__).resolve().parents[2] / _env)
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
IS_POSTGRES = bool(DATABASE_URL)

# Without a database URL on a serverless platform only /tmp is writable, and
# it is wiped when the instance is recycled - set DATABASE_URL in production.
_DEFAULT_DB = (Path("/tmp/app.db") if os.getenv("VERCEL")
               else Path(__file__).resolve().parents[2] / "data" / "app.db")
DB_PATH = Path(os.getenv("DB_PATH", _DEFAULT_DB))

if IS_POSTGRES:
    import psycopg
    from psycopg.rows import dict_row

_ID = "SERIAL PRIMARY KEY" if IS_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"
_FLOAT = "DOUBLE PRECISION" if IS_POSTGRES else "REAL"
SCHEMA = f"""
CREATE TABLE IF NOT EXISTS users (
    id          {_ID},
    name        TEXT NOT NULL,
    genres      TEXT NOT NULL DEFAULT '[]',   -- onboarding genres (JSON list)
    ml_user_idx INTEGER,                      -- set for demo users cloned from MovieLens
    created_at  {_FLOAT} NOT NULL
);
CREATE TABLE IF NOT EXISTS ratings (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    rating   {_FLOAT} NOT NULL,
    ts       {_FLOAT} NOT NULL,
    PRIMARY KEY (user_id, movie_id)
);
CREATE TABLE IF NOT EXISTS watchlist (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    ts       {_FLOAT} NOT NULL,
    PRIMARY KEY (user_id, movie_id)
);
"""


def _sql(query):
    """Translate "?" placeholders to the driver's style."""
    return query.replace("?", "%s") if IS_POSTGRES else query


@contextmanager
def connect():
    if IS_POSTGRES:
        con = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    else:
        con = sqlite3.connect(DB_PATH)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys = ON")
    try:
        yield con
        con.commit()
    finally:
        con.close()


def _run(con, query, params=()):
    return con.execute(_sql(query), params)


def init_db():
    if not IS_POSTGRES:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as con:
        if IS_POSTGRES:
            con.execute(SCHEMA)
        else:
            con.executescript(SCHEMA)


def create_user(name, genres=(), ml_user_idx=None) -> int:
    with connect() as con:
        row = _run(con,
                   "INSERT INTO users (name, genres, ml_user_idx, created_at) "
                   "VALUES (?, ?, ?, ?) RETURNING id",
                   (name, json.dumps(list(genres)), ml_user_idx, time.time())).fetchone()
        return row["id"]


def get_user(user_id):
    with connect() as con:
        row = _run(con, "SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        return None
    user = dict(row)
    user["genres"] = json.loads(user["genres"])
    return user


def upsert_ratings(user_id, pairs):
    """pairs: iterable of (movie_id, rating)."""
    now = time.time()
    rows = [(user_id, int(m), float(r), now) for m, r in pairs]
    if not rows:
        return
    with connect() as con:
        con.cursor().executemany(
            _sql("INSERT INTO ratings (user_id, movie_id, rating, ts) VALUES (?, ?, ?, ?) "
                 "ON CONFLICT (user_id, movie_id) DO UPDATE "
                 "SET rating = excluded.rating, ts = excluded.ts"),
            rows)


def delete_rating(user_id, movie_id):
    with connect() as con:
        _run(con, "DELETE FROM ratings WHERE user_id = ? AND movie_id = ?", (user_id, movie_id))


def get_ratings(user_id) -> dict:
    """movie_id -> rating, newest first."""
    with connect() as con:
        rows = _run(con, "SELECT movie_id, rating FROM ratings WHERE user_id = ? ORDER BY ts DESC",
                    (user_id,)).fetchall()
    return {r["movie_id"]: r["rating"] for r in rows}


def get_watchlist(user_id) -> list:
    with connect() as con:
        rows = _run(con, "SELECT movie_id FROM watchlist WHERE user_id = ? ORDER BY ts DESC",
                    (user_id,)).fetchall()
    return [r["movie_id"] for r in rows]


def delete_user(user_id):
    """Remove a user; their ratings and watchlist go with them (ON DELETE CASCADE)."""
    with connect() as con:
        _run(con, "DELETE FROM users WHERE id = ?", (user_id,))


def set_watchlist(user_id, movie_id, on: bool):
    with connect() as con:
        if on:
            _run(con, "INSERT INTO watchlist (user_id, movie_id, ts) VALUES (?, ?, ?) "
                      "ON CONFLICT DO NOTHING", (user_id, movie_id, time.time()))
        else:
            _run(con, "DELETE FROM watchlist WHERE user_id = ? AND movie_id = ?",
                 (user_id, movie_id))
