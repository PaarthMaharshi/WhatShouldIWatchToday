"""Explainability: "Because you liked X".

A recommendation is justified by the movies the user already liked that are
most similar to it. Similarity averages the content cosine and the
collaborative (rating-based) item similarity.
"""
import numpy as np

from ml.baselines import LIKE_THRESHOLD


class Explainer:
    def __init__(self, content, item_cf=None):
        self.content = content
        self.cf = item_cf

    def similarity(self, item, others):
        others = np.asarray(others)
        sim = (self.content.X[others] @ self.content.X[item].T).toarray().ravel()
        sim = sim / getattr(self.content, "max_sim", 1.0)   # back to a 0-1 scale
        if self.cf is not None:
            cf = self.cf.S[item].toarray().ravel()[others]
            sim = 0.5 * sim + 0.5 * cf
        return sim

    def because_you_liked(self, R_row, item, n=2, thr=LIKE_THRESHOLD):
        """Return [(liked_item_idx, similarity), ...] for one user row (1 x I CSR)."""
        row = R_row.tocsr()
        idx = row.indices[row.data >= thr]
        idx = idx[idx != item]
        if len(idx) == 0:
            return []
        sim = self.similarity(item, idx)
        order = np.argsort(-sim)[:n]
        return [(int(idx[o]), float(sim[o])) for o in order if sim[o] > 0]
