"""K-means taste segments.

Each user is described by their genre mix (share of their ratings in each
genre) plus their average rating. K-means groups users with similar taste;
the cluster is used (a) as a feature for the supervised models, (b) for
cold-start: a new user is assigned to the nearest cluster and gets what that
cluster liked most.
"""
import numpy as np
from scipy import sparse
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from ml.baselines import binary, row_mean


def genre_matrix(movies):
    """(items x genres) 0/1 matrix and the genre names."""
    names = sorted({g for gl in movies["genres_list"] for g in gl})
    idx = {g: j for j, g in enumerate(names)}
    rows, cols = [], []
    for i, gl in enumerate(movies["genres_list"]):
        for g in gl:
            rows.append(i)
            cols.append(idx[g])
    G = sparse.csr_matrix((np.ones(len(rows), np.float32), (rows, cols)),
                          shape=(len(movies), len(names)))
    return G, names


class UserSegments:
    def __init__(self, G, k=8, seed=0):
        self.G, self.k, self.seed = G, k, seed

    def taste(self, R_rows, neutral_mean=False):
        """Genre-share vector + scaled mean rating for each row."""
        R_rows = R_rows.tocsr()
        Rb = binary(R_rows)
        cnt = np.maximum(np.asarray(Rb.sum(1)).ravel(), 1)
        share = (Rb @ self.G).toarray() / cnt[:, None]
        mean = np.full(R_rows.shape[0], 3.5) if neutral_mean else row_mean(R_rows, 3.5)
        return np.hstack([share, (mean / 5.0)[:, None]])

    def fit(self, R):
        X = self.taste(R)
        self.km = KMeans(self.k, n_init=10, random_state=self.seed).fit(X)
        self.labels_ = self.km.labels_
        return self

    def assign(self, R_rows, neutral_mean=False):
        return self.km.predict(self.taste(R_rows, neutral_mean))


def choose_k(R, G, ks=range(3, 11), seed=0):
    """Pick the number of clusters by silhouette score."""
    seg = UserSegments(G)
    X = seg.taste(R)
    scores = {}
    for k in ks:
        labels = KMeans(k, n_init=10, random_state=seed).fit_predict(X)
        scores[k] = float(silhouette_score(X, labels))
    return max(scores, key=scores.get), scores
