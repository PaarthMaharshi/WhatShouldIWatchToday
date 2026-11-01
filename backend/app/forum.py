"""Forum data access: Reddit-style posts, threaded comments and votes.

Uses the same connection helpers as db.py, so it works on SQLite locally and
PostgreSQL (Neon) when deployed. Text is stored and returned as plain text;
the frontend renders it as text, never as HTML.
"""
import math
import time

from backend.app.db import _run, connect

FLAIRS = ["question", "discussion", "recommendation", "review"]


def _score_sql(kind, alias):
    return (f"COALESCE((SELECT SUM(v.value) FROM votes v WHERE v.target_type = '{kind}' "
            f"AND v.target_id = {alias}.id), 0)")


def _my_votes(con, user_id, kind, ids):
    if not user_id or not ids:
        return {}
    marks = ",".join("?" * len(ids))
    rows = _run(con, f"SELECT target_id, value FROM votes WHERE user_id = ? AND target_type = ? "
                     f"AND target_id IN ({marks})", (user_id, kind, *ids)).fetchall()
    return {r["target_id"]: r["value"] for r in rows}


def hot(score, created_at, now=None):
    """Hacker-News style ranking: votes decay with age (in hours)."""
    age_h = ((now or time.time()) - created_at) / 3600
    return (score + 1) / math.pow(age_h + 2, 1.5)


def create_post(user_id, title, body, flair, movie_id=None):
    with connect() as con:
        row = _run(con, "INSERT INTO posts (user_id, title, body, flair, movie_id, created_at) "
                        "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
                   (user_id, title, body, flair, movie_id, time.time())).fetchone()
        return row["id"]


def list_posts(sort="hot", flair=None, movie_id=None, q=None, viewer=None, limit=20, offset=0):
    where, params = [], []
    if flair:
        where.append("p.flair = ?")
        params.append(flair)
    if movie_id is not None:
        where.append("p.movie_id = ?")
        params.append(movie_id)
    if q:
        where.append("(LOWER(p.title) LIKE ? OR LOWER(p.body) LIKE ?)")
        params += [f"%{q.lower()}%"] * 2
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    with connect() as con:
        rows = _run(con,
                    f"SELECT p.*, u.name AS author, {_score_sql('post', 'p')} AS score, "
                    f"(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count "
                    f"FROM posts p JOIN users u ON u.id = p.user_id {clause} "
                    f"ORDER BY p.created_at DESC LIMIT 500", params).fetchall()
        posts = [{**dict(r), "score": int(r["score"]), "comment_count": int(r["comment_count"])}
                 for r in rows]
        if sort == "top":
            posts.sort(key=lambda p: (p["score"], p["created_at"]), reverse=True)
        elif sort == "hot":
            now = time.time()
            posts.sort(key=lambda p: hot(p["score"], p["created_at"], now), reverse=True)
        total = len(posts)
        page = posts[offset:offset + limit]
        mine = _my_votes(con, viewer, "post", [p["id"] for p in page])
    for p in page:
        p["my_vote"] = mine.get(p["id"], 0)
    return page, total


def get_post(post_id, viewer=None):
    with connect() as con:
        row = _run(con, f"SELECT p.*, u.name AS author, {_score_sql('post', 'p')} AS score "
                        f"FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?",
                   (post_id,)).fetchone()
        if row is None:
            return None
        post = {**dict(row), "score": int(row["score"])}
        post["my_vote"] = _my_votes(con, viewer, "post", [post_id]).get(post_id, 0)
        rows = _run(con, f"SELECT c.*, u.name AS author, {_score_sql('comment', 'c')} AS score "
                         f"FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? "
                         f"ORDER BY c.created_at", (post_id,)).fetchall()
        comments = [{**dict(r), "score": int(r["score"])} for r in rows]
        mine = _my_votes(con, viewer, "comment", [c["id"] for c in comments])
    for c in comments:
        c["my_vote"] = mine.get(c["id"], 0)
    post["comments"] = comments
    post["comment_count"] = len(comments)
    return post


def get_comment(comment_id):
    with connect() as con:
        row = _run(con, "SELECT * FROM comments WHERE id = ?", (comment_id,)).fetchone()
    return dict(row) if row else None


def add_comment(post_id, user_id, body, parent_id=None):
    with connect() as con:
        row = _run(con, "INSERT INTO comments (post_id, parent_id, user_id, body, created_at) "
                        "VALUES (?, ?, ?, ?, ?) RETURNING id",
                   (post_id, parent_id, user_id, body, time.time())).fetchone()
        return row["id"]


def vote(user_id, target_type, target_id, value):
    """value +1 / -1 sets the vote, 0 removes it. Returns the new score."""
    with connect() as con:
        if value == 0:
            _run(con, "DELETE FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?",
                 (user_id, target_type, target_id))
        else:
            _run(con, "INSERT INTO votes (user_id, target_type, target_id, value) VALUES (?, ?, ?, ?) "
                      "ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET value = excluded.value",
                 (user_id, target_type, target_id, value))
        row = _run(con, "SELECT COALESCE(SUM(value), 0) AS s FROM votes WHERE target_type = ? "
                        "AND target_id = ?", (target_type, target_id)).fetchone()
        return int(row["s"])


def delete_post(post_id):
    with connect() as con:
        ids = [r["id"] for r in _run(con, "SELECT id FROM comments WHERE post_id = ?", (post_id,)).fetchall()]
        if ids:
            marks = ",".join("?" * len(ids))
            _run(con, f"DELETE FROM votes WHERE target_type = 'comment' AND target_id IN ({marks})", ids)
        _run(con, "DELETE FROM votes WHERE target_type = 'post' AND target_id = ?", (post_id,))
        _run(con, "DELETE FROM posts WHERE id = ?", (post_id,))


def delete_comment(comment_id):
    """Soft delete keeps the thread shape: the text is replaced, replies stay."""
    with connect() as con:
        _run(con, "UPDATE comments SET body = '[deleted]' WHERE id = ?", (comment_id,))
