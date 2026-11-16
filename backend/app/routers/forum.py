"""Forum endpoints: list/create/delete posts, threaded comments, votes."""
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Request

from backend.app import forum
from backend.app.routers.users import require_user
from backend.app.schemas import CommentIn, PostIn, VoteIn

router = APIRouter(prefix="/forum", tags=["forum"])


def _with_movie(request, items):
    """Attach a small movie card to posts that are about a movie."""
    catalog = request.app.state.catalog
    for p in items:
        mid = p.get("movie_id")
        p["movie"] = None
        if mid is not None and catalog.exists(mid):
            row = catalog.movies.loc[mid]
            p["movie"] = {"id": int(mid), "title": row["clean_title"],
                          "year": None if pd.isna(row["year"]) else int(row["year"])}
    return items


@router.get("/flairs")
def flairs():
    return forum.FLAIRS


@router.get("/posts")
def list_posts(request: Request,
               sort: str = Query("hot", pattern="^(hot|new|top)$"),
               flair: Optional[str] = None,
               movie_id: Optional[int] = None,
               q: Optional[str] = Query(None, max_length=80),
               user_id: Optional[int] = None,
               page: int = Query(1, ge=1),
               page_size: int = Query(20, ge=1, le=50)):
    if flair and flair not in forum.FLAIRS:
        raise HTTPException(422, f"Unknown flair '{flair}'")
    items, total = forum.list_posts(sort, flair, movie_id, q, user_id,
                                    limit=page_size, offset=(page - 1) * page_size)
    return {"items": _with_movie(request, items), "total": total, "page": page,
            "pages": max(1, -(-total // page_size))}


@router.post("/posts", status_code=201)
def create_post(body: PostIn, request: Request):
    require_user(body.user_id)
    if body.flair not in forum.FLAIRS:
        raise HTTPException(422, f"Unknown flair '{body.flair}'")
    if body.movie_id is not None and not request.app.state.catalog.exists(body.movie_id):
        raise HTTPException(404, "Movie not found")
    pid = forum.create_post(body.user_id, body.title.strip(), body.body.strip(), body.flair, body.movie_id)
    return _with_movie(request, [forum.get_post(pid, body.user_id)])[0]


@router.get("/posts/{post_id}")
def get_post(post_id: int, request: Request, user_id: Optional[int] = None):
    post = forum.get_post(post_id, user_id)
    if post is None:
        raise HTTPException(404, "Post not found")
    return _with_movie(request, [post])[0]


@router.delete("/posts/{post_id}")
def delete_post(post_id: int, user_id: int):
    post = forum.get_post(post_id)
    if post is None:
        raise HTTPException(404, "Post not found")
    if post["user_id"] != user_id:
        raise HTTPException(403, "Only the author can delete this post")
    forum.delete_post(post_id)
    return {"deleted": True}


@router.post("/posts/{post_id}/comments", status_code=201)
def add_comment(post_id: int, body: CommentIn):
    require_user(body.user_id)
    if forum.get_post(post_id) is None:
        raise HTTPException(404, "Post not found")
    if body.parent_id is not None:
        parent = forum.get_comment(body.parent_id)
        if parent is None or parent["post_id"] != post_id:
            raise HTTPException(422, "Reply must point to a comment on this post")
    cid = forum.add_comment(post_id, body.user_id, body.body.strip(), body.parent_id)
    return {"id": cid}


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, user_id: int):
    c = forum.get_comment(comment_id)
    if c is None:
        raise HTTPException(404, "Comment not found")
    if c["user_id"] != user_id:
        raise HTTPException(403, "Only the author can delete this comment")
    forum.delete_comment(comment_id)
    return {"deleted": True}


@router.post("/vote")
def vote(body: VoteIn):
    require_user(body.user_id)
    exists = (forum.get_post(body.target_id) if body.target_type == "post"
              else forum.get_comment(body.target_id))
    if exists is None:
        raise HTTPException(404, f"{body.target_type.title()} not found")
    score = forum.vote(body.user_id, body.target_type, body.target_id, body.value)
    return {"score": score, "my_vote": body.value}
