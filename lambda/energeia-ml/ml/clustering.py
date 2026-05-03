"""k-means clustering for the Energeia ML Lambda."""

import numpy as np
from sklearn.cluster import KMeans


def run_kmeans(vectors: list[list[float]], k: int) -> dict:
    """Run k-means clustering on the given vectors.

    Args:
        vectors: List of 1536-dimensional embedding vectors.
        k: Number of clusters to form.

    Returns:
        A dict with:
            - "labels": list of integer cluster indices, one per input vector.
            - "centroids": list of k mean vectors in the original 1536-dim space.

    Raises:
        ValueError: If k exceeds the number of available vectors.
    """
    n = len(vectors)
    if k > n:
        raise ValueError(
            f"k ({k}) exceeds the number of available action embeddings ({n}). "
            "Reduce k or expand the time window."
        )

    X = np.array(vectors, dtype=np.float64)

    kmeans = KMeans(n_clusters=k, random_state=42, n_init="auto")
    kmeans.fit(X)

    labels: list[int] = kmeans.labels_.tolist()
    centroids: list[list[float]] = kmeans.cluster_centers_.tolist()

    return {"labels": labels, "centroids": centroids}
