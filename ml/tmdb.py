"""TMDB enrichment with an on-disk JSON cache.

Set TMDB_API_KEY in a .env file at the project root. Without a key (or
offline) the cache is used where available and callers receive None so the
UI can show placeholders. Run `python -m ml.tmdb [limit]` to pre-fetch.
"""
import json
import os
import sys
import time
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
# Serverless file systems are read-only except /tmp.
CACHE = Path(os.getenv("TMDB_CACHE_DIR") or
             ("/tmp/tmdb-cache" if os.getenv("VERCEL") else ROOT / "data" / "cache" / "tmdb"))
API = "https://{host}/3/movie/{id}"
HOSTS = ("api.themoviedb.org", "api.tmdb.org")
IMG = "https://image.tmdb.org/t/p/{size}{path}"

load_dotenv(ROOT / ".env")


def _cache_path(tmdb_id: int) -> Path:
    return CACHE / f"{int(tmdb_id)}.json"


def fetch(tmdb_id: int, force: bool = False):
    """Return TMDB metadata for one movie, using the cache when possible."""
    path = _cache_path(tmdb_id)
    if path.exists() and not force:
        return json.loads(path.read_text(encoding="utf-8"))

    key = os.getenv("TMDB_API_KEY")
    if not key:
        return None
    resp = None
    # api.tmdb.org is TMDB's alternate host; it helps when a network drops
    # connections to the main one.
    for host in HOSTS:
        try:
            resp = requests.get(
                API.format(host=host, id=int(tmdb_id)),
                params={"api_key": key,
                        "append_to_response": "credits,videos,release_dates,images",
                        "include_image_language": "en,null"},
                timeout=8,
            )
            break
        except requests.RequestException:
            continue
    if resp is None or resp.status_code != 200:
        return None          # offline or unknown id: caller shows placeholders
    try:
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_text(resp.text, encoding="utf-8")
    except OSError:
        pass                 # read-only disk: serve without caching
    return resp.json()


def simplify(raw: dict) -> dict:
    """Reduce the raw TMDB payload to the fields the app uses."""
    if not raw:
        return {}
    crew = raw.get("credits", {}).get("crew", [])
    cast = raw.get("credits", {}).get("cast", [])[:8]
    trailer = next(
        (v["key"] for v in raw.get("videos", {}).get("results", [])
         if v.get("site") == "YouTube" and v.get("type") == "Trailer"),
        None,
    )
    def pick(*jobs):
        return [c["name"] for c in crew if c.get("job") in jobs][:2]

    cert = next(
        (d.get("certification") for r in raw.get("release_dates", {}).get("results", [])
         if r.get("iso_3166_1") == "US" for d in r.get("release_dates", [])
         if d.get("certification")),
        None,
    )
    gallery = [IMG.format(size="w780", path=b["file_path"])
               for b in raw.get("images", {}).get("backdrops", [])[:8]]
    return {
        "overview": raw.get("overview"),
        "tagline": raw.get("tagline"),
        "runtime": raw.get("runtime"),
        "release_date": raw.get("release_date"),
        "budget": raw.get("budget"),
        "revenue": raw.get("revenue"),
        "certification": cert,
        "language": raw.get("original_language"),
        "tmdb_rating": raw.get("vote_average"),
        "gallery": gallery,
        "poster": IMG.format(size="w500", path=raw["poster_path"])
        if raw.get("poster_path") else None,
        "backdrop": IMG.format(size="w1280", path=raw["backdrop_path"])
        if raw.get("backdrop_path") else None,
        "director": pick("Director"),
        "writer": pick("Screenplay", "Writer"),
        "cast": [{"name": c["name"],
                  "photo": IMG.format(size="w185", path=c["profile_path"])
                  if c.get("profile_path") else None} for c in cast],
        "trailer_youtube": trailer,
    }


def cached_overviews(links: pd.DataFrame) -> dict:
    """movieId -> overview text for every movie already in the local cache."""
    out = {}
    for mid, tid in zip(links["movieId"], links["tmdbId"]):
        if pd.notna(tid) and _cache_path(int(tid)).exists():
            raw = json.loads(_cache_path(int(tid)).read_text(encoding="utf-8"))
            out[int(mid)] = raw.get("overview")
    return out


def prefetch(limit=None, top_by_ratings=True):
    """Fetch the most-rated movies first so the demo has the best coverage."""
    links = pd.read_parquet(ROOT / "data" / "processed" / "links.parquet")
    ratings = pd.read_parquet(ROOT / "data" / "processed" / "ratings.parquet")
    counts = ratings.groupby("movieId").size()
    links = links.dropna(subset=["tmdbId"])
    if top_by_ratings:
        links = links.assign(n=links["movieId"].map(counts).fillna(0))
        links = links.sort_values("n", ascending=False)
    ids = links["tmdbId"].astype(int).tolist()[:limit]
    for i, tid in enumerate(ids, 1):
        if not _cache_path(tid).exists():
            fetch(tid)
            time.sleep(0.03)  # stay well under TMDB rate limits
        if i % 100 == 0:
            print(f"{i}/{len(ids)}")


if __name__ == "__main__":
    if not os.getenv("TMDB_API_KEY"):
        sys.exit("TMDB_API_KEY not set. Add it to .env first.")
    prefetch(int(sys.argv[1]) if len(sys.argv) > 1 else None)
