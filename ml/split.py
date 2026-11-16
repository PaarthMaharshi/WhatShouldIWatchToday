"""Index mapping and a leakage-free per-user temporal split.

Every user's ratings are ordered by time: the last 10% go to test, the 10%
before that to validation and the rest to train. Models therefore only ever
learn from a user's past and are scored on their future.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import sparse

from ml.data import load_processed


@dataclass
class Dataset:
    movies: pd.DataFrame      # row position == item index
    user_ids: np.ndarray      # user index -> userId
    item_ids: np.ndarray      # item index -> movieId
    train: pd.DataFrame       # columns: u, i, rating, timestamp
    val: pd.DataFrame
    test: pd.DataFrame

    @property
    def n_users(self) -> int:
        return len(self.user_ids)

    @property
    def n_items(self) -> int:
        return len(self.item_ids)

    def matrix(self, *frames) -> sparse.csr_matrix:
        """Stack rating frames into a (users x items) CSR matrix (0 = unrated)."""
        df = pd.concat(frames)
        return sparse.csr_matrix(
            (df["rating"].values.astype(np.float32), (df["u"].values, df["i"].values)),
            shape=(self.n_users, self.n_items),
        )


def temporal_split(df: pd.DataFrame, val_frac=0.1, test_frac=0.1):
    """Per-user chronological split (ties broken by item index for determinism)."""
    df = df.sort_values(["u", "timestamp", "i"]).reset_index(drop=True)
    n = df.groupby("u")["u"].transform("size")
    from_end = n - df.groupby("u").cumcount()          # 1 = most recent rating
    n_test = np.maximum(1, np.round(n * test_frac))
    n_val = np.maximum(1, np.round(n * val_frac))
    is_test = from_end <= n_test
    is_val = (from_end > n_test) & (from_end <= n_test + n_val)
    return df[~is_test & ~is_val], df[is_val], df[is_test]


def load_dataset(val_frac=0.1, test_frac=0.1) -> Dataset:
    d = load_processed()
    movies = d["movies"].sort_values("movieId").reset_index(drop=True)
    user_ids = np.sort(d["ratings"]["userId"].unique())
    item_ids = movies["movieId"].values
    u_map = pd.Series(np.arange(len(user_ids)), index=user_ids)
    i_map = pd.Series(np.arange(len(item_ids)), index=item_ids)
    r = d["ratings"]
    df = pd.DataFrame({
        "u": r["userId"].map(u_map).values,
        "i": r["movieId"].map(i_map).values,
        "rating": r["rating"].values.astype(np.float32),
        "timestamp": r["timestamp"].values,
    })
    tr, va, te = temporal_split(df, val_frac, test_frac)
    ds = Dataset(movies, user_ids, item_ids, tr, va, te)
    ds.tags = d["tags"]
    ds.links = d["links"]
    return ds
