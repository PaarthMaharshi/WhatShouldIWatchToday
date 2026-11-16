"""Load, clean and persist the MovieLens (ml-latest-small) dataset."""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "ml-latest-small"
PROCESSED = ROOT / "data" / "processed"
SERVING_DATA = ROOT / "artifacts" / "catalog_data.joblib"


def load_raw() -> dict:
    """Read the raw MovieLens CSV files into DataFrames."""
    return {
        name: pd.read_csv(RAW / f"{name}.csv")
        for name in ("ratings", "movies", "tags", "links")
    }


def clean_movies(movies: pd.DataFrame) -> pd.DataFrame:
    """Extract the release year from the title and split genres into a list."""
    movies = movies.copy()
    year = movies["title"].str.extract(r"\((\d{4})\)\s*$")[0]
    movies["year"] = pd.to_numeric(year, errors="coerce").astype("Int64")
    movies["clean_title"] = movies["title"].str.replace(
        r"\s*\(\d{4}\)\s*$", "", regex=True
    ).str.strip()
    # "Matrix, The" -> "The Matrix" (also before an alias: "Seven, The (a.k.a.)")
    movies["clean_title"] = movies["clean_title"].str.replace(
        r"^(.*?), (The|A|An|Les|La|Le|L'|Il|El|Die|Das|Der)(?=$| \()",
        lambda m: f"{m.group(2)} {m.group(1)}".replace("L' ", "L'"),
        regex=True,
    )
    movies["genres_list"] = movies["genres"].apply(
        lambda g: [] if g == "(no genres listed)" else g.split("|")
    )
    return movies


def clean_ratings(ratings: pd.DataFrame, movies: pd.DataFrame) -> pd.DataFrame:
    """Drop duplicates and ratings that reference unknown movies."""
    ratings = ratings.drop_duplicates(["userId", "movieId"], keep="last")
    ratings = ratings[ratings["movieId"].isin(movies["movieId"])]
    ratings = ratings.dropna(subset=["rating"])
    return ratings.reset_index(drop=True)


def clean_tags(tags: pd.DataFrame, movies: pd.DataFrame) -> pd.DataFrame:
    """Lower-case tags, strip whitespace and drop empty / orphan rows."""
    tags = tags.copy()
    tags["tag"] = tags["tag"].astype(str).str.lower().str.strip()
    tags = tags[(tags["tag"] != "") & tags["movieId"].isin(movies["movieId"])]
    return tags.reset_index(drop=True)


def build_processed() -> dict:
    """Run the full cleaning pipeline and write parquet files."""
    raw = load_raw()
    movies = clean_movies(raw["movies"])
    ratings = clean_ratings(raw["ratings"], movies)
    tags = clean_tags(raw["tags"], movies)
    links = raw["links"]

    PROCESSED.mkdir(parents=True, exist_ok=True)
    movies.drop(columns=["genres_list"]).to_parquet(PROCESSED / "movies.parquet")
    ratings.to_parquet(PROCESSED / "ratings.parquet")
    tags.to_parquet(PROCESSED / "tags.parquet")
    links.to_parquet(PROCESSED / "links.parquet")
    out = {"movies": movies, "ratings": ratings, "tags": tags, "links": links}
    export_serving_bundle(out)
    return out


def export_serving_bundle(d=None):
    """Save the cleaned tables as one joblib file for the API.

    The deployed API reads this instead of parquet, so it does not need
    pyarrow (keeps the serverless bundle small).
    """
    import joblib
    d = d or load_processed()
    SERVING_DATA.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(d, SERVING_DATA, compress=3)


def load_serving_bundle() -> dict:
    """Cleaned tables for the API: joblib bundle if present, else parquet."""
    if SERVING_DATA.exists():
        import joblib
        return joblib.load(SERVING_DATA)
    return load_processed()


def load_processed() -> dict:
    """Load cleaned data; genres are re-split into lists for convenience."""
    out = {n: pd.read_parquet(PROCESSED / f"{n}.parquet")
           for n in ("movies", "ratings", "tags", "links")}
    out["movies"]["genres_list"] = out["movies"]["genres"].apply(
        lambda g: [] if g == "(no genres listed)" else g.split("|")
    )
    return out


if __name__ == "__main__":
    d = build_processed()
    for k, v in d.items():
        print(f"{k:8s} {v.shape}")
