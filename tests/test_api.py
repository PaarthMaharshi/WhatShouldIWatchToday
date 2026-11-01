"""End-to-end API tests: python -m pytest tests -q (from the project root).

Uses a temporary SQLite file so the real app database is untouched.
Requires artifacts/serving.joblib (run `python -m ml.train` first).
"""
import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.recommender import MODELS


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def new_user(client):
    r = client.post("/users", json={"name": "Asha", "genres": ["Animation", "Comedy"],
                                    "favorite_movie_ids": [1, 364]})
    assert r.status_code == 201
    return r.json()


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
    info = client.get(f"/users/{u['id']}").json()
    assert info["rating_count"] > 1000
    r = client.get(f"/recommendations/{u['id']}", params={"model": "user_knn"}).json()
    assert r["model_used"] == "user_knn"
    client.post(f"/users/{u['id']}/watchlist", json={"movie_id": 1})
    assert client.get(f"/movies/1", params={"user_id": u["id"]}).json()["in_watchlist"]


def test_models_endpoint(client):
    info = client.get("/models").json()
    assert {m["key"] for m in info["models"]} == set(MODELS)
    assert any(r["model"] == "Hybrid (Item-kNN + content)" for r in info["results_table"])
    assert "ranking.png" in info["plots"]
