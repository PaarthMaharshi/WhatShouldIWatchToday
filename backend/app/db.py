"""SQLite storage for app users, their ratings and watchlists.

The MovieLens ratings stay in the offline artifacts; this database only holds
what people do in the web app. Uses the standard-library sqlite3 module.
"""
import json
import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

# Serverless platforms (Vercel) only allow writes to /tmp, which is wiped when
# the instance is recycled - fine for a demo, use a hosted database otherwise.
_DEFAULT_DB = (Path("/tmp/app.db") if os.getenv("VERCEL")
               else Path(__file__).resolve().parents[2] / "data" / "app.db")
DB_PATH = Path(os.getenv("DB_PATH", _DEFAULT_DB))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    genres      TEXT NOT NULL DEFAULT '[]',   -- onboarding genres (JSON list)
    ml_user_idx INTEGER,                      -- set for demo users cloned from MovieLens
    created_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS ratings (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    rating   REAL NOT NULL,
    ts       REAL NOT NULL,
    PRIMARY KEY (user_id, movie_id)
);
CREATE TABLE IF NOT EXISTS watchlist (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    ts       REAL NOT NULL,
    PRIMARY KEY (user_id, movie_id)
);
"""


@contextmanager
def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as con:
        con.executescript(SCHEMA)


def create_user(name, genres=(), ml_user_idx=None) -> int:
    with connect() as con:
        cur = con.execute(
            "INSERT INTO users (name, genres, ml_user_idx, created_at) VALUES (?, ?, ?, ?)",
            (name, json.dumps(list(genres)), ml_user_idx, time.time()))
        return cur.lastrowid


def get_user(user_id):
    with connect() as con:
        row = con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        return None
    user = dict(row)
    user["genres"] = json.loads(user["genres"])
    return user


def upsert_ratings(user_id, pairs):
    """pairs: iterable of (movie_id, rating)."""
    now = time.time()
    with connect() as con:
        con.executemany(
            "INSERT INTO ratings (user_id, movie_id, rating, ts) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id, movie_id) DO UPDATE SET rating = excluded.rating, ts = excluded.ts",
            [(user_id, int(m), float(r), now) for m, r in pairs])


def delete_rating(user_id, movie_id):
    with connect() as con:
        con.execute("DELETE FROM ratings WHERE user_id = ? AND movie_id = ?", (user_id, movie_id))


def get_ratings(user_id) -> dict:
    """movie_id -> rating, newest first."""
    with connect() as con:
        rows = con.execute(
            "SELECT movie_id, rating FROM ratings WHERE user_id = ? ORDER BY ts DESC",
            (user_id,)).fetchall()
    return {r["movie_id"]: r["rating"] for r in rows}


def get_watchlist(user_id) -> list:
    with connect() as con:
        rows = con.execute(
            "SELECT movie_id FROM watchlist WHERE user_id = ? ORDER BY ts DESC",
            (user_id,)).fetchall()
    return [r["movie_id"] for r in rows]


def set_watchlist(user_id, movie_id, on: bool):
    with connect() as con:
        if on:
            con.execute("INSERT OR IGNORE INTO watchlist VALUES (?, ?, ?)",
                        (user_id, movie_id, time.time()))
        else:
            con.execute("DELETE FROM watchlist WHERE user_id = ? AND movie_id = ?",
                        (user_id, movie_id))
