"""Movie catalogue: MovieLens metadata, rating stats and cached TMDB details."""
import os
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd

from ml import tmdb
from ml.data import load_serving_bundle

TRENDING_WINDOW_DAYS = 3 * 365   # "trending" = most liked in the last 3 years of data


class Catalog:
    def __init__(self):
        d = load_serving_bundle()
        movies = d["movies"].set_index("movieId")
        r = d["ratings"]
        stats = r.groupby("movieId")["rating"].agg(["mean", "count"])
        movies["rating"] = stats["mean"].round(2)
        movies["rating_count"] = stats["count"].reindex(movies.index).fillna(0).astype(int)
        links = d["links"].set_index("movieId")
        movies["tmdb_id"] = links["tmdbId"]
        movies["imdb_id"] = links["imdbId"]

        # Bayesian average: shrinks movies with few ratings toward the global mean
        mu, m = r["rating"].mean(), 20
        movies["score"] = ((movies["rating"].fillna(mu) * movies["rating_count"] + mu * m)
                           / (movies["rating_count"] + m))

        recent = r[r["timestamp"] >= r["timestamp"].max() - TRENDING_WINDOW_DAYS * 86400]
        liked = recent[recent["rating"] >= 4].groupby("movieId").size()
        movies["trend"] = liked.reindex(movies.index).fillna(0)

        tags = d["tags"][d["tags"]["tag"] != "in netflix queue"]
        top_tags = (tags.groupby(["movieId", "tag"]).size().reset_index(name="n")
                    .sort_values("n", ascending=False).groupby("movieId")["tag"]
                    .apply(lambda s: list(s[:10])))
        movies["tags"] = top_tags.reindex(movies.index)
        movies["tags"] = movies["tags"].apply(lambda t: t if isinstance(t, list) else [])
        hist = r.assign(b=r["rating"].round().clip(1, 5).astype(int)) \
            .groupby(["movieId", "b"]).size().unstack(fill_value=0)
        self.histograms = hist
        self.movies = movies
        self.genres = sorted({g for gl in movies["genres_list"] for g in gl})
        self._meta = {}
        self._offline_until = 0.0

    # --- TMDB --------------------------------------------------------------
    def _fetch_meta(self, movie_id):
        tid = self.movies.at[movie_id, "tmdb_id"]
        if pd.isna(tid):
            return {}
        raw = tmdb.fetch(int(tid)) if time.time() > self._offline_until else None
        if raw is None and os.getenv("TMDB_API_KEY") and not tmdb._cache_path(int(tid)).exists():
            self._offline_until = time.time() + 60   # back off while offline
        return tmdb.simplify(raw)

    def meta(self, movie_id):
        if movie_id not in self._meta:
            self._meta[movie_id] = self._fetch_meta(movie_id)
        return self._meta[movie_id]

    def ensure_meta(self, movie_ids):
        """Fetch missing TMDB entries in parallel (only does work with a key)."""
        missing = [m for m in movie_ids if m not in self._meta]
        if missing:
            with ThreadPoolExecutor(8) as ex:
                for m, v in zip(missing, ex.map(self._fetch_meta, missing)):
                    self._meta[m] = v

    # --- Serialisation -------------------------------------------------------
    def exists(self, movie_id) -> bool:
        return movie_id in self.movies.index

    def card(self, movie_id) -> dict:
        row = self.movies.loc[movie_id]
        meta = self.meta(movie_id)
        return {
            "id": int(movie_id),
            "title": row["clean_title"],
            "year": None if pd.isna(row["year"]) else int(row["year"]),
            "genres": list(row["genres_list"]),
            "rating": None if pd.isna(row["rating"]) else float(row["rating"]),
            "rating_count": int(row["rating_count"]),
            "poster": meta.get("poster"),
            "backdrop": meta.get("backdrop"),
            "runtime": meta.get("runtime"),
            "overview": meta.get("overview"),
            "trailer_youtube": meta.get("trailer_youtube"),
        }

    def cards(self, movie_ids) -> list:
        movie_ids = [int(m) for m in movie_ids]
        self.ensure_meta(movie_ids)
        return [self.card(m) for m in movie_ids]

    def detail(self, movie_id) -> dict:
        card = self.card(movie_id)
        meta = self.meta(movie_id)
        hist = self.histograms.loc[movie_id] if movie_id in self.histograms.index else None
        tid, iid = self.movies.at[movie_id, "tmdb_id"], self.movies.at[movie_id, "imdb_id"]
        card.update({
            "tmdb_id": None if pd.isna(tid) else int(tid),
            "imdb_id": None if pd.isna(iid) else f"tt{int(iid):07d}",
            "tags": self.movies.at[movie_id, "tags"],
            "tagline": meta.get("tagline"),
            "release_date": meta.get("release_date"),
            "budget": meta.get("budget") or None,
            "revenue": meta.get("revenue") or None,
            "certification": meta.get("certification"),
            "language": meta.get("language"),
            "director": meta.get("director", []),
            "writer": meta.get("writer", []),
            "composer": meta.get("composer", []),
            "cast": meta.get("cast", []),
            "gallery": meta.get("gallery", []),
            "tmdb_rating": meta.get("tmdb_rating"),
            "rating_histogram": {int(k): int(v) for k, v in hist.items()} if hist is not None else {},
            "has_tmdb": bool(meta),
        })
        return card

    # --- Queries ---------------------------------------------------------------
    def search(self, q=None, genre=None, tag=None, min_rating=None, year_from=None,
               year_to=None, sort="popular", page=1, page_size=24):
        df = self.movies
        if q:
            df = df[df["clean_title"].str.contains(q, case=False, regex=False)]
        if genre:
            df = df[df["genres_list"].apply(lambda g: genre in g)]
        if tag:
            df = df[df["tags"].apply(lambda t: any(tag.lower() in x for x in t))]
        if min_rating is not None:
            df = df[(df["rating"] >= min_rating) & (df["rating_count"] >= 10)]
        if year_from is not None:
            df = df[df["year"] >= year_from]
        if year_to is not None:
            df = df[df["year"] <= year_to]
        key = {"popular": ("rating_count", False), "rating": ("score", False),
               "year": ("year", False), "title": ("clean_title", True),
               "trending": ("trend", False)}.get(sort, ("rating_count", False))
        df = df.sort_values(key[0], ascending=key[1], na_position="last")
        total = len(df)
        ids = df.index[(page - 1) * page_size: page * page_size]
        return {"items": self.cards(ids), "total": total, "page": page,
                "pages": int(np.ceil(total / page_size)) if total else 0}

    def trending(self, k=20):
        return self.cards(self.movies.sort_values("trend", ascending=False).index[:k])
