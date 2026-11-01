"""Generates and executes notebooks/02_training_evaluation.ipynb.

Run from the project root after `python -m ml.train`:
    python notebooks/make_eval.py
The notebook reads the saved artifacts and re-runs the light-weight pieces
(split checks, from-scratch vs sklearn logistic regression, demos).
"""
import nbformat as nbf
from nbconvert.preprocessors import ExecutePreprocessor

md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell

cells = [
    md("# 02 - Training & Evaluation\n"
       "This notebook documents how every model was trained, tuned and evaluated, "
       "and discusses the results. The heavy lifting lives in `ml/` and is run with "
       "`python -m ml.train`; here we load its artifacts and re-run the light parts.\n\n"
       "**Algorithms used:** k-nearest neighbours (item, user, content), linear regression, "
       "logistic regression (sklearn + from scratch), decision tree, SVM, K-means."),
    code("import sys, json\nsys.path.insert(0, '..')\n"
         "from pathlib import Path\nimport numpy as np, pandas as pd, joblib\n"
         "import matplotlib.pyplot as plt\nfrom IPython.display import Image, display\n"
         "ROOT = Path('..').resolve(); ART = ROOT / 'artifacts'; PLOTS = ART / 'plots'\n"
         "pd.set_option('display.precision', 4); pd.set_option('display.width', 200)"),

    md("## 1. Train / validation / test split (no leakage)\n"
       "Each user's ratings are sorted by time: oldest 80% train, next 10% validation, "
       "newest 10% test. Models therefore learn from a user's past and are scored on their "
       "future, which is how a deployed recommender is used. Validation is used only for "
       "early decisions (the hybrid weight); test is used once, at the end."),
    code("from ml.split import load_dataset\nds = load_dataset()\n"
         "display(pd.Series({'train': len(ds.train), 'validation': len(ds.val), 'test': len(ds.test)}).to_frame('ratings'))\n"
         "last_train = ds.train.groupby('u').timestamp.max()\n"
         "first_test = ds.test.groupby('u').timestamp.min().reindex(last_train.index)\n"
         "print('users whose training data is newer than their test data:', int((last_train > first_test).sum()))\n"
         "unseen = ~ds.test.i.isin(ds.train.i.unique())\n"
         "print(f'test ratings on movies never seen in training (cold items): {unseen.mean():.1%}')"),

    md("## 2. The models in one paragraph each\n"
       "* **Baselines** - global mean, user mean, item mean (damped), popularity (most rated), "
       "and the bias baseline `mu + b_u + b_i`. Anything 'intelligent' must beat these.\n"
       "* **Item-kNN** - two movies are similar if the same users rated them similarly "
       "(cosine on rating residuals, shrunk when few users co-rated them). A user's score for a "
       "movie is a similarity-weighted average of their own ratings of its neighbours.\n"
       "* **User-kNN** - the same idea across users: find the 100 users most like you.\n"
       "* **Content-kNN** - movies become TF-IDF vectors of genres, tags and plot; neighbours "
       "come from cosine similarity, so new movies can be recommended without any ratings.\n"
       "* **Hybrid** - `alpha * z(Item-kNN) + (1 - alpha) * z(Content-kNN)`, with alpha tuned on validation.\n"
       "* **Linear / logistic regression, decision tree, SVM** - supervised models trained on a "
       "table of 15 features per (user, movie) pair: user and item means, popularity, the user's "
       "genre affinity, kNN and content scores and K-means segment statistics. Regressors predict "
       "the star rating, classifiers predict P(rating >= 4). They re-rank the top-200 Item-kNN "
       "candidates (two-stage recommendation).\n"
       "* **K-means** - clusters users by genre taste; used as features and for cold start."),

    md("## 3. Hyper-parameter tuning\n"
       "kNN models: grid search with 3-fold cross-validation on the training ratings (RMSE). "
       "Supervised models: `GridSearchCV` (3 folds) on out-of-fold training features "
       "(RMSE for regressors, ROC-AUC for classifiers)."),
    code("grid = pd.read_csv(ART / 'tuning_grid_knn.csv')\n"
         "for name, g in grid.groupby('model'):\n"
         "    cols = [c for c in g.columns if c not in ('model', 'seconds') and g[c].notna().all()]\n"
         "    print(f'{name}: best 4 settings by 3-fold CV RMSE')\n"
         "    display(g[cols].sort_values('cv_rmse').head(4).reset_index(drop=True))\n"
         "params = json.loads((ART / 'best_params.json').read_text())\n"
         "print(json.dumps(params, indent=1))"),
    md("### Hybrid weight on validation data\n"
       "alpha = 1 is pure Item-kNN, alpha = 0 pure Content-kNN. Both curves peak in between, "
       "so the blend genuinely helps; the chosen alpha is the validation optimum."),
    code("display(Image(PLOTS / 'alpha_curve.png'))"),

    md("## 4. Test-set results\n"
       "* **RMSE / MAE** - error of predicted star ratings (lower is better).\n"
       "* **P@10, R@10, MAP@10, NDCG@10** - quality of the top-10 list; a hit is a test movie "
       "the user rated >= 4. NDCG rewards hits near the top.\n"
       "* **Coverage** - share of the catalogue ever recommended; **Diversity** - how different "
       "the movies inside one list are; **Novelty** - how unpopular (surprising) they are."),
    code("res = pd.read_csv(ART / 'results.csv', index_col=0)\n"
         "cols = ['RMSE', 'MAE', 'P@10', 'R@10', 'MAP@10', 'NDCG@10', 'Coverage', 'Diversity', 'Novelty', 'fit_s']\n"
         "res[cols].sort_values('NDCG@10', ascending=False).style.format(precision=4)"
         ".highlight_max(subset=['P@10', 'R@10', 'MAP@10', 'NDCG@10', 'Coverage', 'Diversity', 'Novelty'], color='#f6c3c0')"
         ".highlight_min(subset=['RMSE', 'MAE'], color='#f6c3c0')"),
    code("for p in ['accuracy.png', 'ranking.png', 'tradeoff.png']:\n    display(Image(PLOTS / p))"),

    md("## 5. Logistic regression from scratch vs scikit-learn\n"
       "`ml/logreg_scratch.py` implements logistic regression with batch gradient descent "
       "(sigmoid, cross-entropy, L2 penalty). We rebuild the leakage-free feature table and "
       "compare it with scikit-learn on a held-out 20% of training pairs."),
    code("from sklearn.linear_model import LogisticRegression\n"
         "from sklearn.metrics import accuracy_score, roc_auc_score\n"
         "from sklearn.pipeline import make_pipeline\nfrom sklearn.preprocessing import StandardScaler\n"
         "from ml.content import ContentModel\nfrom ml.features import FEATURES, FeatureBuilder, build_training_set\n"
         "from ml.logreg_scratch import LogisticRegressionScratch\n"
         "serving = joblib.load(ART / 'serving.joblib')\n"
         "content = ContentModel(ds.movies, ds.tags, k=int(params['knn']['content']['k']))\n"
         "builder = FeatureBuilder(ds, content, params['knn'], serving['n_segments'])\n"
         "X, y_rating, y_like = build_training_set(ds, ds.train, builder)\n"
         "rng = np.random.default_rng(0); hold = rng.random(len(X)) < 0.2\n"
         "scratch = LogisticRegressionScratch().fit(X[~hold], y_like[~hold])\n"
         "sk = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)).fit(X[~hold], y_like[~hold])\n"
         "rows = {}\n"
         "for name, m in [('from scratch', scratch), ('scikit-learn', sk)]:\n"
         "    p = m.predict_proba(X[hold])[:, 1]\n"
         "    rows[name] = {'ROC-AUC': roc_auc_score(y_like[hold], p), 'accuracy': accuracy_score(y_like[hold], p >= 0.5)}\n"
         "display(pd.DataFrame(rows).T)\n"
         "coef = pd.DataFrame({'from scratch': scratch.w, 'scikit-learn': sk[-1].coef_.ravel()}, index=FEATURES)\n"
         "print('correlation of the two coefficient vectors:', round(coef.corr().iloc[0, 1], 3))\n"
         "coef.sort_values('scikit-learn')"),
    md("**Why the predictions match but the coefficients differ.** Both models reach "
       "the same ROC-AUC, yet individual weights differ (e.g. `bias_pred` vs `user_mean` + "
       "`item_mean`). Those features are nearly linear combinations of each other "
       "(multicollinearity), so many different weight vectors give the same predictions; "
       "gradient descent stops after a fixed number of steps and settles on a different split "
       "of the weight than sklearn's L-BFGS solver. Interpret single coefficients with care."),
    code("display(Image(PLOTS / 'logreg_scratch_loss.png'))"),

    md("## 6. What the supervised models learned"),
    code("display(Image(PLOTS / 'logreg_coefficients.png')); display(Image(PLOTS / 'tree_importance.png'))"),

    md("## 7. K-means taste segments\n"
       "Users are described by the share of their ratings in each genre plus their mean rating. "
       "k was chosen by silhouette score. Low silhouette values mean the segments overlap: "
       "taste is a continuum rather than clean groups, so segments are coarse."),
    code("seg = serving['builder'].seg; names = serving['genre_names']\n"
         "centers = pd.DataFrame(seg.km.cluster_centers_[:, :len(names)], columns=names)\n"
         "summary = pd.DataFrame({\n"
         "    'users': np.bincount(seg.labels_, minlength=seg.k),\n"
         "    'mean rating': (seg.km.cluster_centers_[:, -1] * 5).round(2),\n"
         "    'top genres': [', '.join(centers.loc[c].nlargest(3).index) for c in range(seg.k)],\n"
         "})\nsummary.index.name = 'segment'\ndisplay(summary)\ndisplay(Image(PLOTS / 'segments.png'))"),

    md("## 8. Cold start\n"
       "**New users** keep only 5 liked movies (as if from onboarding). **New items** have all "
       "their ratings hidden from training, so only content can place them."),
    md("The new-user blend is `w * z(segment) + (1 - w) * z(content profile)`. The weight w was "
       "chosen on **validation** data: w = 1 (segment only) behaves almost like popularity, so we "
       "take the most personalised w within 5% of the best NDCG@10."),
    code("display(pd.read_csv(ART / 'cold_weight_validation.csv').set_index('w_seg'))\n"
         "print('chosen w_seg:', serving['alphas']['cold_w_seg'])"),
    code("cold = json.loads((ART / 'cold_start.json').read_text())\n"
         "for k in ['new_user', 'new_item']:\n"
         "    t = pd.DataFrame({m: v for m, v in cold[k].items() if not m.startswith('_')}).T\n"
         "    display(t[['NDCG@10', 'P@10', 'Coverage', 'Diversity']].sort_values('NDCG@10', ascending=False).rename_axis(k))\n"
         "display(Image(PLOTS / 'cold_start.png'))"),

    md("## 9. Explainability demo\n"
       "A brand-new user loves *Toy Story*, *The Lion King* and *Finding Nemo* and hates *Saw*. "
       "Each model scores this rating row directly (no retraining). The hybrid's picks are "
       "explained by the liked movie most similar to each recommendation."),
    code("from scipy import sparse\n"
         "idx = {m: i for i, m in enumerate(serving['item_ids'])}\n"
         "titles = ds.movies.set_index('movieId')['clean_title']\n"
         "picks = {1: 5.0, 364: 4.5, 6377: 5.0, 8957: 1.0}\n"
         "row = sparse.csr_matrix((list(picks.values()), ([0] * 4, [idx[m] for m in picks])), shape=(1, len(idx)))\n"
         "def top(model, k=5):\n"
         "    _, r = model.score_rows(row); r = np.asarray(r).ravel().copy(); r[row.indices] = -np.inf\n"
         "    return np.argsort(-r)[:k]\n"
         "models = {'Popularity': serving['popularity'], 'Content-kNN': serving['content'],\n"
         "          'Item-kNN': serving['item_knn'], 'Hybrid': serving['hybrid'],\n"
         "          'Logistic regression': serving['feature_models']['Logistic regression']}\n"
         "display(pd.DataFrame({n: [titles[serving['item_ids'][i]] for i in top(m)] for n, m in models.items()}))\n"
         "for i in top(serving['hybrid']):\n"
         "    why = serving['explainer'].because_you_liked(row, i, n=1)\n"
         "    print(f\"{titles[serving['item_ids'][i]]:35s} because you liked {titles[serving['item_ids'][why[0][0]]]} (sim {why[0][1]:.2f})\")"),

    md("## 10. Discussion\n"
       "**Rating prediction vs ranking disagree.** The supervised models predict ratings best "
       "(linear regression has the lowest RMSE), yet the kNN hybrid produces the best top-10 lists. "
       "RMSE only scores movies the user actually rated, whereas ranking must pick 10 good movies "
       "out of ~9,700 unseen ones. Trained only on rated pairs, the supervised re-rankers never "
       "learned to tell 'rated and liked' from 'never chosen'. Adding **hard negatives** (unrated "
       "movies from each user's own candidate list, about two per rated pair) raised their NDCG@10 "
       "by 16-44% (decision tree 0.050 -> 0.072) without changing RMSE. They still trail Item-kNN, "
       "which is also their candidate generator: with 15 hand-made features and a static split, "
       "re-ranking Item-kNN's own shortlist adds little beyond its ordering - learning-to-rank "
       "losses and richer features are the next step.\n\n"
       "**Accuracy vs diversity.** Popularity is a strong ranking baseline but recommends the same "
       "few blockbusters to everyone (tiny coverage, lowest novelty). Content-kNN has the highest "
       "coverage and novelty but very low intra-list diversity (it returns ten near-identical "
       "films) and weak accuracy. Collaborative models sit in between; the hybrid keeps Item-kNN's "
       "accuracy while borrowing some of content's reach.\n\n"
       "**Sparsity.** The matrix is 98.3% empty and 62% of movies have fewer than five ratings, "
       "so neighbourhood similarities for tail items are noisy. Shrinkage and the bias baseline "
       "make kNN usable; content features cover the tail.\n\n"
       "**Cold start.** Collaborative models cannot place unseen movies (near-random NDCG on the "
       "cold-item test) while Content-kNN more than triples it. For new users with five picks, the "
       "K-means segment is the strongest single signal; the validation-tuned blend (75% segment, "
       "25% content) keeps some personalisation, beats popularity, and stays within ~8% of the "
       "segment alone.\n\n"
       "**Scalability.** Item-kNN keeps only the top-k neighbours per movie (sparse matrix), so "
       "scoring a user is a sparse matrix product taking milliseconds. User-kNN must compare against "
       "every user at request time, which grows with the user base. The two-stage design (cheap "
       "candidate generation, expensive re-ranking of 200 items) is how production systems scale.\n\n"
       "**Limitations.** One small dataset (610 users), a single temporal split, TMDB plot text "
       "missing without an API key, explicit ratings only, and offline metrics only (no A/B test)."),
]

nb = nbf.v4.new_notebook(cells=cells)
ExecutePreprocessor(timeout=1200, kernel_name="python3").preprocess(nb, {"metadata": {"path": "notebooks"}})
nbf.write(nb, "notebooks/02_training_evaluation.ipynb")
print("ok")
