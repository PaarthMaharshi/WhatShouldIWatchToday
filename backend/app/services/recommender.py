"""Loads the offline-trained models once and serves recommendations.

No model is retrained at request time: every model scores the user's current
rating row directly (kNN reads the history, supervised models compute fresh
features), so a new rating changes the next recommendation immediately.
"""
import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy import sparse

from ml.mood import COMPANY, MOODS, RUNTIMES, MoodQuery, MoodRecommender

ART = Path(__file__).resolve().parents[3] / "artifacts"
MIN_RATINGS = 5        # below this a user is "cold" and gets the cold-start model
TASTE_WEIGHT = 1.0     # strength of the genre-taste re-rank (in model-score std units)
PERSON_SHORTLIST = 300  # how many top candidates to check against TMDB cast/crew
CONSENSUS_WEIGHT = float(os.getenv("CONSENSUS_WEIGHT", 1.5))    # max pull towards the shared taste (score std units)
CONSENSUS_FULL_AT = float(os.getenv("CONSENSUS_FULL_AT", 0.3))  # coherence at which the pull reaches full strength
CONSENSUS_MAX_LIKES = 60    # newest liked movies that define the shared taste

# key -> (label in results.csv / UI, family, one-line description)
MODELS = {
    "popularity": ("Popularity", "Baseline",
                   "Most-rated movies. Same list for everyone."),
    "content": ("Content-kNN", "kNN",
                "Movies whose genres, tags and plot (TF-IDF) are closest to what you liked."),
    "item_knn": ("Item-kNN", "kNN",
                 "Collaborative: movies rated similarly by the same people as your favourites."),
    "user_knn": ("User-kNN", "kNN",
                 "Collaborative: what your 100 most similar users liked."),
    "hybrid": ("Hybrid (Item-kNN + content)", "kNN",
               "Weighted blend of Item-kNN and Content-kNN, weight tuned on validation data."),
    "kmeans": ("K-means segment", "K-means",
               "Favourites of the taste segment (cluster) you belong to."),
    "linear": ("Linear regression", "Supervised",
               "Predicts your star rating from 15 features, re-ranks kNN candidates."),
    "logistic": ("Logistic regression", "Supervised",
                 "Predicts P(you rate it 4+) from 15 features, re-ranks kNN candidates."),
    "logistic_scratch": ("Logistic regression (from scratch)", "Supervised",
                         "Same as logistic regression, but trained with our own NumPy gradient descent."),
    "tree": ("Decision tree", "Supervised",
             "Decision tree classifier over the same 15 features."),
    "svm": ("SVM", "Supervised",
            "Linear support-vector classifier over the same 15 features."),
}
ALIASES = {"collaborative": "item_knn", "cf": "item_knn"}


class RecommenderService:
    def __init__(self, catalog):
        self.catalog = catalog
        s = joblib.load(ART / "serving.joblib")
        self.s = s
        self.item_ids = s["item_ids"]
        self.index = {int(m): i for i, m in enumerate(self.item_ids)}
        self.ml_user_index = {int(u): i for i, u in enumerate(s["user_ids"])}
        self.models = {
            "popularity": s["popularity"], "content": s["content"],
            "item_knn": s["item_knn"], "user_knn": s["user_knn"], "hybrid": s["hybrid"],
            "linear": s["feature_models"]["Linear regression"],
            "logistic": s["feature_models"]["Logistic regression"],
            "logistic_scratch": s["feature_models"]["Logistic regression (from scratch)"],
            "tree": s["feature_models"]["Decision tree"],
            "svm": s["feature_models"]["SVM"],
        }
        self.cold = s["cold_start"]
        self.explainer = s["explainer"]
        self.results = self._load_results()
        movies = catalog.movies.loc[[int(m) for m in self.item_ids]]
        # Per-item arrays for the taste re-rank and the explore filters.
        self.genre_names = list(catalog.genres)
        gi = {g: j for j, g in enumerate(self.genre_names)}
        rows, cols = [], []
        for i, gl in enumerate(movies["genres_list"]):
            for g in gl:
                if g in gi:
                    rows.append(i)
                    cols.append(gi[g])
        self.G = sparse.csr_matrix((np.ones(len(rows), np.float32), (rows, cols)),
                                   shape=(len(self.item_ids), len(self.genre_names)))
        self.item_genres = [set(gl) for gl in movies["genres_list"]]
        self.item_year = movies["year"].astype(float).values
        self.item_text = [(str(t) + " " + " ".join(tags)).lower()
                          for t, tags in zip(movies["clean_title"], movies["tags"])]
        self.mood_engine = MoodRecommender(
            s["content"], movies["genres_list"], movies["year"].astype(float).values,
            s["R"].getnnz(axis=0), movies["score"].fillna(movies["score"].mean()).values)

    # --- helpers -------------------------------------------------------------
    def _load_results(self):
        path = ART / "results.csv"
        res = pd.read_csv(path).set_index("model") if path.exists() else pd.DataFrame()
        cold = ART / "cold_start.json"
        return res, json.loads(cold.read_text()) if cold.exists() else {}

    def resolve(self, model: str) -> str:
        model = ALIASES.get(model, model)
        if model not in MODELS:
            raise KeyError(model)
        return model

    def row(self, ratings: dict):
        """{movie_id: rating} -> 1 x items CSR row (unknown ids are ignored)."""
        pairs = [(self.index[m], r) for m, r in ratings.items() if m in self.index]
        cols = [p[0] for p in pairs]
        return sparse.csr_matrix((np.array([p[1] for p in pairs], np.float32),
                                  (np.zeros(len(cols), int), cols)),
                                 shape=(1, len(self.item_ids)))

    def movielens_ratings(self, ml_user_id):
        """Ratings of an original MovieLens user, for demo accounts."""
        u = self.ml_user_index[ml_user_id]
        r = self.s["R"][u]
        return u, {int(self.item_ids[i]): float(v) for i, v in zip(r.indices, r.data)}

    def _match(self, scores):
        """Map the list's scores to a 60-99% "match" relative to the user's top 50."""
        if len(scores) == 0:                       # nothing matched the filters
            return scores
        lo, hi = scores.min(), scores.max()
        if not np.isfinite(lo) or hi - lo < 1e-9:
            return np.full(len(scores), 90.0)
        return 60 + 39 * (scores - lo) / (hi - lo)

    # --- taste profile + explore filters ----------------------------------------
    def taste_profile(self, ratings: dict, genres=()):
        """Genre affinity in [-1, 1]: liked movies (4+) and onboarding genres push a
        genre up, disliked movies (2 or less) push it down."""
        p = np.zeros(len(self.genre_names), np.float32)
        for m, r in ratings.items():
            i = self.index.get(m)
            if i is None:
                continue
            w = 1.0 if r >= 4 else (-0.6 if r <= 2 else 0.2)
            p[self.G[i].indices] += w
        for g in genres:
            if g in self.genre_names:
                p[self.genre_names.index(g)] += 2.0
        top = np.abs(p).max()
        return p / top if top > 0 else p

    def top_genres(self, profile, n=3):
        order = np.argsort(-profile)
        return [self.genre_names[j] for j in order[:n] if profile[j] > 0.15]

    def _interest_rerank(self, rank, profile, weight=TASTE_WEIGHT):
        """Blend the model's score with how well each movie's genres match the
        user's saved taste, so picks follow their interests instead of drifting
        to the same famous films for everyone."""
        if not profile.any():
            return rank
        ok = np.isfinite(rank)
        if ok.sum() < 2:
            return rank
        z = np.full_like(rank, -np.inf)
        r = rank[ok]
        z[ok] = (r - r.mean()) / (r.std() + 1e-9)
        n_genres = np.maximum(np.asarray(self.G.sum(axis=1)).ravel(), 1)
        aff = np.asarray(self.G @ profile).ravel() / np.sqrt(n_genres)
        z[ok] += weight * aff[ok] / (np.abs(aff).max() + 1e-9)
        return z

    def _consensus(self, ratings: dict):
        """How well each movie fits ALL of the user's liked movies together.

        Returns (support, coherence). support[i] is the average content
        similarity (genres + tags + plot) between movie i and every liked
        movie, so a film that resembles only one favourite scores low, while
        one that resembles most of them scores high. coherence (0-1) says how
        alike the liked movies are to each other: near 1 for a focused taste
        (all animated family films), near 0 for a mixed one.
        """
        liked = [self.index[m] for m, r in ratings.items() if r >= 4 and m in self.index]
        liked = liked[:CONSENSUS_MAX_LIKES]                # ratings come newest first
        if len(liked) < 2:
            return None, 0.0
        X = self.models["content"].X
        scale = getattr(self.models["content"], "max_sim", 1.0)
        sims = (X @ X[liked].T).toarray() / scale          # items x liked
        support = sims.mean(axis=1)
        among = sims[liked]                                # liked x liked
        n = len(liked)
        coherence = float((among.sum() - np.trace(among)) / (n * (n - 1)))
        return support.astype(np.float32), max(0.0, min(1.0, coherence))

    def _consensus_rerank(self, rank, ratings):
        """Pull the ranking towards movies that match the user's favourites as a
        group. The pull grows with how focused the taste is, so a varied taste
        keeps its variety and a focused one is not derailed by one favourite's
        look-alikes (e.g. action films co-watched with a single kids' movie)."""
        support, coherence = self._consensus(ratings)
        ok = np.isfinite(rank)
        if support is None or ok.sum() < 2:
            return rank
        weight = CONSENSUS_WEIGHT * min(1.0, coherence / CONSENSUS_FULL_AT)
        z = np.full_like(rank, -np.inf)
        r = rank[ok]
        z[ok] = (r - r.mean()) / (r.std() + 1e-9)
        s = support[ok]
        z[ok] += weight * (s - s.mean()) / (s.std() + 1e-9)
        return z

    def _person_match(self, person, candidates):
        """Items whose tags/title mention `person`, plus items whose cast or
        director include them.

        Cast comes from TMDB. Every movie whose details are already saved is
        checked; details that are missing are looked up live only for the
        user's top candidates, to keep the search fast.
        """
        q = person.lower().strip()
        hits = {i for i in candidates if q in self.item_text[i]}
        ids = [int(self.item_ids[i]) for i in candidates]
        if os.getenv("TMDB_API_KEY"):
            self.catalog.ensure_meta(ids[:PERSON_SHORTLIST])
        self.catalog.load_saved_meta(ids)
        hits.update(i for i, m in zip(candidates, ids) if q in self.catalog.people(m))
        return hits

    def _apply_filters(self, rank, genre=None, year_from=None, year_to=None, person=None):
        if genre:
            keep = np.array([genre in gs for gs in self.item_genres])
            rank[~keep] = -np.inf
        if year_from:
            rank[~(self.item_year >= year_from)] = -np.inf
        if year_to:
            rank[~(self.item_year <= year_to)] = -np.inf
        if person:
            cand = [i for i in np.argsort(-rank) if np.isfinite(rank[i])]
            hits = self._person_match(person, cand)
            mask = np.zeros(len(rank), bool)
            mask[list(hits)] = True
            rank[~mask] = -np.inf
        return rank

    # --- main entry ------------------------------------------------------------
    def recommend(self, ratings: dict, model="hybrid", k=12, genres=(), ml_user_idx=None, offset=0,
                  genre=None, year_from=None, year_to=None, person=None, taste=True):
        """Top-k picks; `offset` pages further down the same ranking ("show more").
        Optional filters (genre / era / person) explore inside the personal ranking."""
        model = self.resolve(model)
        row = self.row(ratings)
        n = row.nnz
        used, note = model, None
        self_idx = None if ml_user_idx is None else np.array([ml_user_idx])

        if n < MIN_RATINGS and model != "popularity":
            # Cold start: picks (liked ratings) + onboarding genres
            used = "cold_start"
            note = (f"You have rated {n} movie{'s' if n != 1 else ''}; until you rate "
                    f"{MIN_RATINGS}, recommendations come from your picks via the "
                    f"K-means segment + Content-kNN cold-start model.")
            liked_items = [self.index[m] for m, r in ratings.items()
                           if r >= 4 and m in self.index]
            pseudo, picks = self.cold.pseudo_row(liked_items, genres)
            if picks:
                rank = self.cold.score_rows(pseudo)[1].ravel().copy()
            else:
                rank = np.log1p(self.cold.counts).astype(np.float32)
        elif model == "kmeans":
            rank = self.cold._segment_rank(row).ravel().copy()
        else:
            _, rank = self.models[model].score_rows(row, self_idx)
            rank = np.asarray(rank, dtype=np.float32).ravel().copy()

        profile = self.taste_profile(ratings, genres)
        if taste and model != "popularity":
            rank = self._consensus_rerank(rank, ratings)
            rank = self._interest_rerank(rank, profile)
        rank[row.indices] = -np.inf                        # never re-recommend
        rank = self._apply_filters(rank, genre, year_from, year_to, person)
        pool = np.argsort(-rank)[:max(50, offset + k)]
        pool = pool[np.isfinite(rank[pool])]
        match = self._match(rank[pool])[offset:offset + k]
        top = pool[offset:offset + k]

        cards = self.catalog.cards([self.item_ids[i] for i in top])
        for c, i, m in zip(cards, top, match):
            c["match"] = round(float(m))
            c["reason"] = self._reason(row, i, used, genres)
        return {"model": model, "model_used": used, "label": MODELS.get(used, ("Cold start",))[0],
                "note": note, "rated_count": n, "offset": offset,
                "taste": self.top_genres(profile), "items": cards}

    def _reason(self, row, item, used, genres):
        expl = self.explainer.because_you_liked(row, item, n=1) if row.nnz else []
        if expl:
            j, sim = expl[0]
            title = self.catalog.movies.at[int(self.item_ids[j]), "clean_title"]
            return {"type": "because_you_liked", "movie_id": int(self.item_ids[j]),
                    "title": title, "similarity": round(sim, 3),
                    "text": f"Because you liked {title}"}
        if used == "popularity" or (not genres and not row.nnz):
            return {"type": "popular", "text": "Popular with everyone"}
        g = [x for x in self.catalog.movies.at[int(self.item_ids[item]), "genres_list"]
             if x in genres]
        return {"type": "genre", "text": f"Popular with {g[0]} fans" if g else "Matches your picks"}

    def mood(self, query: MoodQuery, k=12, ratings=None, ml_user_idx=None, exclude=(), seed=None):
        """Mood match (see ml/mood.py). Personalised when the user has enough
        ratings; never returns rated movies or ids in `exclude` (already shown)."""
        eng = self.mood_engine
        personal, row = None, None
        if ratings:
            row = self.row(ratings)
            if row.nnz >= MIN_RATINGS:
                self_idx = None if ml_user_idx is None else np.array([ml_user_idx])
                _, rank = self.models["hybrid"].score_rows(row, self_idx)
                personal = np.asarray(rank, float).ravel()
        scores = eng.score(query, personal)
        if row is not None:
            scores[row.indices] = -np.inf                 # skip what they've rated
        shown = [self.index[m] for m in exclude if m in self.index]
        scores[shown] = -np.inf                           # "show me different ones"
        if seed is not None:
            scores = eng.jitter(scores, seed)

        pool = np.argsort(-scores)[:150]
        pool = [i for i in pool if np.isfinite(scores[i])]
        # Runtime and certificate come from TMDB, so check only the shortlist.
        _, rt_lo, rt_hi = RUNTIMES[query.runtime]
        certs_ok = COMPANY[query.company].get("certs_ok")
        if rt_lo or rt_hi or certs_ok:
            self.catalog.ensure_meta([int(self.item_ids[i]) for i in pool])
            kept = []
            for i in pool:
                meta = self.catalog.meta(int(self.item_ids[i]))
                runtime, cert = meta.get("runtime"), meta.get("certification")
                if (rt_lo or rt_hi) and not runtime:
                    continue                              # unknown length: can't promise it fits
                if rt_lo and runtime < rt_lo or rt_hi and runtime > rt_hi:
                    continue
                if certs_ok and cert and cert not in certs_ok:
                    continue
                kept.append(i)
            pool = kept

        top = eng.diversify(pool[:60], scores, k)
        cards = self.catalog.cards([self.item_ids[i] for i in top])
        match = self._match(scores[top]) if top else []
        for c, i, m in zip(cards, top, match):
            blob = " ".join(self.catalog.movies.at[c["id"], "tags"]) + " " + (c.get("overview") or "")
            genres, words = eng.reasons(i, query, blob)
            bits = genres + [f"“{w}”" for w in words]
            c["match"] = round(float(m))
            c["reason"] = {"type": "mood", "text": " · ".join(bits) or MOODS[query.mood]["label"]}
        return {"mood": query.mood, "label": MOODS[query.mood]["label"],
                "personalised": personal is not None, "items": cards}

    def similar(self, movie_id, k=12, exclude=()):
        """Related movies (Content-kNN), leaving out any movie ids in `exclude`."""
        if movie_id not in self.index:
            return []
        exclude = set(exclude)
        top, sims = self.models["content"].similar(self.index[movie_id], k + len(exclude))
        keep = [(i, s) for i, s in zip(top, sims) if int(self.item_ids[i]) not in exclude][:k]
        top, sims = [i for i, _ in keep], [s for _, s in keep]
        cards = self.catalog.cards([self.item_ids[i] for i in top])
        for c, s in zip(cards, sims):
            c["similarity"] = round(float(s), 3)
        return cards

    def model_info(self):
        res, cold = self.results
        out = []
        for key, (label, family, desc) in MODELS.items():
            metrics = {}
            if label in res.index:
                metrics = {c: (None if pd.isna(v) else round(float(v), 4))
                           for c, v in res.loc[label].items()}
            out.append({"key": key, "label": label, "family": family,
                        "description": desc, "metrics": metrics})
        return {"models": out, "cold_start": cold, "min_ratings_for_personal": MIN_RATINGS,
                "alphas": self.s["alphas"], "n_segments": self.s["n_segments"]}
