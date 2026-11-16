"""Rating-prediction and top-N ranking metrics (all vectorised)."""
import numpy as np


def rmse(y, p) -> float:
    return float(np.sqrt(np.mean((np.asarray(y) - np.asarray(p)) ** 2)))


def mae(y, p) -> float:
    return float(np.mean(np.abs(np.asarray(y) - np.asarray(p))))


def ranking_metrics(rank, seen, rel, item_pop, X=None, ks=(5, 10, 20), div_k=10):
    """Top-N metrics for a dense score matrix.

    rank     (U, I) float scores, higher = better
    seen     (U, I) bool, items excluded from the candidate list (user history)
    rel      (U, I) bool, held-out items the user liked (the "ground truth")
    item_pop (I,)   number of training users who rated each item
    X        (I, F) L2-normalised content features, used for diversity

    Precision/Recall/MAP/NDCG are averaged over users with >= 1 relevant item.
    Coverage = share of the catalogue appearing in any top-`div_k` list.
    Diversity = mean intra-list distance (1 - cosine). Novelty = mean
    self-information -log2(popularity share) of recommended items.
    """
    n_users_hist = rank.shape[0]
    # Tiny popularity tie-breaker so that all-zero score rows are deterministic.
    tie = 1e-4 * np.log1p(item_pop) / max(np.log1p(item_pop).max(), 1e-9)
    scores = np.where(seen, -np.inf, rank + tie[None, :]).astype(np.float32)

    users = np.flatnonzero(rel.sum(1) > 0)
    kmax = max(max(ks), div_k)
    sub = scores[users]
    part = np.argpartition(-sub, kmax, axis=1)[:, :kmax]
    order = np.argsort(-np.take_along_axis(sub, part, 1), axis=1)
    top = np.take_along_axis(part, order, 1)                  # (n, kmax) best first
    hits = rel[users[:, None], top]
    n_rel = rel[users].sum(1)

    disc = 1.0 / np.log2(np.arange(2, kmax + 2))
    cum_disc = np.cumsum(disc)
    out = {}
    for k in ks:
        h = hits[:, :k]
        out[f"P@{k}"] = float((h.sum(1) / k).mean())
        out[f"R@{k}"] = float((h.sum(1) / n_rel).mean())
        prec_at = np.cumsum(h, 1) / np.arange(1, k + 1)
        out[f"MAP@{k}"] = float(((h * prec_at).sum(1) / np.minimum(n_rel, k)).mean())
        dcg = (h * disc[:k]).sum(1)
        idcg = cum_disc[np.minimum(n_rel, k) - 1]
        out[f"NDCG@{k}"] = float((dcg / idcg).mean())

    t = top[:, :div_k]
    out["Coverage"] = float(len(np.unique(t)) / scores.shape[1])
    out["Novelty"] = float(-np.log2((item_pop[t] + 1) / (n_users_hist + 1)).mean())
    if X is not None:
        iu = np.triu_indices(div_k, 1)
        d = []
        for row in t:
            v = X[row]
            d.append(1.0 - (v @ v.T).toarray()[iu].mean())
        out["Diversity"] = float(np.mean(d))
    return out
