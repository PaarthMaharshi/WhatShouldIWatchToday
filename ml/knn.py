"""Neighbourhood collaborative filtering (item-based and user-based).

Both work on residuals r - (mu + b_u + b_i), so a neighbour's opinion is
measured relative to the baseline and popular/harsh-rater effects cancel.
Predicted rating:  base_ui + sum_j s_ij * resid_uj / (sum_j |s_ij| + lam)
Ranking score:     sum of similarities to items the user liked (>= 4 stars).
"""
import numpy as np
from scipy import sparse
from sklearn.preprocessing import normalize

from ml.baselines import (RATING_MAX, RATING_MIN, BiasBaseline, Recommender,
                          binary, liked)


def topk_cosine(X, k, shrink=0.0, B=None, block=1000, normalize_rows=True):
    """Top-k cosine neighbours of every row of X as a sparse (n x n) matrix.

    shrink: damp similarities supported by few co-ratings,
            s * n_co / (n_co + shrink); B is the binary support matrix.
    normalize_rows=False uses plain dot products (for pre-weighted features).
    Only positive similarities are kept; the diagonal is removed.
    """
    X = normalize(X.tocsr(), axis=1) if normalize_rows else X.tocsr()
    n = X.shape[0]
    XT = X.T.tocsc()
    BT = B.T.tocsc() if shrink else None
    rows, cols, vals = [], [], []
    for start in range(0, n, block):
        end = min(start + block, n)
        sim = (X[start:end] @ XT).toarray()
        if shrink:
            cnt = (B[start:end] @ BT).toarray()
            sim *= cnt / (cnt + shrink)
        sim[np.arange(end - start), np.arange(start, end)] = 0
        kk = min(k, n - 1)
        idx = np.argpartition(-sim, kk, axis=1)[:, :kk]
        v = np.take_along_axis(sim, idx, 1)
        r = np.repeat(np.arange(start, end), kk)
        keep = v.ravel() > 0
        rows.append(r[keep])
        cols.append(idx.ravel()[keep])
        vals.append(v.ravel()[keep])
    return sparse.csr_matrix(
        (np.concatenate(vals).astype(np.float32),
         (np.concatenate(rows), np.concatenate(cols))), shape=(n, n))


class ItemNeighbourModel(Recommender):
    """Shared scoring for models defined by an item-item similarity matrix S
    (row i holds the neighbours of item i)."""

    def __init__(self, lam=0.5):
        self.lam = lam
        self.S = None

    def _build_sim(self, R):
        raise NotImplementedError

    def fit(self, R):
        self.R = R.tocsr()
        self.bias = BiasBaseline().fit(self.R)
        self.S = self._build_sim(self.R)
        self._prepare()
        return self

    def _prepare(self):
        self.St = self.S.T.tocsr()
        self.St_abs = abs(self.St)

    def score_rows(self, R_rows, self_idx=None):
        R_rows = R_rows.tocsr()
        base, bu = self.bias.base_matrix(R_rows)
        resid = self.bias.residuals(R_rows, bu)
        num = (resid @ self.St).toarray()
        den = (binary(R_rows) @ self.St_abs).toarray()
        pred = np.clip(base + num / (den + self.lam), RATING_MIN, RATING_MAX)
        rank = (liked(R_rows) @ self.St).toarray()
        return pred.astype(np.float32), rank.astype(np.float32)


class ItemKNN(ItemNeighbourModel):
    name = "Item-kNN"

    def __init__(self, k=40, shrink=30.0, lam=0.5):
        super().__init__(lam)
        self.k, self.shrink = k, shrink

    def _build_sim(self, R):
        bu = self.bias.user_bias(R)
        res = self.bias.residuals(R, bu)
        return topk_cosine(res.T, self.k, self.shrink, binary(R).T.tocsr())


class UserKNN(Recommender):
    name = "User-kNN"

    def __init__(self, k=50, shrink=10.0, lam=0.5):
        self.k, self.shrink, self.lam = k, shrink, lam

    def fit(self, R):
        self.R = R.tocsr()
        self.bias = BiasBaseline().fit(self.R)
        bu = self.bias.user_bias(self.R)
        self.res = self.bias.residuals(self.R, bu)
        self.res_T = self.res.T.tocsr()
        self.norm = np.sqrt(np.asarray(self.res.multiply(self.res).sum(1)).ravel())
        self.M = binary(self.R)
        self.M_T = self.M.T.tocsr()
        self.like = liked(self.R)
        return self

    def score_rows(self, R_rows, self_idx=None):
        R_rows = R_rows.tocsr()
        n = R_rows.shape[0]
        base, bu = self.bias.base_matrix(R_rows)
        res = self.bias.residuals(R_rows, bu)
        norm = np.sqrt(np.asarray(res.multiply(res).sum(1)).ravel())
        sim = (res @ self.res_T).toarray() / (norm[:, None] * self.norm[None, :] + 1e-9)
        cnt = (binary(R_rows) @ self.M_T).toarray()
        sim *= cnt / (cnt + self.shrink)
        if self_idx is not None:
            sim[np.arange(n), self_idx] = 0
        sim[sim < 0] = 0
        idx = np.argpartition(-sim, self.k, axis=1)[:, :self.k]
        top = np.zeros_like(sim)
        np.put_along_axis(top, idx, np.take_along_axis(sim, idx, 1), axis=1)
        S = sparse.csr_matrix(top)
        num = (S @ self.res).toarray()
        den = (S @ self.M).toarray()
        pred = np.clip(base + num / (den + self.lam), RATING_MIN, RATING_MAX)
        rank = (S @ self.like).toarray()
        return pred.astype(np.float32), rank.astype(np.float32)
