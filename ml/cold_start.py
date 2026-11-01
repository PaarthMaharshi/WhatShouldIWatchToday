"""Cold-start handling for new users (K-means + kNN) and new items (kNN).

New user : their picks (liked movies and/or genres) become a pseudo rating row.
           That row is (a) assigned to the nearest K-means taste segment, whose
           most-liked movies form a segment score, and (b) turned into a
           TF-IDF profile for content-kNN. The two scores are z-scored and
           blended (w_seg is the segment weight).
New item : has no ratings, so it is placed with ContentModel.encode_item and
           ContentModel.similar_to_vector (content features only).
"""
import numpy as np
from scipy import sparse
from sklearn.preprocessing import normalize

from ml.baselines import binary, liked
from ml.hybrid import zscore_rows


class ColdStart:
    name = "Cold-start blend"

    def __init__(self, content, seg, R, genre_names, G, w_seg=0.5):
        self.content, self.seg, self.G = content, seg, G
        self.genre_names, self.w_seg = genre_names, w_seg
        Z = sparse.csr_matrix(
            (np.ones(R.shape[0]), (seg.labels_, np.arange(R.shape[0]))),
            shape=(seg.k, R.shape[0]))
        self.cluster_likes = (Z @ liked(R)).toarray().astype(np.float32)
        self.counts = R.getnnz(axis=0)

    def _segment_rank(self, R_rows):
        labels = self.seg.assign(R_rows, neutral_mean=True)
        return np.log1p(self.cluster_likes[labels])

    def _content_rank(self, R_rows):
        profile = normalize(liked(R_rows) @ self.content.X)
        return (profile @ self.content.X.T).toarray()

    def score_rows(self, R_rows, self_idx=None):
        R_rows = R_rows.tocsr()
        rank = (self.w_seg * zscore_rows(self._segment_rank(R_rows))
                + (1 - self.w_seg) * zscore_rows(self._content_rank(R_rows)))
        rank = rank.astype(np.float32)
        return rank, rank

    def pseudo_row(self, liked_items=(), genres=()):
        """Pick list -> 1 x items rating row (picks count as 5 stars). Chosen
        genres contribute the 3 most popular movies of each genre."""
        picks = list(liked_items)
        for g in genres:
            j = self.genre_names.index(g)
            members = self.G[:, j].nonzero()[0]
            picks += list(members[np.argsort(-self.counts[members])[:3]])
        picks = list(dict.fromkeys(picks))
        return sparse.csr_matrix(
            (np.full(len(picks), 5.0, np.float32), ([0] * len(picks), picks)),
            shape=(1, self.G.shape[0])), picks

    def recommend(self, liked_items=(), genres=(), k=12):
        """Top-k item indices for a user who has only given picks."""
        row, picks = self.pseudo_row(liked_items, genres)
        if not picks:
            scores = np.log1p(self.counts).astype(np.float32)
        else:
            scores = self.score_rows(row)[1].ravel().copy()
        scores[list(liked_items)] = -np.inf
        top = np.argsort(-scores)[:k]
        return top, scores[top]
