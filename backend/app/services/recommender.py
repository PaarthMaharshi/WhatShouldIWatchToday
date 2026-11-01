"""Loads the offline-trained models once and serves recommendations.

No model is retrained at request time: every model scores the user's current
rating row directly (kNN reads the history, supervised models compute fresh
features), so a new rating changes the next recommendation immediately.
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy import sparse

ART = Path(__file__).resolve().parents[3] / "artifacts"
MIN_RATINGS = 5        # below this a user is "cold" and gets the cold-start model

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
        lo, hi = scores.min(), scores.max()
        if not np.isfinite(lo) or hi - lo < 1e-9:
            return np.full(len(scores), 90.0)
        return 60 + 39 * (scores - lo) / (hi - lo)

    # --- main entry ------------------------------------------------------------
    def recommend(self, ratings: dict, model="hybrid", k=12, genres=(), ml_user_idx=None):
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

        rank[row.indices] = -np.inf                        # never re-recommend
        pool = np.argsort(-rank)[:max(50, k)]
        pool = pool[np.isfinite(rank[pool])]
        match = self._match(rank[pool])[:k]
        top = pool[:k]

        cards = self.catalog.cards([self.item_ids[i] for i in top])
        for c, i, m in zip(cards, top, match):
            c["match"] = round(float(m))
            c["reason"] = self._reason(row, i, used, genres)
        return {"model": model, "model_used": used, "label": MODELS.get(used, ("Cold start",))[0],
                "note": note, "rated_count": n, "items": cards}

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

    def similar(self, movie_id, k=12):
        if movie_id not in self.index:
            return []
        top, sims = self.models["content"].similar(self.index[movie_id], k)
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
