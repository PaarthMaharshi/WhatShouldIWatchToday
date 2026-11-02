"""Save the signed-out home page data to frontend/src/data/home.json.

The home page for visitors who aren't signed in is the same for everyone (the
MovieLens catalogue never changes), so we bake it into the frontend bundle and
the page renders instantly without waiting for the API.

Re-run after retraining or changing the catalogue:
    .venv/Scripts/python scripts/snapshot_home.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from backend.app.main import PREFIX, app  # noqa: E402

# Must match CHIPS in frontend/src/components/home/Favorites.jsx
CHIPS = {
    "top10": {"sort": "rating", "page_size": 10},
    "eight": {"min_rating": 4.0, "sort": "popular"},
    "trending": {"sort": "trending"},
    "animation": {"genre": "Animation", "sort": "popular"},
    "thriller": {"genre": "Thriller", "sort": "popular"},
    "scifi": {"genre": "Sci-Fi", "sort": "popular"},
    "superheroes": {"tag": "superhero", "sort": "popular"},
    "crime": {"genre": "Crime", "sort": "popular"},
    "romance": {"genre": "Romance", "sort": "popular"},
    "classics": {"year_to": 1979, "sort": "rating"},
    "docs": {"genre": "Documentary", "sort": "popular"},
}


def main():
    with TestClient(app) as client:
        def get(path, **params):
            r = client.get(PREFIX + path, params=params)
            r.raise_for_status()
            return r.json()

        favorites = {key: get("/movies", **{"page_size": 10, **params}) for key, params in CHIPS.items()}
        greats = get("/movies", sort="popular", page_size=7)
        cast = {m["id"]: get(f"/movies/{m['id']}")["cast"][:6] for m in greats["items"]}
        snapshot = {
            "trending": get("/trending", k=12),
            "favorites": favorites,
            "greats": greats,
            "greats_cast": cast,
        }

    out = ROOT / "frontend" / "src" / "data" / "home.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snapshot, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
