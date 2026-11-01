"""Recommender base class, bias model and the baseline recommenders.

Every model works on a (users x items) CSR rating matrix `R` (0 = unrated) and
exposes `score_rows(R_rows)`, returning two dense (n, items) matrices:
  pred  predicted ratings (used for RMSE / MAE)
  rank  scores used only to order items for top-N lists
Because models score arbitrary rating rows, a brand-new user typed into the
web app is handled exactly like a user from the training set.
"""
import numpy as np
from scipy import sparse

RATING_MIN, RATING_MAX = 0.5, 5.0
LIKE_THRESHOLD = 4.0


class Recommender:
    name = "base"

    def fit(self, R):
        raise NotImplementedError

    def score_rows(self, R_rows, self_idx=None):
        """Return (pred, rank) for the users described by the rows of R_rows.

        self_idx: when the rows ARE training users, their indices, so that
        neighbourhood models can exclude the user from their own neighbours.
        """
        raise NotImplementedError

    def train_scores(self):
        """(pred, rank) for every training user."""
        return self.score_rows(self.R, self_idx=np.arange(self.R.shape[0]))


def binary(R):
    B = R.tocsr().copy()
    B.data = np.ones_like(B.data, dtype=np.float32)
    return B


def liked(R, thr=LIKE_THRESHOLD):
    L = R.tocsr().copy()
    L.data = (L.data >= thr).astype(np.float32)
    L.eliminate_zeros()
    return L


def row_mean(R, default):
    cnt = R.getnnz(axis=1)
    s = np.asarray(R.sum(axis=1)).ravel()
    return np.where(cnt > 0, s / np.maximum(cnt, 1), default)


def fit_biases(R, mu, l_item=10.0, l_user=15.0, iters=3):
    """Damped alternating estimate of item and user biases (Koren's baseline)."""
    coo = R.tocoo()
    n_u, n_i = R.shape
    cnt_i = np.bincount(coo.col, minlength=n_i)
    cnt_u = np.bincount(coo.row, minlength=n_u)
    bu = np.zeros(n_u)
    for _ in range(iters):
        bi = np.bincount(coo.col, weights=coo.data - mu - bu[coo.row], minlength=n_i)
        bi = bi / (cnt_i + l_item)
        bu = np.bincount(coo.row, weights=coo.data - mu - bi[coo.col], minlength=n_u)
        bu = bu / (cnt_u + l_user)
    return bu, bi


class BiasBaseline(Recommender):
    """r_hat(u, i) = mu + b_u + b_i, with damping toward zero for sparse rows."""
    name = "Bias baseline"

    def __init__(self, l_item=10.0, l_user=15.0):
        self.l_item, self.l_user = l_item, l_user

    def fit(self, R):
        self.R = R.tocsr()
        self.mu = float(self.R.data.mean())
        self.bu, self.bi = fit_biases(self.R, self.mu, self.l_item, self.l_user)
        return self

    def user_bias(self, R_rows):
        coo = R_rows.tocoo()
        resid = coo.data - self.mu - self.bi[coo.col]
        n = R_rows.shape[0]
        s = np.bincount(coo.row, weights=resid, minlength=n)
        c = np.bincount(coo.row, minlength=n)
        return s / (c + self.l_user)

    def base_matrix(self, R_rows):
        bu = self.user_bias(R_rows)
        base = (self.mu + bu[:, None] + self.bi[None, :]).astype(np.float32)
        return np.clip(base, RATING_MIN, RATING_MAX), bu

    def residuals(self, R_rows, bu):
        """Sparse matrix of r - baseline on observed entries only."""
        coo = R_rows.tocoo()
        data = coo.data - self.mu - bu[coo.row] - self.bi[coo.col]
        return sparse.csr_matrix((data.astype(np.float32), (coo.row, coo.col)),
                                 shape=R_rows.shape)

    def score_rows(self, R_rows, self_idx=None):
        base, _ = self.base_matrix(R_rows.tocsr())
        return base, base


class GlobalMean(Recommender):
    """Predicts the global mean; as a ranker it is a random list."""
    name = "Global mean"

    def __init__(self, seed=0):
        self.seed = seed

    def fit(self, R):
        self.R = R.tocsr()
        self.mu = float(self.R.data.mean())
        return self

    def score_rows(self, R_rows, self_idx=None):
        n, m = R_rows.shape
        rng = np.random.default_rng(self.seed)
        return np.full((n, m), self.mu, np.float32), rng.random((n, m), dtype=np.float32)


class UserMean(GlobalMean):
    name = "User mean"

    def score_rows(self, R_rows, self_idx=None):
        n, m = R_rows.shape
        rng = np.random.default_rng(self.seed)
        mean = row_mean(R_rows.tocsr(), self.mu).astype(np.float32)
        return np.repeat(mean[:, None], m, axis=1), rng.random((n, m), dtype=np.float32)


class ItemMean(Recommender):
    """Damped item mean: (sum + l*mu) / (n + l)."""
    name = "Item mean"

    def __init__(self, damping=5.0):
        self.damping = damping

    def fit(self, R):
        self.R = R.tocsr()
        self.mu = float(self.R.data.mean())
        cnt = self.R.getnnz(axis=0)
        s = np.asarray(self.R.sum(axis=0)).ravel()
        self.item_mean = ((s + self.damping * self.mu) / (cnt + self.damping)).astype(np.float32)
        self.counts = cnt
        return self

    def score_rows(self, R_rows, self_idx=None):
        n = R_rows.shape[0]
        m = np.repeat(self.item_mean[None, :], n, axis=0)
        return m, m.copy()


class Popularity(ItemMean):
    """Ranks by number of ratings; rating prediction falls back to item mean."""
    name = "Popularity"

    def score_rows(self, R_rows, self_idx=None):
        pred, _ = super().score_rows(R_rows)
        rank = np.repeat(np.log1p(self.counts).astype(np.float32)[None, :],
                         R_rows.shape[0], axis=0)
        return pred, rank
