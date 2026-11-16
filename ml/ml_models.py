"""Supervised models on the feature table: linear / logistic regression,
decision tree and SVM, wrapped as recommenders.

Two-stage design (standard in industry):
  1. candidate generation - the 200 best unseen movies per user by item-kNN
     score (blended with popularity), because scoring all 9.7k movies with
     every model is wasteful;
  2. re-ranking - the supervised model scores those candidates.
Regressors predict the star rating (used for RMSE); classifiers predict
P(liked), trained on rated pairs plus hard negatives (see build_training_set).
Linear regression ranks with a second linear model fitted to the same liked /
not-liked target (a linear probability model).
"""
import copy

import numpy as np
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.model_selection import GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR, LinearSVC
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from ml.baselines import Recommender
from ml.features import candidate_scores, pair_features
from ml.logreg_scratch import LogisticRegressionScratch

SVR_SAMPLE = 10000   # RBF-SVR is O(n^2): fit on a random subsample


def _pipe(est):
    return Pipeline([("scale", StandardScaler()), ("m", est)])


def model_specs():
    """name -> {kind: (pipeline, grid)} with kind in reg / clf / rank.

    reg  : predicts the star rating, trained on rated pairs only
    clf  : predicts liked vs not liked, trained on rated pairs + hard negatives
    rank : regression on that same 0/1 target, used only to order candidates
    """
    tree_grid = {"m__max_depth": [4, 6, 8, 12], "m__min_samples_leaf": [20, 50, 100]}
    return {
        "Linear regression": {"reg": (_pipe(LinearRegression()), {}),
                              "rank": (_pipe(LinearRegression()), {})},
        "Logistic regression": {
            "clf": (_pipe(LogisticRegression(max_iter=1000)),
                    {"m__C": [0.01, 0.1, 1, 10]})},
        "Logistic regression (from scratch)": {
            "clf": (LogisticRegressionScratch(), {})},
        "Decision tree": {
            "reg": (_pipe(DecisionTreeRegressor(random_state=0)), tree_grid),
            "clf": (_pipe(DecisionTreeClassifier(random_state=0)), tree_grid)},
        "SVM": {
            "reg": (_pipe(SVR(kernel="rbf")), {"m__C": [0.5, 1, 2]}),
            "clf": (_pipe(LinearSVC(max_iter=5000)), {"m__C": [0.01, 0.1, 1]})},
    }


def tune(pipe, grid, X, y, kind, sample=None, seed=0):
    """3-fold CV grid search; returns the best parameter dict."""
    if not grid:
        return {}
    if sample and len(X) > sample:
        idx = np.random.default_rng(seed).choice(len(X), sample, replace=False)
        X, y = X[idx], y[idx]
    scoring = "neg_root_mean_squared_error" if kind == "reg" else "roc_auc"
    gs = GridSearchCV(pipe, grid, cv=3, scoring=scoring, n_jobs=-1).fit(X, y)
    print(f"      best {gs.best_params_} cv={gs.best_score_:.4f}", flush=True)
    return gs.best_params_


def fit_estimator(pipe, params, X, y, sample=None, seed=0):
    est = copy.deepcopy(pipe)
    if params:
        est.set_params(**params)
    if sample and len(X) > sample:
        idx = np.random.default_rng(seed).choice(len(X), sample, replace=False)
        X, y = X[idx], y[idx]
    return est.fit(X, y)


class FeatureModel(Recommender):
    def __init__(self, name, builder, reg=None, clf=None, n_cand=200, ranker=None):
        self.name, self.builder = name, builder
        self.reg, self.clf, self.n_cand, self.ranker = reg, clf, n_cand, ranker

    def _rank_score(self, Xp):
        if getattr(self, "ranker", None) is not None:
            return self.ranker.predict(Xp)
        if self.clf is not None:
            if hasattr(self.clf, "predict_proba"):
                return self.clf.predict_proba(Xp)[:, 1]
            return self.clf.decision_function(Xp)
        return self.reg.predict(Xp)

    def predict_pairs(self, mats, u, i):
        """Rating predictions for pairs (NaN for classifier-only models)."""
        if self.reg is None:
            return np.full(len(u), np.nan)
        return self.reg.predict(pair_features(mats, u, i))

    def candidates(self, mats, R_rows):
        score = candidate_scores(mats["iknn_rank"], mats["item_logn"], R_rows.toarray() > 0)
        return np.argpartition(-score, self.n_cand, axis=1)[:, :self.n_cand]

    def rank_matrix(self, mats, R_rows):
        n, n_items = R_rows.shape
        cand = self.candidates(mats, R_rows)
        u = np.repeat(np.arange(n), self.n_cand)
        i = cand.ravel()
        s = self._rank_score(pair_features(mats, u, i))
        rank = np.full((n, n_items), -np.inf, np.float32)
        rank[u, i] = s
        return rank

    def score_rows(self, R_rows, self_idx=None):
        R_rows = R_rows.tocsr()
        mats = self.builder.matrices(R_rows, self_idx)
        return None, self.rank_matrix(mats, R_rows)

    def evaluate_inputs(self, R_hist, eval_df):
        """(rating predictions for eval pairs, rank matrix) for R_hist's users."""
        mats = self.builder.matrices(R_hist, np.arange(R_hist.shape[0]))
        pairs = self.predict_pairs(mats, eval_df["u"].values, eval_df["i"].values)
        return pairs, self.rank_matrix(mats, R_hist)
