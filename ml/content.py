"""Content-based filtering: TF-IDF on genres + tags + TMDB overview.

Each movie becomes a sparse vector [genre_w * tfidf(genres), text_w * tfidf(tags
+ overview)], L2-normalised so that a dot product is the cosine similarity.
Item-item similarity is derived from these vectors, never from ratings, which
is why the model can score brand-new items.
"""
import re

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

from ml.knn import ItemNeighbourModel, topk_cosine

NOISE_TAGS = {"in netflix queue"}


def _genre_doc(genres) -> str:
    """'Sci-Fi' -> 'scifi' so each genre is a single token."""
    return " ".join(re.sub(r"[^a-z]", "", g.lower()) for g in genres)


class ContentModel(ItemNeighbourModel):
    name = "Content-kNN"

    def __init__(self, movies, tags, overviews=None, k=50, genre_w=1.0,
                 text_w=0.7, lam=0.5):
        super().__init__(lam)
        self.k, self.genre_w, self.text_w = k, genre_w, text_w
        overviews = overviews or {}
        tag_text = (
            tags[~tags["tag"].isin(NOISE_TAGS)]
            .groupby("movieId")["tag"].apply(" ".join).to_dict()
        )
        genre_docs = [_genre_doc(g) for g in movies["genres_list"]]
        text_docs = [
            f"{tag_text.get(mid, '')} {overviews.get(mid) or ''}"
            for mid in movies["movieId"]
        ]
        self.genre_vec = TfidfVectorizer(token_pattern=r"\S+", sublinear_tf=True)
        self.text_vec = TfidfVectorizer(stop_words="english", sublinear_tf=True,
                                        min_df=2, max_features=20000)
        Xg = self.genre_vec.fit_transform(genre_docs)
        Xt = self.text_vec.fit_transform(text_docs)
        self.X = normalize(sparse.hstack([genre_w * Xg, text_w * Xt]).tocsr())

    def _build_sim(self, R):
        # Similarity is independent of ratings: build once and reuse.
        if self.S is None or self.S_k != self.k:
            self.S_k = self.k
            return topk_cosine(self.X, self.k)
        return self.S

    def encode_item(self, genres, tags="", overview=""):
        """Vector for an item that is not in the catalogue (cold-start item)."""
        xg = self.genre_vec.transform([_genre_doc(genres)])
        xt = self.text_vec.transform([f"{tags} {overview}"])
        return normalize(sparse.hstack([self.genre_w * xg, self.text_w * xt]).tocsr())

    def similar_to_vector(self, x, n=12, exclude=None):
        """Top-n catalogue items most similar to feature vector x."""
        sims = (self.X @ x.T).toarray().ravel()
        if exclude is not None:
            sims[list(exclude)] = -1
        top = np.argsort(-sims)[:n]
        return top, sims[top]

    def similar(self, item_idx, n=12):
        """Related movies for an existing item (powers the detail page)."""
        return self.similar_to_vector(self.X[item_idx], n, exclude=[item_idx])
