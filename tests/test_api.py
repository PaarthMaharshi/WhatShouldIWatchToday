"""End-to-end API tests: python -m pytest tests -q (from the project root).

By default they use a throwaway SQLite file, so no real database is touched
(even if .env sets DATABASE_URL). To test the PostgreSQL backend, point
TEST_DATABASE_URL at a *separate* test database or Neon branch; every user the
tests create is deleted again at the end.
Requires artifacts/serving.joblib (run `python -m ml.train` first).
"""
import os
import tempfile

# Tests never call TMDB: an empty value stops load_dotenv reading the real key.
os.environ["TMDB_API_KEY"] = ""

if os.getenv("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
else:
    # Empty values (not deletion) so load_dotenv cannot re-add a real URL from .env.
    os.environ["DATABASE_URL"] = ""
    os.environ["POSTGRES_URL"] = ""
    os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")

import pytest
from fastapi.testclient import TestClient

from backend.app import db
from backend.app.main import app
from backend.app.services.recommender import MODELS

CREATED = []


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c
    for uid in CREATED:          # leave the database as we found it
        db.delete_user(uid)


@pytest.fixture(scope="module")
def new_user(client):
    r = client.post("/users", json={"name": "Asha", "genres": ["Animation", "Comedy"],
                                    "favorite_movie_ids": [1, 364]})
    assert r.status_code == 201
    CREATED.append(r.json()["id"])
    return r.json()


def test_backend_in_use():
    print("database backend:", "PostgreSQL" if db.IS_POSTGRES else "SQLite")


def test_health_and_genres(client):
    assert client.get("/health").json()["status"] == "ok"
    names = [g["name"] for g in client.get("/genres").json()]
    assert "Animation" in names and "Sci-Fi" in names


def test_movies_search_filter_paginate(client):
    r = client.get("/movies", params={"q": "toy story", "sort": "year"}).json()
    assert r["total"] >= 3 and all("Toy Story" in m["title"] for m in r["items"])
    r = client.get("/movies", params={"genre": "Animation", "page": 2, "page_size": 10}).json()
    assert r["page"] == 2 and len(r["items"]) == 10
    assert all("Animation" in m["genres"] for m in r["items"])
    r = client.get("/movies", params={"min_rating": 4.2, "sort": "rating"}).json()
    assert all(m["rating"] >= 4.2 for m in r["items"])


def test_movie_detail_and_similar(client):
    d = client.get("/movies/1").json()
    assert d["title"] == "Toy Story" and d["year"] == 1995
    assert d["tmdb_id"] == 862 and d["imdb_id"] == "tt0114709"
    assert len(d["similar"]) == 12 and 1 not in [m["id"] for m in d["similar"]]
    assert client.get("/movies/99999999").status_code == 404


def test_trending(client):
    assert len(client.get("/trending", params={"k": 5}).json()) == 5


def test_cold_start_then_personalised(client, new_user):
    uid = new_user["id"]
    r = client.get(f"/recommendations/{uid}").json()
    assert r["model_used"] == "cold_start" and r["note"]
    assert len(r["items"]) == 12
    assert {1, 364}.isdisjoint(m["id"] for m in r["items"])
    # Rate 3 more movies -> 5 ratings -> personalised hybrid
    for mid, rating in [(6377, 5), (2355, 4), (8957, 1)]:
        out = client.post("/ratings", json={"user_id": uid, "movie_id": mid, "rating": rating}).json()
    recs = out["recommendations"]
    assert recs["model_used"] == "hybrid" and recs["rated_count"] == 5
    ids = [m["id"] for m in recs["items"]]
    assert {1, 364, 6377, 2355, 8957}.isdisjoint(ids)
    assert all(60 <= m["match"] <= 99 for m in recs["items"])
    assert any(m["reason"]["type"] == "because_you_liked" for m in recs["items"])


@pytest.mark.parametrize("model", list(MODELS) + ["collaborative"])
def test_every_model(client, new_user, model):
    r = client.get(f"/recommendations/{new_user['id']}", params={"model": model, "k": 8})
    assert r.status_code == 200, r.text
    assert len(r.json()["items"]) == 8


def test_bad_inputs(client, new_user):
    assert client.get(f"/recommendations/{new_user['id']}", params={"model": "nope"}).status_code == 400
    assert client.post("/ratings", json={"user_id": new_user["id"], "movie_id": 1,
                                         "rating": 7}).status_code == 422
    assert client.get("/recommendations/987654").status_code == 404


def test_demo_user_and_watchlist(client):
    u = client.post("/users/demo", json={"movielens_user_id": 414}).json()
    CREATED.append(u["id"])
    info = client.get(f"/users/{u['id']}").json()
    assert info["rating_count"] > 1000
    r = client.get(f"/recommendations/{u['id']}", params={"model": "user_knn"}).json()
    assert r["model_used"] == "user_knn"
    client.post(f"/users/{u['id']}/watchlist", json={"movie_id": 1})
    assert client.get(f"/movies/1", params={"user_id": u["id"]}).json()["in_watchlist"]


def test_mood_options(client):
    o = client.get("/mood/options").json()
    assert {"moods", "company", "eras", "runtimes", "discovery"} <= set(o)
    assert any(m["key"] == "scared" for m in o["moods"])


def test_mood_basic_and_reasons(client):
    r = client.post("/mood", json={"mood": "happy", "k": 8}).json()
    assert len(r["items"]) == 8 and r["personalised"] is False
    assert all(m["reason"]["text"] for m in r["items"])
    assert all(60 <= m["match"] <= 99 for m in r["items"])


def test_mood_filters(client):
    r = client.post("/mood", json={"mood": "scared", "era": "80s90s", "k": 10}).json()
    assert r["items"] and all(1980 <= m["year"] <= 1999 for m in r["items"])
    r = client.post("/mood", json={"mood": "scared", "company": "family", "k": 10}).json()
    assert all("Horror" not in m["genres"] for m in r["items"])
    r = client.post("/mood", json={"mood": "happy", "runtime": "short", "k": 6}).json()
    assert all(m["runtime"] and m["runtime"] <= 95 for m in r["items"])
    r = client.post("/mood", json={"mood": "cry", "discovery": "hidden", "k": 6}).json()
    assert all(m["rating_count"] <= 60 for m in r["items"])


def test_mood_personalised_skips_rated(client, new_user):
    rated = {m["id"] for m in client.get(f"/users/{new_user['id']}/ratings").json()}
    assert rated
    r = client.post("/mood", json={"mood": "happy", "user_id": new_user["id"], "k": 12}).json()
    assert rated.isdisjoint(m["id"] for m in r["items"])


def test_health_reports_database(client):
    assert client.get("/health").json()["database"] in {"sqlite", "postgresql"}


def test_suggestions_hide_rated_movies(client, new_user):
    uid = new_user["id"]
    rated = {m["id"] for m in client.get(f"/users/{uid}/ratings").json()}
    assert 1 in rated                                   # Toy Story was an onboarding favourite
    # Related movies for Toy Story 2: Toy Story appears for visitors, not for this user
    anon = [m["id"] for m in client.get("/movies/3114").json()["similar"]]
    mine = [m["id"] for m in client.get("/movies/3114", params={"user_id": uid}).json()["similar"]]
    assert 1 in anon and rated.isdisjoint(mine) and len(mine) == 12
    # Home lists and trending
    popular = client.get("/movies", params={"sort": "popular", "page_size": 50,
                                            "hide_rated_for": uid}).json()["items"]
    assert rated.isdisjoint(m["id"] for m in popular)
    trend = client.get("/trending", params={"k": 50, "user_id": uid}).json()
    assert rated.isdisjoint(m["id"] for m in trend)


def test_mood_show_different_ones(client, new_user):
    body = {"mood": "happy", "user_id": new_user["id"], "k": 10, "seed": 1}
    first = [m["id"] for m in client.post("/mood", json=body).json()["items"]]
    second = [m["id"] for m in client.post("/mood", json={**body, "seed": 2, "exclude": first}).json()["items"]]
    assert len(second) == 10 and set(first).isdisjoint(second)


def test_forum_post_comment_vote_flow(client, new_user):
    uid = new_user["id"]
    other = client.post("/users", json={"name": "Ravi"}).json()
    CREATED.append(other["id"])

    p = client.post("/forum/posts", json={"user_id": uid, "title": "Best Pixar film?",
                                          "body": "Toy Story or Up?", "flair": "question",
                                          "movie_id": 1})
    assert p.status_code == 201
    post = p.json()
    assert post["author"] == "Asha" and post["movie"]["title"] == "Toy Story" and post["score"] == 0

    # Listing, filters and search
    listing = client.get("/forum/posts", params={"sort": "new"}).json()
    assert post["id"] in [x["id"] for x in listing["items"]]
    assert all(x["flair"] == "question" for x in client.get("/forum/posts", params={"flair": "question"}).json()["items"])
    assert [x["id"] for x in client.get("/forum/posts", params={"movie_id": 1}).json()["items"]] == [post["id"]]
    assert client.get("/forum/posts", params={"q": "pixar"}).json()["total"] >= 1

    # Comment + threaded reply
    c1 = client.post(f"/forum/posts/{post['id']}/comments", json={"user_id": other["id"], "body": "Up, easily."}).json()
    client.post(f"/forum/posts/{post['id']}/comments",
                json={"user_id": uid, "body": "Bold take!", "parent_id": c1["id"]})
    full = client.get(f"/forum/posts/{post['id']}").json()
    assert full["comment_count"] == 2
    assert [c["parent_id"] for c in full["comments"]] == [None, c1["id"]]

    # Votes: up, change to down, remove; my_vote reported per viewer
    assert client.post("/forum/vote", json={"user_id": other["id"], "target_type": "post",
                                            "target_id": post["id"], "value": 1}).json()["score"] == 1
    assert client.post("/forum/vote", json={"user_id": uid, "target_type": "post",
                                            "target_id": post["id"], "value": 1}).json()["score"] == 2
    assert client.post("/forum/vote", json={"user_id": uid, "target_type": "post",
                                            "target_id": post["id"], "value": -1}).json()["score"] == 0
    assert client.get(f"/forum/posts/{post['id']}", params={"user_id": uid}).json()["my_vote"] == -1
    assert client.post("/forum/vote", json={"user_id": uid, "target_type": "comment",
                                            "target_id": c1["id"], "value": 1}).json()["score"] == 1

    # Only the author may delete
    assert client.delete(f"/forum/posts/{post['id']}", params={"user_id": other["id"]}).status_code == 403
    assert client.delete(f"/forum/comments/{c1['id']}", params={"user_id": other["id"]}).status_code == 200
    assert client.get(f"/forum/posts/{post['id']}").json()["comments"][0]["body"] == "[deleted]"
    assert client.delete(f"/forum/posts/{post['id']}", params={"user_id": uid}).status_code == 200
    assert client.get(f"/forum/posts/{post['id']}").status_code == 404


def test_forum_validation(client, new_user):
    uid = new_user["id"]
    assert client.post("/forum/posts", json={"user_id": uid, "title": "Hi"}).status_code == 422
    assert client.post("/forum/posts", json={"user_id": uid, "title": "Valid title", "flair": "meme"}).status_code == 422
    assert client.post("/forum/posts", json={"user_id": 999999, "title": "Valid title"}).status_code == 404
    assert client.post("/forum/vote", json={"user_id": uid, "target_type": "post",
                                            "target_id": 999999, "value": 1}).status_code == 404
    assert client.get("/forum/posts", params={"sort": "random"}).status_code == 422


def test_mood_bad_input(client):
    assert client.post("/mood", json={"mood": "angry"}).status_code == 422
    assert client.post("/mood", json={"genres": ["Nope"]}).status_code == 422


def test_models_endpoint(client):
    info = client.get("/models").json()
    assert {m["key"] for m in info["models"]} == set(MODELS)
    assert any(r["model"] == "Hybrid (Item-kNN + content)" for r in info["results_table"])
    assert "ranking.png" in info["plots"]
