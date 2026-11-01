"""Mood match: recommend movies from a mood, genres and viewing situation.

The request is turned into a *query vector* in the same TF-IDF space as the
Content-kNN model (genre block + text block of mood keywords and any free
text). Movies are scored by cosine similarity to that query - a
nearest-neighbour search - blended with rating quality, popularity and, for
signed-in users, their personal hybrid score. Era, runtime and
family-friendliness act as hard filters, and the final list is diversified
with Maximal Marginal Relevance (MMR) so it is not ten near-identical films.

Only kNN-style similarity and simple weighting are used, so the feature stays
within the project's algorithms.
"""
from dataclasses import dataclass, field

import numpy as np
from scipy import sparse

# Every keyword below exists in the content model's text vocabulary (tags and
# TMDB plots), so each one really moves the query vector.
MOODS = {
    "happy": {
        "label": "Happy & light", "blurb": "Funny, warm, easy to love",
        "genres": ["Comedy", "Animation", "Musical", "Children"],
        "keywords": "funny feel good heartwarming friendship charming hilarious",
        "avoid": ["Horror", "War"],
    },
    "cry": {
        "label": "Need a good cry", "blurb": "Moving, emotional stories",
        "genres": ["Drama", "Romance"],
        "keywords": "emotional touching loss grief love sad beautiful family",
        "avoid": ["Horror"],
    },
    "thrill": {
        "label": "Edge of my seat", "blurb": "Tense, twisty, fast",
        "genres": ["Thriller", "Action", "Crime"],
        "keywords": "suspense tense heist chase twist intense dark",
        "avoid": ["Children", "Musical"],
    },
    "scared": {
        "label": "Scare me", "blurb": "Creepy, haunted, terrifying",
        "genres": ["Horror", "Thriller"],
        "keywords": "scary creepy haunted supernatural killer ghost terrifying",
        "avoid": ["Children", "Musical", "Animation"],
    },
    "think": {
        "label": "Make me think", "blurb": "Mind-bending and thought-provoking",
        "genres": ["Sci-Fi", "Mystery", "Drama", "Documentary"],
        "keywords": "thought provoking mind philosophical twist ending dystopia time travel complex psychological",
        "avoid": ["Children"],
    },
    "romantic": {
        "label": "In the mood for love", "blurb": "Romance and chemistry",
        "genres": ["Romance", "Comedy", "Drama"],
        "keywords": "love romance relationship wedding romantic",
        "avoid": ["Horror", "War"],
    },
    "adventure": {
        "label": "Take me somewhere", "blurb": "Epic journeys and other worlds",
        "genres": ["Adventure", "Fantasy", "Sci-Fi", "Action"],
        "keywords": "epic quest journey magic space world adventure visually stunning",
        "avoid": [],
    },
    "nostalgic": {
        "label": "Nostalgic", "blurb": "Classics and childhood favourites",
        "genres": ["Children", "Adventure", "Comedy", "Animation"],
        "keywords": "classic childhood coming age family friendship",
        "avoid": ["Horror"],
        "prefer_before": 2000,
    },
    "chill": {
        "label": "Chill & cosy", "blurb": "Low-stakes, quirky, relaxing",
        "genres": ["Comedy", "Animation", "Documentary", "Romance"],
        "keywords": "quirky light charming relaxing life heartwarming",
        "avoid": ["Horror", "War", "Thriller"],
        "prefer_short": True,
    },
}

COMPANY = {
    "solo": {"label": "Just me", "boost": [], "exclude": []},
    "partner": {"label": "With a partner", "boost": ["Romance", "Comedy"], "exclude": ["Children"]},
    "friends": {"label": "With friends", "boost": ["Comedy", "Action", "Horror"], "exclude": []},
    "family": {"label": "With family / kids", "boost": ["Children", "Animation", "Adventure"],
               "exclude": ["Horror"], "certs_ok": ["G", "PG"]},
}

ERAS = {
    "any": ("Any era", None, None),
    "classic": ("Classics (before 1980)", None, 1979),
    "80s90s": ("80s & 90s", 1980, 1999),
    "2000s": ("2000s", 2000, 2009),
    "recent": ("2010 onwards", 2010, None),
}

RUNTIMES = {
    "any": ("Any length", None, None),
    "short": ("Under 1h 35m", None, 95),
    "standard": ("Under 2h 5m", None, 125),
    "long": ("Epic night (2h 20m+)", 140, None),
}

DISCOVERY = {
    "popular": "Crowd favourites",
    "balanced": "A good mix",
    "hidden": "Hidden gems",
}

MIN_RATINGS = 5          # ignore films almost nobody rated (too noisy)


@dataclass
class MoodQuery:
    mood: str = "happy"
    genres: list = field(default_factory=list)
    company: str = "solo"
    era: str = "any"
    runtime: str = "any"
    discovery: str = "balanced"
    text: str = ""


def options():
    """Everything the UI needs to render the picker."""
    return {
        "moods": [{"key": k, "label": v["label"], "blurb": v["blurb"], "genres": v["genres"]}
                  for k, v in MOODS.items()],
        "company": [{"key": k, "label": v["label"]} for k, v in COMPANY.items()],
        "eras": [{"key": k, "label": v[0]} for k, v in ERAS.items()],
        "runtimes": [{"key": k, "label": v[0]} for k, v in RUNTIMES.items()],
        "discovery": [{"key": k, "label": v} for k, v in DISCOVERY.items()],
    }


def validate(q: MoodQuery):
    for value, table, name in ((q.mood, MOODS, "mood"), (q.company, COMPANY, "company"),
                               (q.era, ERAS, "era"), (q.runtime, RUNTIMES, "runtime"),
                               (q.discovery, DISCOVERY, "discovery")):
        if value not in table:
            raise ValueError(f"Unknown {name} '{value}'")


def _znorm(x):
    """Rescale finite values to 0..1 (used to put scores on one scale)."""
    x = np.asarray(x, float)
    finite = np.isfinite(x)
    lo, hi = x[finite].min(), x[finite].max()
    out = np.zeros_like(x)
    out[finite] = (x[finite] - lo) / (hi - lo + 1e-9)
    return out


class MoodRecommender:
    """Scores the whole catalogue for a MoodQuery (see module docstring)."""

    def __init__(self, content, genres_list, years, counts, quality):
        self.content = content
        self.genres = [set(g) for g in genres_list]
        self.years = np.asarray(years, float)            # NaN when unknown
        self.counts = np.asarray(counts)
        self.log_pop = _znorm(np.log1p(self.counts))
        self.quality = _znorm(quality)

    def _has_any(self, wanted):
        wanted = set(wanted)
        return np.array([bool(g & wanted) for g in self.genres])

    def query_vector(self, q: MoodQuery):
        """Weighted sum of encoded parts; blocks are pre-normalised, so a dot
        product with the catalogue gives genre + text cosine similarity."""
        mood = MOODS[q.mood]
        parts = [(1.0, mood["genres"], mood["keywords"])]
        if q.genres:
            parts.append((1.4, q.genres, ""))          # explicit genres matter most
        if COMPANY[q.company]["boost"]:
            parts.append((0.4, COMPANY[q.company]["boost"], ""))
        if q.text.strip():
            parts.append((1.2, [], q.text))
        vec = None
        for w, genres, words in parts:
            v = w * self.content.encode_item(genres, tags=words)
            vec = v if vec is None else vec + v
        return sparse.csr_matrix(vec)

    def score(self, q: MoodQuery, personal=None):
        """Score every item; -inf marks items removed by hard filters."""
        validate(q)
        mood, company = MOODS[q.mood], COMPANY[q.company]
        sim = (self.content.X @ self.query_vector(q).T).toarray().ravel()
        score = 0.55 * _znorm(sim) + 0.25 * self.quality

        # Popular picks vs hidden gems
        if q.discovery == "popular":
            score += 0.25 * self.log_pop
        elif q.discovery == "balanced":
            score += 0.10 * self.log_pop
        else:
            score -= 0.20 * self.log_pop

        if mood.get("avoid"):
            score -= 0.30 * self._has_any(mood["avoid"])   # soft: mood dislikes
        if mood.get("prefer_before"):
            score += 0.08 * (np.nan_to_num(self.years, nan=3000) < mood["prefer_before"])
        if personal is not None:
            score += 0.25 * _znorm(personal)

        # Hard filters
        score[self.counts < MIN_RATINGS] = -np.inf
        if q.discovery == "hidden":
            score[self.counts > 60] = -np.inf
        if company["exclude"]:
            score[self._has_any(company["exclude"])] = -np.inf
        _, lo, hi = ERAS[q.era]
        if lo is not None:
            score[~(self.years >= lo)] = -np.inf
        if hi is not None:
            score[~(self.years <= hi)] = -np.inf
        return score

    def diversify(self, candidates, scores, k, lam=0.65):
        """Maximal Marginal Relevance: trade a little score for variety."""
        candidates = list(candidates)
        if not candidates:
            return []
        rel = _znorm(scores[candidates])
        X = self.content.Xn[candidates]
        sims = (X @ X.T).toarray()
        chosen = [0]
        while len(chosen) < min(k, len(candidates)):
            rest = [i for i in range(len(candidates)) if i not in chosen]
            mmr = [lam * rel[i] - (1 - lam) * sims[i, chosen].max() for i in rest]
            chosen.append(rest[int(np.argmax(mmr))])
        return [candidates[i] for i in chosen]

    def reasons(self, item, q: MoodQuery, text_blob):
        """Short, human explanation: matched genres and keywords."""
        mood = MOODS[q.mood]
        wanted = list(dict.fromkeys(q.genres + mood["genres"]))
        genres = [g for g in wanted if g in self.genres[item]][:2]
        words = set((mood["keywords"] + " " + q.text).lower().split())
        blob = text_blob.lower()
        hits = [w for w in words if len(w) > 3 and w in blob][:2]
        return genres, hits
