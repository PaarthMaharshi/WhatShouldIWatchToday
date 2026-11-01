"""Logistic regression written from scratch with batch gradient descent.

P(y=1 | x) = sigmoid(w.x + b) with cross-entropy loss and an L2 penalty:

    L = -mean( y log p + (1-y) log(1-p) ) + (l2 / 2) |w|^2
    dL/dw = X^T (p - y) / n + l2 * w          dL/db = mean(p - y)

and each step is  w <- w - lr * dL/dw.  Features are standardised first so a
single learning rate works for all of them. Follows the sklearn estimator API
(fit / predict_proba) so it can be dropped into the same pipeline.
"""
import numpy as np


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


class LogisticRegressionScratch:
    def __init__(self, lr=0.5, epochs=300, l2=1e-3):
        self.lr, self.epochs, self.l2 = lr, epochs, l2

    def fit(self, X, y):
        X, y = np.asarray(X, float), np.asarray(y, float)
        self.mean_, self.std_ = X.mean(0), X.std(0) + 1e-9
        Z = (X - self.mean_) / self.std_
        n, d = Z.shape
        self.w, self.b, self.loss_history = np.zeros(d), 0.0, []
        for epoch in range(self.epochs):
            p = sigmoid(Z @ self.w + self.b)
            err = p - y
            self.w -= self.lr * (Z.T @ err / n + self.l2 * self.w)
            self.b -= self.lr * err.mean()
            if epoch % 10 == 0:
                ce = -np.mean(y * np.log(p + 1e-12) + (1 - y) * np.log(1 - p + 1e-12))
                self.loss_history.append((epoch, ce + 0.5 * self.l2 * (self.w ** 2).sum()))
        return self

    def predict_proba(self, X):
        Z = (np.asarray(X, float) - self.mean_) / self.std_
        p = sigmoid(Z @ self.w + self.b)
        return np.column_stack([1 - p, p])

    def predict(self, X):
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)
