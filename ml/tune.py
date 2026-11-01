"""Hyper-parameter tuning for the kNN models: grid search with k-fold CV.

Folds are random splits of the TRAINING ratings only (validation and test
data are never touched). The criterion is mean held-out RMSE. The supervised
models are tuned separately with GridSearchCV (see ml/ml_models.py).
"""
import itertools
import time

import numpy as np
import pandas as pd

from ml.knn import ItemKNN, UserKNN
from ml.metrics import rmse


def cv_rmse(make_model, ds, n_splits=3, seed=0):
    """Mean RMSE of `make_model()` over k random folds of the training ratings."""
    rng = np.random.default_rng(seed)
    fold = rng.integers(0, n_splits, len(ds.train))
    scores = []
    for f in range(n_splits):
        fit_df, hold = ds.train[fold != f], ds.train[fold == f]
        model = make_model().fit(ds.matrix(fit_df))
        pred = model.train_scores()[0]
        p = pred[hold["u"].values, hold["i"].values]
        scores.append(rmse(hold["rating"].values, p))
    return float(np.mean(scores))


def grid_search(name, factory, grid, ds, n_splits=3):
    keys = list(grid)
    rows = []
    for combo in itertools.product(*grid.values()):
        params = dict(zip(keys, combo))
        t = time.time()
        score = cv_rmse(lambda: factory(**params), ds, n_splits)
        rows.append({"model": name, **params, "cv_rmse": score,
                     "seconds": time.time() - t})
        print(f"  {name} {params} -> {score:.4f}", flush=True)
    df = pd.DataFrame(rows)
    best = df.loc[df["cv_rmse"].idxmin()]
    return df, {k: best[k].item() if hasattr(best[k], "item") else best[k] for k in keys}


def tune_knn(ds, content_factory):
    """Run every kNN grid; returns (results DataFrame, best-params dict)."""
    searches = {
        "item_knn": (ItemKNN, {"k": [20, 40, 80], "shrink": [10, 30, 60]}),
        "user_knn": (UserKNN, {"k": [30, 50, 100], "shrink": [5, 10, 30]}),
        "content": (content_factory, {"k": [20, 50, 100]}),
    }
    frames, best = [], {}
    for name, (factory, grid) in searches.items():
        df, b = grid_search(name, factory, grid, ds)
        frames.append(df)
        best[name] = b
    return pd.concat(frames, ignore_index=True), best
