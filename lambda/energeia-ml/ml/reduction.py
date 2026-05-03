"""Dimensionality reduction for the Energeia ML Lambda.

Supports two methods, selectable via the `method` parameter:

pca:   Principal Component Analysis via scikit-learn. Fast (~50ms), linear,
       no extra dependencies. Points that are similar in embedding space tend
       to be closer together. Best for quick, reproducible layouts.

tsne:  t-SNE via scikit-learn. Preserves local neighborhood structure. Good
       for revealing fine-grained patterns. Slower (~10-30s). Does not
       preserve global cluster separation.
"""

import numpy as np
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE


def run_pca(vectors: list[list[float]]) -> list[list[float]]:
    """Reduce vectors to 3D via PCA."""
    X = np.array(vectors, dtype=np.float64)
    pca = PCA(n_components=3, random_state=42)
    return pca.fit_transform(X).tolist()


def run_tsne(vectors: list[list[float]]) -> list[list[float]]:
    """Reduce vectors to 3D via t-SNE."""
    X = np.array(vectors, dtype=np.float64)
    perplexity = min(30.0, max(1.0, len(vectors) - 1))
    tsne = TSNE(n_components=3, random_state=42, perplexity=perplexity)
    return tsne.fit_transform(X).tolist()


def run_reduction(vectors: list[list[float]], method: str = "pca") -> list[list[float]]:
    """Dispatch to the requested reduction method.

    Args:
        vectors: List of embedding vectors.
        method:  "pca" (default) or "tsne".

    Returns:
        List of 3-element coordinate arrays.

    Raises:
        ValueError: If method is not recognised.
    """
    if method == "pca":
        return run_pca(vectors)
    if method == "tsne":
        return run_tsne(vectors)
    raise ValueError(f"Unknown reduction method: {method!r}. Use 'pca' or 'tsne'.")
