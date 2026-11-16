"""Result plots for the report (saved to artifacts/plots)."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

RED, GREY, DARK = "#E8403A", "#9aa0a6", "#1c1d22"


def _style():
    plt.rcParams.update({"axes.spines.top": False, "axes.spines.right": False,
                         "axes.grid": True, "grid.alpha": 0.25, "figure.dpi": 130,
                         "font.size": 9})


def _colors(names):
    return [RED if n.startswith("Hybrid") else GREY for n in names]


def accuracy_plot(res, path):
    _style()
    d = res.sort_values("RMSE")
    fig, ax = plt.subplots(figsize=(8, 4))
    y = np.arange(len(d))
    ax.barh(y - 0.2, d["RMSE"], 0.4, color=_colors(d.index), label="RMSE")
    ax.barh(y + 0.2, d["MAE"], 0.4, color=_colors(d.index), alpha=0.5, label="MAE")
    ax.set_yticks(y, d.index)
    ax.invert_yaxis()
    ax.set_xlim(0.6, d["RMSE"].max() + 0.05)
    ax.set_title("Rating prediction error on test (lower is better)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def ranking_plot(res, path):
    _style()
    cols = ["P@10", "R@10", "MAP@10", "NDCG@10"]
    d = res.sort_values("NDCG@10", ascending=False)
    fig, ax = plt.subplots(figsize=(9, 4))
    x = np.arange(len(d))
    w = 0.2
    shades = ["#f6b8b5", "#f08d88", "#ec645d", RED]
    for j, c in enumerate(cols):
        ax.bar(x + (j - 1.5) * w, d[c], w, label=c, color=shades[j])
    ax.set_xticks(x, d.index, rotation=30, ha="right")
    ax.set_title("Top-10 ranking quality on test (higher is better)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def tradeoff_plot(res, path):
    _style()
    d = res[res["NDCG@10"] > 0.005]
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.scatter(d["Diversity"], d["NDCG@10"], s=40 + 600 * d["Coverage"],
               c=_colors(d.index), alpha=0.8)
    for n, r in d.iterrows():
        ax.annotate(n, (r["Diversity"], r["NDCG@10"]), fontsize=8,
                    xytext=(5, 4), textcoords="offset points")
    ax.set_xlabel("Diversity (intra-list distance)")
    ax.set_ylabel("NDCG@10")
    ax.set_title("Accuracy vs diversity (bubble size = catalogue coverage)")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def alpha_plot(curves, path):
    _style()
    fig, axes = plt.subplots(1, 2, figsize=(9, 3.6))
    for name, df in curves.items():
        axes[0].plot(df["alpha"], df["RMSE"], label=name)
        axes[1].plot(df["alpha"], df["NDCG@10"], label=name)
    axes[0].set(title="Validation RMSE vs CF weight", xlabel="alpha (1 = pure CF)")
    axes[1].set(title="Validation NDCG@10 vs CF weight", xlabel="alpha (1 = pure CF)")
    axes[0].legend()
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def loss_curve_plot(history, path):
    _style()
    h = np.array(history)
    fig, ax = plt.subplots(figsize=(6, 3.6))
    ax.plot(h[:, 0], h[:, 1], color=RED)
    ax.set(title="From-scratch logistic regression: training loss",
           xlabel="gradient-descent step", ylabel="regularised cross-entropy")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def importance_plot(names, values, title, path):
    _style()
    order = np.argsort(np.abs(values))
    fig, ax = plt.subplots(figsize=(6, 4.2))
    ax.barh(np.array(names)[order], np.array(values)[order],
            color=[RED if v > 0 else GREY for v in np.array(values)[order]])
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def segments_plot(seg, genre_names, silhouettes, path):
    _style()
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.2),
                             gridspec_kw={"width_ratios": [1, 2.2]})
    ks = sorted(silhouettes)
    axes[0].plot(ks, [silhouettes[k] for k in ks], "o-", color=RED)
    axes[0].set(title="Choosing k (silhouette)", xlabel="clusters k")
    centers = seg.km.cluster_centers_[:, :len(genre_names)]
    sizes = np.bincount(seg.labels_, minlength=seg.k)
    im = axes[1].imshow(centers, aspect="auto", cmap="Reds")
    axes[1].set_xticks(range(len(genre_names)), genre_names, rotation=60, ha="right")
    axes[1].set_yticks(range(seg.k), [f"segment {c} (n={sizes[c]})" for c in range(seg.k)])
    axes[1].grid(False)
    axes[1].set_title("User taste segments: genre share of ratings")
    fig.colorbar(im, ax=axes[1])
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def cold_plot(cold_user, cold_item, path):
    _style()
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.8), sharey=False)
    for ax, data, title in ((axes[0], cold_user, "New user (5 liked movies)"),
                            (axes[1], cold_item, "New items (no ratings)")):
        names = [n for n in data if not n.startswith("_")]
        vals = [data[n]["NDCG@10"] for n in names]
        ax.bar(names, vals, color=_colors(names))
        ax.set_title(title + ": NDCG@10")
        ax.tick_params(axis="x", rotation=30)
        for lab in ax.get_xticklabels():
            lab.set_ha("right")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
