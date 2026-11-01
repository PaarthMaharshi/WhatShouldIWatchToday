"""Weighted hybrid of a collaborative model and the content-based model.

Rating prediction blends predicted ratings directly:
    pred = a_r * pred_cf + (1 - a_r) * pred_cb
Ranking scores live on different scales, so each is z-scored per user first:
    rank = a_k * z(rank_cf) + (1 - a_k) * z(rank_cb)
Both weights are tuned on validation data (see ml/train.py).
"""
import numpy as np

from ml.baselines import Recommender


def zscore_rows(x):
    return (x - x.mean(1, keepdims=True)) / (x.std(1, keepdims=True) + 1e-9)


def blend(cf, cb, alpha_rating, alpha_rank):
    """Blend two (pred, rank) tuples."""
    pred = alpha_rating * cf[0] + (1 - alpha_rating) * cb[0]
    rank = alpha_rank * zscore_rows(cf[1]) + (1 - alpha_rank) * zscore_rows(cb[1])
    return pred.astype(np.float32), rank.astype(np.float32)


class Hybrid(Recommender):
    name = "Hybrid (Item-kNN + content)"

    def __init__(self, cf, content, alpha_rating=0.7, alpha_rank=0.7):
        self.cf, self.content = cf, content
        self.alpha_rating, self.alpha_rank = alpha_rating, alpha_rank

    @property
    def R(self):
        return self.cf.R

    def fit(self, R):
        self.cf.fit(R)
        self.content.fit(R)
        return self

    def train_scores(self):
        return blend(self.cf.train_scores(), self.content.train_scores(),
                     self.alpha_rating, self.alpha_rank)

    def score_rows(self, R_rows, self_idx=None):
        return blend(self.cf.score_rows(R_rows, self_idx),
                     self.content.score_rows(R_rows, self_idx),
                     self.alpha_rating, self.alpha_rank)
