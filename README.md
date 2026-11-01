# WhatShouldIWatchToday - Movie Recommender System

A machine-learning movie recommender built as a B.E. Computer Science ML project.
It compares classic ML algorithms on MovieLens data with proper offline evaluation, and
serves them through a FastAPI backend and a cinematic React frontend where you can
rate movies and switch models live.

**Algorithms:** k-nearest neighbours (item, user and content-based), linear regression,
logistic regression (scikit-learn **and** written from scratch in NumPy), decision tree,
support vector machine, K-means, plus simple baselines.

---

## Features

- **Personalised recommendations** that update the moment you rate a movie (no retraining).
- **Model switcher**: popularity, content, collaborative (kNN), hybrid, K-means, linear /
  logistic regression, decision tree, SVM. Compare four models side by side on one page.
- **Cold start**: new users pick genres and favourite movies; a K-means taste segment plus
  content similarity serves them until they have rated 5 movies. New movies are placed by
  content alone.
- **Explainability**: every pick says *"Because you liked X"* and shows a match percentage.
- **Movie detail page** with a content-based "Related Movies" carousel.
- **Under the hood** page with the full results table, cold-start results and all plots.
- Dark (default) and light themes, responsive, keyboard accessible, skeleton loaders,
  lazy-loaded images with placeholder art.

## Results (test set, MovieLens ml-latest-small)

Per-user temporal split (each user's oldest 80% of ratings for training, next 10% validation,
newest 10% test). A "hit" is a test movie the user rated 4 or more.

| Model | RMSE ↓ | MAE ↓ | P@10 ↑ | R@10 ↑ | NDCG@10 ↑ | Coverage ↑ | Diversity ↑ | Novelty ↑ |
|---|---|---|---|---|---|---|---|---|
| **Hybrid (Item-kNN + content)** | 0.862 | 0.662 | **0.052** | **0.088** | **0.085** | 0.079 | 0.740 | 2.98 |
| Item-kNN | 0.868 | 0.667 | 0.050 | 0.087 | 0.084 | 0.076 | 0.775 | 2.90 |
| User-kNN | 0.878 | 0.679 | 0.043 | 0.078 | 0.071 | 0.020 | 0.817 | 1.67 |
| Logistic regression (from scratch) | - | - | 0.035 | 0.058 | 0.053 | 0.049 | 0.752 | 2.90 |
| **Linear regression** | **0.841** | 0.645 | 0.034 | 0.056 | 0.053 | 0.058 | 0.744 | 2.86 |
| Decision tree | 0.848 | 0.649 | 0.032 | 0.054 | 0.053 | 0.050 | 0.784 | 2.51 |
| SVM | 0.845 | **0.638** | 0.034 | 0.051 | 0.051 | 0.057 | 0.754 | 3.01 |
| Logistic regression | - | - | 0.034 | 0.051 | 0.051 | 0.057 | 0.753 | 3.00 |
| Popularity | 0.999 | 0.777 | 0.028 | 0.048 | 0.047 | 0.012 | 0.804 | 1.46 |
| Bias baseline (μ + b<sub>u</sub> + b<sub>i</sub>) | 0.896 | 0.696 | 0.022 | 0.034 | 0.033 | 0.007 | 0.801 | 2.31 |
| Content-kNN | 0.910 | 0.698 | 0.005 | 0.009 | 0.009 | 0.201 | 0.263 | 5.61 |
| Global mean (random ranking) | 1.075 | 0.847 | 0.001 | 0.001 | 0.001 | 0.439 | 0.816 | 7.10 |

**Cold start (NDCG@10):** new users with 5 picks - K-means segment 0.053, popularity 0.047,
Item-kNN 0.041. New (unrated) items - Content-kNN 0.110 vs Item-kNN 0.045 vs random 0.037.

Key take-aways (full discussion in `notebooks/02_training_evaluation.ipynb`):
- Supervised models predict *ratings* best, but the kNN hybrid builds the best *top-10 lists*.
- Popularity is accurate but recommends the same blockbusters to everyone (1% coverage).
- Content-kNN reaches the long tail and new movies, but its lists are repetitive.
- The from-scratch logistic regression matches scikit-learn exactly (ROC-AUC 0.807 both).

> Screenshots: see `docs/screenshots/` (Home, Movie detail, For You, Under the hood, Browse).

---

## Project structure

```
ML MOVIE PROJECT/
├── ml/                     # all machine learning (importable package)
│   ├── download.py         # fetch MovieLens
│   ├── data.py             # cleaning -> data/processed/*.parquet
│   ├── tmdb.py             # TMDB enrichment with on-disk cache
│   ├── split.py            # per-user temporal train/val/test split
│   ├── baselines.py        # base class, bias model, mean/popularity baselines
│   ├── knn.py              # Item-kNN, User-kNN, sparse top-k cosine
│   ├── content.py          # Content-kNN (TF-IDF of genres + tags + plot)
│   ├── hybrid.py           # weighted Item-kNN + content blend
│   ├── segments.py         # K-means taste segments
│   ├── features.py         # leakage-free feature table for supervised models
│   ├── ml_models.py        # linear/logistic regression, tree, SVM re-rankers
│   ├── logreg_scratch.py   # logistic regression from scratch (gradient descent)
│   ├── cold_start.py       # new-user / new-item handling
│   ├── explain.py          # "Because you liked X"
│   ├── metrics.py          # RMSE, MAE, P/R/MAP/NDCG@K, coverage, diversity, novelty
│   ├── evaluate.py         # evaluation + cold-start experiments
│   ├── tune.py             # grid search with k-fold CV
│   ├── plots.py            # report figures
│   └── train.py            # full offline pipeline
├── notebooks/
│   ├── 01_eda.ipynb                  # data cleaning + EDA
│   ├── 02_training_evaluation.ipynb  # tuning, results, discussion
│   └── make_eda.py / make_eval.py    # regenerate + execute the notebooks
├── backend/app/            # FastAPI: main.py, db.py (SQLite), routers/, services/
├── api/index.py            # Vercel serverless entry point (same FastAPI app under /api)
├── vercel.json, Dockerfile # deployment config
├── frontend/               # React (Vite) + Tailwind CSS
├── tests/test_api.py       # end-to-end API tests (pytest)
├── artifacts/              # trained models, results.csv, plots/ (generated)
├── data/                   # raw/, processed/, cache/tmdb/, app.db (generated)
└── docs/screenshots/       # screenshot checklist for the report
```

## Setup

Requirements: **Python 3.10+** (tested on 3.13) and **Node.js 18+** (tested on 20).

```bash
# 1. Python environment
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt   # requirements.txt alone = just the API

# 2. Data
python -m ml.download             # MovieLens ml-latest-small -> data/raw
python -m ml.data                 # clean -> data/processed

# 3. (Optional) TMDB posters, plots, cast and trailers
copy .env.example .env            # then put your free key from themoviedb.org in .env
python -m ml.tmdb 2000            # cache the 2,000 most-rated movies (one-off)

# 4. Train, tune and evaluate every model (~5-10 minutes)
python -m ml.train                # add --skip-tune to reuse artifacts/best_params.json

# 5. Notebooks (optional - regenerate with outputs)
python notebooks/make_eda.py
python notebooks/make_eval.py
```

If you add the TMDB key after training, re-run `python -m ml.train --skip-tune` so the
content model also learns from the plot overviews.

## Running the app

Two terminals, both from the project root:

```bash
# API on http://localhost:8000 (interactive docs at /docs)
.venv\Scripts\python -m uvicorn backend.app.main:app --port 8000

# Frontend on http://localhost:5173
cd frontend
npm install
npm run dev
```

The API takes a few seconds to load the models; reload the page if the first request fails.

**Using it:** click *Get started*, pick genres and up to 5 favourite movies, then rate movies
on any detail page or in *For You*. For the viva, the onboarding page can also load any of the
610 original MovieLens users (e.g. 414) to show recommendations for a user with lots of history.

## Deploying

### 1. Create a permanent database (free)

Users, ratings and watchlists must live in a hosted database - app servers on Vercel or
Render have temporary disks. The API switches from SQLite to PostgreSQL automatically when
the environment variable `DATABASE_URL` (or `POSTGRES_URL`) is set, and creates its tables on
first start.

1. Sign up at [neon.tech](https://neon.tech) (free tier, no expiry) and create a project.
2. Copy the connection string (`postgresql://...?sslmode=require`) - this is `DATABASE_URL`.
   Treat it like a password: never commit it.

(On Vercel you can instead use **Storage -> Create Database -> Neon**, which sets
`DATABASE_URL` for you. Any PostgreSQL works, e.g. Supabase.)

### 2a. Everything on Vercel (simplest)

The repo is a [Vercel Services](https://vercel.com/docs/services) project. `vercel.json`
declares two services and routes public traffic to them:

| Service | Folder | What it is | Public path |
|---|---|---|---|
| `api` | repo root | FastAPI app (`api/index.py`), loads the committed `artifacts/` | `/api/*` |
| `web` | `frontend/` | Vite + React site (single-page app) | everything else |

The browser calls the API on the same domain, so no service bindings are needed.
Run both locally exactly as Vercel will with `vercel dev -L`.

1. [vercel.com](https://vercel.com) -> **Add New -> Project** -> import this repo
   (Root Directory = repo root; Vercel recognises the multi-service project).
2. Environment variables: `DATABASE_URL` (from step 1), optionally `TMDB_API_KEY`.
3. Deploy, then open `https://<your-app>.vercel.app/api/health`.

The Python dependencies are ~285 MB unzipped. If the build fails with a function-size error,
use option 2b.

### 2b. API on Render, website on Vercel

**API** - [render.com](https://render.com) -> **New -> Web Service** -> connect this repo. Render
builds the included `Dockerfile`. Instance type *Free*; environment variables `DATABASE_URL`
and optionally `TMDB_API_KEY` and `CORS_ORIGINS=https://<your-app>.vercel.app`. Check
`https://<service>.onrender.com/health`.

**Website** - on Vercel import the repo with **Root Directory = `frontend`** (Vite is detected;
`frontend/vercel.json` handles page refreshes) and set `VITE_API_URL=https://<service>.onrender.com`.

Free Render services sleep after 15 minutes without traffic; the next visit takes ~30-60 s to
wake up. User data is unaffected because it lives in the database.

### Notes

- There are no passwords: a profile is identified by an id stored in the browser. Fine for a
  class project; real accounts would need authentication.
- Without `DATABASE_URL` the deployed API falls back to SQLite in `/tmp`, which is wiped
  regularly - always set it in production.

## Tests

```bash
python -m pytest tests -q
```

21 end-to-end tests cover search/filters, movie detail, cold start -> personalised
transition, every model, input validation, demo users and the watchlist. They use a
throwaway SQLite database (never your real one, even if `.env` sets `DATABASE_URL`).
To test the PostgreSQL backend, point `TEST_DATABASE_URL` at a separate test database or
Neon branch; the tests delete every user they create.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/movies?q=&genre=&tag=&min_rating=&year_from=&year_to=&sort=&page=&page_size=` | Search / browse |
| GET | `/movies/{id}?user_id=` | Detail + 12 similar movies (Content-kNN) |
| GET | `/recommendations/{user_id}?model=hybrid&k=12` | Recommendations with match % and reason |
| POST | `/ratings` | Add / update a rating, returns refreshed recommendations |
| DELETE | `/ratings/{user_id}/{movie_id}` | Remove a rating |
| GET | `/trending`, `/genres` | Trending movies, genre list |
| POST | `/users`, `/users/demo` | Onboarding, clone a MovieLens user |
| GET/POST | `/users/{id}`, `/users/{id}/ratings`, `/users/{id}/watchlist` | Profile data |
| GET | `/models` | Model registry, results table, cold-start results, plot list |

Model keys: `popularity`, `content`, `item_knn` (alias `collaborative`), `user_knn`, `hybrid`,
`kmeans`, `linear`, `logistic`, `logistic_scratch`, `tree`, `svm`.

## How it works (short version)

1. **Similarity signals** - Item-kNN and User-kNN learn who/what is similar from ratings;
   Content-kNN compares TF-IDF vectors of genres, tags and plot text.
2. **Taste segments** - K-means groups users by their genre mix.
3. **Learning to combine** - linear/logistic regression, a decision tree and an SVM learn
   from 15 features (kNN scores, segment statistics, user/item averages, genre affinity) to
   re-rank the top-200 Item-kNN candidates.
4. **Hybrid** - a weighted blend of Item-kNN and content, weight tuned on validation data.
5. **Serving** - models are trained offline and loaded by the API; a user's rating row is
   scored directly, so new ratings change the next list immediately.

## Credits and licences

- Ratings: [MovieLens](https://grouplens.org/datasets/movielens/) ml-latest-small, GroupLens
  Research (F. M. Harper and J. A. Konstan, 2015, *ACM TiiS* 5(4)). Used under its licence:
  non-commercial use, with acknowledgement. `artifacts/` contains data derived from it and is
  redistributed under the same conditions.
- Movie metadata and images: [TMDB](https://www.themoviedb.org/). This product uses the TMDB API
  but is not endorsed or certified by TMDB.
- UI layout inspired by two design reference images (an editorial movie-profile page and a
  dark streaming home page); all code and the WhatShouldIWatchToday branding are original to this project.
