"""Generates and executes notebooks/01_eda.ipynb (run from project root)."""
import nbformat as nbf
from nbconvert.preprocessors import ExecutePreprocessor

md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell
cells = [
    md("# 01 - Data Cleaning & Exploratory Data Analysis\n"
       "MovieLens `ml-latest-small`. Goals: understand rating behaviour, "
       "sparsity and the long tail, since they drive every modelling choice."),
    code("import sys; sys.path.insert(0, '..')\n"
         "import numpy as np, pandas as pd\n"
         "import matplotlib.pyplot as plt, seaborn as sns\n"
         "from ml.data import build_processed\n"
         "sns.set_theme(style='darkgrid'); plt.rcParams['figure.figsize'] = (8, 4)\n"
         "d = build_processed()\n"
         "movies, ratings, tags = d['movies'], d['ratings'], d['tags']\n"
         "print(ratings.shape, movies.shape, tags.shape)"),
    md("## 1. Cleaning summary\nDuplicates and orphan ratings were dropped; "
       "year parsed from title; genres split; tags lower-cased."),
    code("print('missing ratings:', ratings.rating.isna().sum())\n"
         "print('movies without year:', movies.year.isna().sum())\n"
         "print('movies without genre:', (movies.genres_list.str.len() == 0).sum())\n"
         "ratings.describe()"),
    md("## 2. Rating distribution\nRatings skew positive (users rate what they "
       "like), so a global-mean baseline is already strong and RMSE gains are "
       "small in absolute terms."),
    code("ratings.rating.value_counts().sort_index().plot.bar(color='#E8403A')\n"
         "plt.title('Rating distribution'); plt.xlabel('rating'); plt.show()\n"
         "print('mean', ratings.rating.mean().round(3), 'std', ratings.rating.std().round(3))"),
    md("## 3. Sparsity\nA user-item matrix this empty is why neighbourhood "
       "methods struggle and matrix factorisation helps."),
    code("n_u, n_i = ratings.userId.nunique(), ratings.movieId.nunique()\n"
         "sparsity = 1 - len(ratings) / (n_u * n_i)\n"
         "print(f'users={n_u} items={n_i} ratings={len(ratings)} sparsity={sparsity:.2%}')"),
    md("## 4. Long-tail popularity\nA few blockbusters collect most ratings; "
       "most movies have very few. Popularity recommenders exploit the head, "
       "while coverage and novelty metrics expose the tail."),
    code("pop = ratings.groupby('movieId').size().sort_values(ascending=False).values\n"
         "fig, ax = plt.subplots(1, 2, figsize=(12, 4))\n"
         "ax[0].plot(pop, color='#E8403A'); ax[0].set(title='Ratings per movie (ranked)', xlabel='rank', ylabel='# ratings')\n"
         "ax[1].plot(np.arange(1, len(pop)+1)/len(pop), np.cumsum(pop)/pop.sum(), color='#E8403A')\n"
         "ax[1].set(title='Cumulative share of ratings', xlabel='share of movies', ylabel='share of ratings')\n"
         "plt.show()\n"
         "top20 = int(0.2 * len(pop)); print(f'Top 20% of movies hold {pop[:top20].sum()/pop.sum():.1%} of ratings')\n"
         "print(f'Movies with < 5 ratings: {(pop < 5).mean():.1%}')"),
    md("## 5. Ratings per user\nHeavy-tailed too; every user has >= 20 ratings "
       "(dataset guarantee), which makes per-user splitting feasible."),
    code("per_user = ratings.groupby('userId').size()\n"
         "sns.histplot(per_user, bins=50, color='#E8403A'); plt.title('Ratings per user'); plt.xscale('log'); plt.show()\n"
         "print(per_user.describe())"),
    md("## 6. Genre distribution"),
    code("g = movies.explode('genres_list').genres_list.value_counts()\n"
         "g.drop('', errors='ignore').sort_values().plot.barh(color='#E8403A', figsize=(7, 6))\n"
         "plt.title('Movies per genre'); plt.show()"),
    md("## 7. Rating by genre and release decade"),
    code("r = ratings.merge(movies[['movieId', 'genres_list', 'year']], on='movieId')\n"
         "ge = r.explode('genres_list')\n"
         "ge.groupby('genres_list').rating.mean().sort_values().plot.barh(color='#E8403A', figsize=(7, 6))\n"
         "plt.title('Mean rating by genre'); plt.show()\n"
         "r['decade'] = (r.year // 10 * 10)\n"
         "r.groupby('decade').rating.agg(['mean', 'count']).dropna()"),
    md("## 8. Tags and time span\nTags feed the content model; timestamps "
       "justify a temporal split.")
    ,
    code("print('tags:', len(tags), 'unique:', tags.tag.nunique(), 'movies tagged:', tags.movieId.nunique())\n"
         "print(tags.tag.value_counts().head(15))\n"
         "ts = pd.to_datetime(ratings.timestamp, unit='s')\n"
         "print('ratings span', ts.min().date(), 'to', ts.max().date())"),
    md("## Takeaways\n- Sparse, long-tailed, positively skewed ratings.\n"
       "- Popularity is a strong baseline; accuracy metrics alone reward it.\n"
       "- Tail items need content features (cold start).\n"
       "- Use a per-user temporal split to avoid leakage."),
]
nb = nbf.v4.new_notebook(cells=cells)
ExecutePreprocessor(timeout=300, kernel_name="python3").preprocess(
    nb, {"metadata": {"path": "notebooks"}})
nbf.write(nb, "notebooks/01_eda.ipynb")
print("ok")
