"""Evaluation harness: accuracy, ranking and cold-start experiments."""
import numpy as np
import pandas as pd
from scipy import sparse

from ml.baselines import LIKE_THRESHOLD
from ml.metrics import mae, ranking_metrics, rmse
from ml.split import Dataset


def relevance_matrix(df, shape, thr=LIKE_THRESHOLD):
    rel = np.zeros(shape, bool)
    m = df["rating"].values >= thr
    rel[df["u"].values[m], df["i"].values[m]] = True
    return rel


def evaluate_pairs(pred_pairs, rank, R_hist, eval_df, X, ks=(5, 10, 20)):
    """RMSE/MAE on the eval pairs (NaN when the model gives no rating) plus
    top-N metrics from the score matrix `rank`.

    R_hist is the matrix the model was fitted on; its items are excluded from
    every user's candidate list so the model must recommend unseen movies.
    """
    y = eval_df["rating"].values
    res = {"RMSE": np.nan, "MAE": np.nan}
    if pred_pairs is not None and not np.all(np.isnan(pred_pairs)):
        p = np.clip(pred_pairs, 0.5, 5.0)
        res = {"RMSE": rmse(y, p), "MAE": mae(y, p)}
    rel = relevance_matrix(eval_df, R_hist.shape)
    seen = R_hist.toarray() > 0
    pop = R_hist.getnnz(axis=0)
    res.update(ranking_metrics(rank, seen, rel, pop, X, ks))
    return res


def evaluate_model(model, R_hist, eval_df, X, ks=(5, 10, 20)):
    pred, rank = model.train_scores()
    pairs = pred[eval_df["u"].values, eval_df["i"].values]
    return evaluate_pairs(pairs, rank, R_hist, eval_df, X, ks)


def cold_user_experiment(models, ds: Dataset, R_hist, test_df, X, n_given=5,
                         seed=0, ks=(10,)):
    """Simulate new users who only name `n_given` liked movies.

    Each test user keeps n_given random liked history items as their
    "onboarding picks". Models see only those; everything else in the user's
    history is hidden from the model but still excluded from candidates.
    """
    rng = np.random.default_rng(seed)
    rel = relevance_matrix(test_df, R_hist.shape)
    R_hist = R_hist.tocsr()
    rows, cols, vals, keep = [], [], [], []
    for u in np.flatnonzero(rel.sum(1) > 0):
        s, e = R_hist.indptr[u], R_hist.indptr[u + 1]
        idx, data = R_hist.indices[s:e], R_hist.data[s:e]
        good = np.flatnonzero(data >= LIKE_THRESHOLD)
        if len(good) < n_given:
            continue
        pick = rng.choice(good, n_given, replace=False)
        rows += [u] * n_given
        cols += list(idx[pick])
        vals += list(data[pick])
        keep.append(u)
    keep = np.array(keep)
    R_cold = sparse.csr_matrix((vals, (rows, cols)), shape=R_hist.shape)[keep]
    seen = (R_hist.toarray() > 0)[keep]
    rel_k = rel[keep]
    pop = R_hist.getnnz(axis=0)
    out = {}
    for name, m in models.items():
        # self_idx stops neighbour models matching the user to their own full row
        _, rank = m.score_rows(R_cold, self_idx=keep)
        out[name] = ranking_metrics(rank, seen, rel_k, pop, X, ks)
    out["_n_users"] = int(len(keep))
    return out


def cold_item_experiment(make_models, ds: Dataset, X, frac=0.1, min_ratings=10,
                         seed=0, ks=(10,)):
    """Hide ALL ratings of a random 10% of items from training, then rank only
    those items. Rating-based models have never seen them; content-kNN can
    score them from metadata alone. `make_models(R) -> {name: fitted model}`."""
    rng = np.random.default_rng(seed)
    all_df = pd.concat([ds.train, ds.val, ds.test])
    counts = all_df.groupby("i").size()
    eligible = counts[counts >= min_ratings].index.values
    cold = rng.choice(eligible, int(len(eligible) * frac), replace=False)
    is_cold = np.zeros(ds.n_items, bool)
    is_cold[cold] = True
    hist = pd.concat([ds.train, ds.val])
    hist = hist[~is_cold[hist["i"].values]]
    R_hist = ds.matrix(hist)
    cold_df = all_df[is_cold[all_df["i"].values]]
    rel = relevance_matrix(cold_df, R_hist.shape)
    seen = np.repeat((~is_cold)[None, :], ds.n_users, axis=0)  # only cold items remain
    pop = R_hist.getnnz(axis=0)
    out = {}
    for name, m in make_models(R_hist).items():
        _, rank = m.train_scores()
        out[name] = ranking_metrics(rank, seen, rel, pop, X, ks)
    out["_n_cold_items"] = int(is_cold.sum())
    return out
