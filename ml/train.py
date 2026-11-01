"""Offline pipeline: tune -> validate -> test -> cold-start -> save artifacts.

    python -m ml.train               # full run (tuning takes a few minutes)
    python -m ml.train --skip-tune   # reuse artifacts/best_params.json

Algorithms: kNN (item / user / content), linear + logistic regression,
decision tree, SVM, K-means (segments) - plus simple baselines.
"""
import argparse
import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml import plots
from ml.baselines import (BiasBaseline, GlobalMean, ItemMean, Popularity,
                          UserMean)
from ml.cold_start import ColdStart
from ml.content import ContentModel
from ml.evaluate import (cold_item_experiment, cold_user_experiment,
                         evaluate_model, evaluate_pairs)
from ml.explain import Explainer
from ml.features import FEATURES, FeatureBuilder, build_training_set
from ml.hybrid import Hybrid, blend
from ml.knn import ItemKNN, UserKNN
from ml.ml_models import (SVR_SAMPLE, FeatureModel, fit_estimator, model_specs,
                          tune)
from ml.segments import UserSegments, choose_k, genre_matrix
from ml.split import load_dataset
from ml.tmdb import cached_overviews
from ml.tune import tune_knn

ART = Path(__file__).resolve().parents[1] / "artifacts"
PLOTS = ART / "plots"
ALPHAS = np.round(np.arange(0, 1.0001, 0.05), 2)


def _jsonable(o):
    return o.item() if hasattr(o, "item") else str(o)


def build_content(ds, overviews, k=50):
    return ContentModel(ds.movies, ds.tags, overviews, k=k)


def tune_alpha(cf, cb, R, ds, X):
    """Grid over the item-kNN weight on VALIDATION data only."""
    cf_s, cb_s = cf.train_scores(), cb.train_scores()
    rows = []
    for a in ALPHAS:
        pred, rank = blend(cf_s, cb_s, a, a)
        pairs = pred[ds.val["u"].values, ds.val["i"].values]
        m = evaluate_pairs(pairs, rank, R, ds.val, X, ks=(10,))
        rows.append({"alpha": a, "RMSE": m["RMSE"], "NDCG@10": m["NDCG@10"]})
    df = pd.DataFrame(rows)
    return (float(df.loc[df["RMSE"].idxmin(), "alpha"]),
            float(df.loc[df["NDCG@10"].idxmax(), "alpha"]), df)


def fit_supervised(ds, df, builder, specs, tuned):
    """Out-of-fold features -> fitted estimators for every spec.

    `tuned` maps (model, kind) -> best params; when empty, grids are searched.
    Returns (estimators dict, tuned params).
    """
    X, y_r, y_l = build_training_set(ds, df, builder)
    rated = ~np.isnan(y_r)
    print(f"    training rows: {rated.sum()} rated + {(~rated).sum()} hard negatives", flush=True)
    fitted, best = {}, dict(tuned)
    for name, spec in specs.items():
        fitted[name] = {}
        for kind, (pipe, grid) in spec.items():
            # Rating models learn from rated pairs; ranking models also see negatives.
            Xk, yk = (X[rated], y_r[rated]) if kind == "reg" else (X, y_l)
            sample = SVR_SAMPLE if name == "SVM" and kind == "reg" else None
            key = f"{name}|{kind}"
            if key not in best:
                print(f"    tuning {key}", flush=True)
                best[key] = tune(pipe, grid, Xk, yk, kind, sample)
            fitted[name][kind] = fit_estimator(pipe, best[key], Xk, yk, sample)
    return fitted, best


def make_feature_models(builder, fitted):
    return {name: FeatureModel(name, builder, est.get("reg"), est.get("clf"),
                               ranker=est.get("rank"))
            for name, est in fitted.items()}


COLD_WEIGHTS = [0.0, 0.25, 0.5, 0.75, 0.9, 1.0]


def tune_cold_weight(content, R, ds, G, genre_names, n_seg, X, tolerance=0.05):
    """Segment weight of the cold-start blend, chosen on VALIDATION data.

    w = 1 is the K-means segment alone, which behaves much like plain
    popularity. We take the most personalised (smallest) weight whose NDCG@10
    is within `tolerance` of the best, since smaller gaps are within noise.
    """
    seg = UserSegments(G, n_seg).fit(R)
    rows = []
    for w in COLD_WEIGHTS:
        cs = ColdStart(content, seg, R, genre_names, G, w_seg=w)
        m = cold_user_experiment({"cs": cs}, ds, R, ds.val, X)["cs"]
        rows.append({"w_seg": w, "NDCG@10": m["NDCG@10"], "P@10": m["P@10"],
                     "Coverage": m["Coverage"]})
    df = pd.DataFrame(rows)
    ok = df[df["NDCG@10"] >= (1 - tolerance) * df["NDCG@10"].max()]
    return float(ok["w_seg"].min()), df


def main(skip_tune=False):
    ART.mkdir(exist_ok=True)
    PLOTS.mkdir(exist_ok=True)
    ds = load_dataset()
    overviews = cached_overviews(ds.links)
    print(f"split: train={len(ds.train)} val={len(ds.val)} test={len(ds.test)}"
          f" | TMDB overviews cached: {len(overviews)}")
    R_tr = ds.matrix(ds.train)
    R_trva = ds.matrix(ds.train, ds.val)
    R_all = ds.matrix(ds.train, ds.val, ds.test)
    G, genre_names = genre_matrix(ds.movies)
    specs = model_specs()

    # 1. kNN hyper-parameters (3-fold CV on training ratings) ----------------
    best_file = ART / "best_params.json"
    if skip_tune and best_file.exists():
        params = json.loads(best_file.read_text())
    else:
        print("tuning kNN models")
        grid, knn_best = tune_knn(ds, lambda k: build_content(ds, overviews, int(k)))
        grid.to_csv(ART / "tuning_grid_knn.csv", index=False)
        params = {"knn": knn_best, "supervised": {}}
        best_file.write_text(json.dumps(params, indent=2, default=_jsonable))
    knn = params["knn"]
    params_flat = {"item_knn": knn["item_knn"], "user_knn": knn["user_knn"],
                   "content": knn["content"]}
    print("kNN params:", knn)

    content = build_content(ds, overviews, int(knn["content"]["k"]))
    content.fit(R_tr)
    X = content.Xn          # row-normalised features for the diversity metric

    # 2. K-means segments: choose k, make plot --------------------------------
    n_seg, sil = choose_k(R_tr, G)
    print(f"K-means: best k={n_seg} silhouettes={ {k: round(v, 3) for k, v in sil.items()} }")

    # 3. Validation stage: hybrid weight --------------------------------------
    item_knn = ItemKNN(**knn["item_knn"]).fit(R_tr)
    a_r, a_k, alpha_df = tune_alpha(item_knn, content, R_tr, ds, X)
    print(f"Hybrid weights on validation: alpha_rating={a_r} alpha_rank={a_k}")
    plots.alpha_plot({"Item-kNN + content": alpha_df}, PLOTS / "alpha_curve.png")
    w_cold, cold_df = tune_cold_weight(content, R_tr, ds, G, genre_names, n_seg, X)
    cold_df.to_csv(ART / "cold_weight_validation.csv", index=False)
    print(f"Cold-start segment weight on validation: {w_cold}\n{cold_df.round(4).to_string(index=False)}")

    # 4. Supervised models: tune on out-of-fold train features -----------------
    builder = FeatureBuilder(ds, content, params_flat, n_seg)
    print("supervised models: tuning on train-only OOF features")
    _, sup_params = fit_supervised(ds, ds.train, builder, specs, params["supervised"])
    params["supervised"] = sup_params
    best_file.write_text(json.dumps(params, indent=2, default=_jsonable))

    # 5. Final fit on train+val, single evaluation on the test set -------------
    def fit_all(R, df):
        content.fit(R)
        base = {"Global mean": GlobalMean(), "User mean": UserMean(),
                "Item mean": ItemMean(), "Popularity": Popularity(),
                "Bias baseline": BiasBaseline(),
                "User-kNN": UserKNN(**knn["user_knn"]),
                "Item-kNN": ItemKNN(**knn["item_knn"]), "Content-kNN": content}
        times = {}
        for n, m in base.items():
            t = time.time()
            m.fit(R)
            times[n] = time.time() - t
        base["Hybrid (Item-kNN + content)"] = Hybrid(
            base["Item-kNN"], content, a_r, a_k)
        times["Hybrid (Item-kNN + content)"] = times["Item-kNN"] + times["Content-kNN"]
        t = time.time()
        fitted, _ = fit_supervised(ds, df, builder, specs, sup_params)
        fit_s = (time.time() - t) / len(specs)
        builder.fit(R)
        fm = make_feature_models(builder, fitted)
        for n in fm:
            times[n] = fit_s
        return base, fm, fitted, times

    print("final fit on train+val")
    base, feat, fitted, fit_times = fit_all(R_trva, pd.concat([ds.train, ds.val]))
    rows = {}
    for name, m in base.items():
        t = time.time()
        m.score_rows(R_trva[:50])
        ms = (time.time() - t) / 50 * 1000
        rows[name] = {**evaluate_model(m, R_trva, ds.test, X),
                      "fit_s": fit_times[name], "infer_ms_per_user": ms}
    for name, m in feat.items():
        t = time.time()
        m.score_rows(R_trva[:50])
        ms = (time.time() - t) / 50 * 1000
        pairs, rank = m.evaluate_inputs(R_trva, ds.test)
        rows[name] = {**evaluate_pairs(pairs, rank, R_trva, ds.test, X),
                      "fit_s": fit_times[name], "infer_ms_per_user": ms}
    results = pd.DataFrame(rows).T
    results.index.name = "model"
    results.to_csv(ART / "results.csv")
    print(results[["RMSE", "MAE", "P@10", "R@10", "MAP@10", "NDCG@10",
                   "Coverage", "Diversity", "Novelty"]].round(4).to_string())

    plots.accuracy_plot(results.dropna(subset=["RMSE"]), PLOTS / "accuracy.png")
    plots.ranking_plot(results, PLOTS / "ranking.png")
    plots.tradeoff_plot(results, PLOTS / "tradeoff.png")

    # Interpretability: coefficients and tree importances (viva material)
    lr = fitted["Logistic regression"]["clf"].named_steps["m"]
    plots.importance_plot(FEATURES, lr.coef_.ravel(),
                          "Logistic regression coefficients (standardised)",
                          PLOTS / "logreg_coefficients.png")
    tree = fitted["Decision tree"]["clf"].named_steps["m"]
    plots.importance_plot(FEATURES, tree.feature_importances_,
                          "Decision tree feature importance", PLOTS / "tree_importance.png")
    plots.loss_curve_plot(fitted["Logistic regression (from scratch)"]["clf"].loss_history,
                          PLOTS / "logreg_scratch_loss.png")
    seg = builder.seg
    plots.segments_plot(seg, genre_names, sil, PLOTS / "segments.png")

    # 6. Cold-start experiments ---------------------------------------------
    cold_blend = ColdStart(content, seg, R_trva, genre_names, G, w_seg=w_cold)
    cold_seg = ColdStart(content, seg, R_trva, genre_names, G, w_seg=1.0)
    cold_user = cold_user_experiment(
        {"Popularity": base["Popularity"], "Content-kNN": content,
         "K-means segment": cold_seg, "Segment + content": cold_blend,
         "Item-kNN": base["Item-kNN"]}, ds, R_trva, ds.test, X)

    def make_cold_models(R):
        c = build_content(ds, overviews, int(knn["content"]["k"])).fit(R)
        ik = ItemKNN(**knn["item_knn"]).fit(R)
        return {"Random": GlobalMean().fit(R), "Item-kNN": ik,
                "User-kNN": UserKNN(**knn["user_knn"]).fit(R), "Content-kNN": c,
                "Hybrid (Item-kNN + content)": Hybrid(ik, c, a_r, a_k)}

    cold_item = cold_item_experiment(make_cold_models, ds, X)
    plots.cold_plot(cold_user, cold_item, PLOTS / "cold_start.png")
    (ART / "cold_start.json").write_text(json.dumps(
        {"new_user": cold_user, "new_item": cold_item}, indent=2))
    print("cold user NDCG@10:", {k: round(v["NDCG@10"], 4) for k, v in cold_user.items() if not k.startswith("_")})
    print("cold item NDCG@10:", {k: round(v["NDCG@10"], 4) for k, v in cold_item.items() if not k.startswith("_")})

    # 7. Serving artifacts: refit on ALL ratings ------------------------------
    print("refit on all ratings for serving")
    base, feat, fitted, _ = fit_all(R_all, pd.concat([ds.train, ds.val, ds.test]))
    seg = builder.seg
    serving = {
        "item_ids": ds.item_ids, "user_ids": ds.user_ids, "R": R_all,
        "genre_names": genre_names, "G": G,
        "popularity": base["Popularity"], "content": content,
        "item_knn": base["Item-kNN"], "user_knn": base["User-kNN"],
        "hybrid": base["Hybrid (Item-kNN + content)"],
        "feature_models": feat, "builder": builder,
        "cold_start": ColdStart(content, seg, R_all, genre_names, G, w_seg=w_cold),
        "explainer": Explainer(content, base["Item-kNN"]),
        "params": params, "n_segments": n_seg,
        "alphas": {"alpha_rating": a_r, "alpha_rank": a_k, "cold_w_seg": w_cold},
    }
    joblib.dump(serving, ART / "serving.joblib", compress=3)
    print("saved", ART / "serving.joblib")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-tune", action="store_true")
    main(ap.parse_args().skip_tune)
