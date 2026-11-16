"""Feature table for the supervised models.

One row per (user, movie) pair. Every feature is computed from a *history*
rating matrix only, so a pair's own rating never leaks into its features.
Training rows use out-of-fold history (see build_training_set): the pair
being predicted is always held out of the history that produced its features.
"""
import copy

import numpy as np

from ml.baselines import BiasBaseline, ItemMean, binary, liked, row_mean
from ml.hybrid import zscore_rows
from ml.knn import ItemKNN, UserKNN
from ml.segments import UserSegments, genre_matrix
from scipy import sparse

FEATURES = [
    "bias_pred",       # mu + b_u + b_i
    "user_mean", "user_logn",
    "item_mean", "item_logn", "item_year",
    "genre_aff",       # user's avg rating deviation on this movie's genres
    "iknn_pred", "iknn_rank",
    "uknn_pred", "uknn_rank",
    "content_pred", "content_rank",
    "seg_mean",        # avg rating of this movie inside the user's K-means segment
    "seg_likes",       # log #likes of this movie inside the segment
]


class FeatureBuilder:
    def __init__(self, ds, content, params, n_segments=8):
        self.params, self.n_segments = params, n_segments
        self.content = copy.copy(content)       # shares TF-IDF + similarity
        self.G, self.genre_names = genre_matrix(ds.movies)
        self.n_genres = np.maximum(np.asarray(self.G.sum(1)).ravel(), 1)
        year = ds.movies["year"].astype(float)
        self.year = ((year.fillna(year.median()) - 1990) / 20).values.astype(np.float32)

    def fit(self, R):
        R = R.tocsr()
        self.bias = BiasBaseline().fit(R)
        self.item_mean = ItemMean().fit(R)
        self.iknn = ItemKNN(**self.params["item_knn"]).fit(R)
        self.uknn = UserKNN(**self.params["user_knn"]).fit(R)
        self.content.fit(R)
        self.seg = UserSegments(self.G, self.n_segments).fit(R)
        Z = sparse.csr_matrix(
            (np.ones(R.shape[0]), (self.seg.labels_, np.arange(R.shape[0]))),
            shape=(self.n_segments, R.shape[0]))
        s, c = (Z @ R).toarray(), (Z @ binary(R)).toarray()
        im = self.item_mean.item_mean[None, :]
        self.seg_mean = ((s + 5 * im) / (c + 5)).astype(np.float32)
        self.seg_likes = np.log1p((Z @ liked(R)).toarray()).astype(np.float32)
        return self

    def matrices(self, R_rows, self_idx=None):
        """name -> array broadcastable to (rows, items)."""
        R_rows = R_rows.tocsr()
        base, bu = self.bias.base_matrix(R_rows)
        umean = row_mean(R_rows, self.bias.mu)[:, None]
        sums = (R_rows @ self.G).toarray()
        cg = (binary(R_rows) @ self.G).toarray()
        aff = (sums + 3 * umean) / (cg + 3) - umean
        ip, ir = self.iknn.score_rows(R_rows, self_idx)
        up, ur = self.uknn.score_rows(R_rows, self_idx)
        cp, cr = self.content.score_rows(R_rows, self_idx)
        seg = self.seg.assign(R_rows)
        return {
            "bias_pred": base,
            "user_mean": (self.bias.mu + bu)[:, None].astype(np.float32),
            "user_logn": np.log1p(R_rows.getnnz(1))[:, None].astype(np.float32),
            "item_mean": self.item_mean.item_mean[None, :],
            "item_logn": np.log1p(self.item_mean.counts)[None, :].astype(np.float32),
            "item_year": self.year[None, :],
            "genre_aff": ((self.G @ aff.T).T / self.n_genres[None, :]).astype(np.float32),
            "iknn_pred": ip, "iknn_rank": np.log1p(np.maximum(ir, 0)),
            "uknn_pred": up, "uknn_rank": np.log1p(np.maximum(ur, 0)),
            "content_pred": cp, "content_rank": np.log1p(np.maximum(cr, 0)),
            "seg_mean": self.seg_mean[seg],
            "seg_likes": self.seg_likes[seg],
        }


def pair_features(mats, u, i):
    """Stack the feature columns for the given (user row, item) pairs."""
    shape = (max(a.shape[0] for a in mats.values()),
             max(a.shape[1] for a in mats.values()))
    # broadcast_to is a zero-copy view, so (n,1)/(1,I) features index like (n,I)
    cols = [np.broadcast_to(mats[name], shape)[u, i] for name in FEATURES]
    return np.column_stack(cols).astype(np.float32)


def candidate_scores(iknn_rank, item_logn, seen):
    """Stage-1 candidate score: z(Item-kNN score) + 0.5 * z(log popularity).

    iknn_rank (n, I), item_logn (1, I), seen (n, I) bool -> (n, I) with seen = -inf.
    Shared by training (to draw negatives) and serving (to pick what to re-rank).
    """
    score = (zscore_rows(iknn_rank)
             + 0.5 * zscore_rows(np.repeat(item_logn, iknn_rank.shape[0], 0)))
    score[seen] = -np.inf
    return score


def build_training_set(ds, df, builder, n_folds=4, seed=0, neg_per_pos=3, n_cand=200):
    """Out-of-fold feature table for the ratings in df, plus hard negatives.

    For each fold the history is the other folds, so the features of a held-out
    rating are computed without it.

    Rated pairs alone only teach a model which of the movies a user *chose* to
    watch they liked. At serving time the re-ranker must instead pick among
    candidates the user never rated, so for every held-out rating we also add
    `neg_per_pos` "hard negatives": unrated movies drawn from that user's own
    top-`n_cand` candidate list, labelled "not liked".

    Returns X, rating target (NaN for negatives), like target (1 = rated >= 4).
    """
    rng = np.random.default_rng(seed)
    fold = rng.integers(0, n_folds, len(df))
    rated = ds.matrix(df).toarray() > 0          # anything rated is never a negative
    Xs, y_rating, y_like = [], [], []
    for f in range(n_folds):
        hold = df[fold == f]
        R = ds.matrix(df[fold != f])
        builder.fit(R)
        mats = builder.matrices(R, self_idx=np.arange(R.shape[0]))
        Xs.append(pair_features(mats, hold["u"].values, hold["i"].values))
        y_rating.append(hold["rating"].values)
        y_like.append((hold["rating"].values >= 4.0).astype(int))
        if neg_per_pos:
            users, counts = np.unique(hold["u"].values, return_counts=True)
            score = candidate_scores(mats["iknn_rank"][users], mats["item_logn"], rated[users])
            cand = np.argpartition(-score, n_cand, axis=1)[:, :n_cand]
            neg_u, neg_i = [], []
            for row, (u, c) in enumerate(zip(users, counts)):
                pool = cand[row][np.isfinite(score[row, cand[row]])]
                k = min(len(pool), neg_per_pos * c)
                neg_u += [u] * k
                neg_i += list(rng.choice(pool, k, replace=False))
            Xs.append(pair_features(mats, np.array(neg_u), np.array(neg_i)))
            y_rating.append(np.full(len(neg_u), np.nan))
            y_like.append(np.zeros(len(neg_u), int))
        print(f"    OOF fold {f + 1}/{n_folds} done", flush=True)
    return np.vstack(Xs), np.concatenate(y_rating), np.concatenate(y_like)
