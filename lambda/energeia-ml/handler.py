"""AWS Lambda entry point for the Energeia ML Lambda (cwf-energeia-ml-lambda).

Performs k-means clustering and dimensionality reduction (PCA or t-SNE) on
action embedding vectors. Invoked synchronously by cwf-energeia-lambda.

Expected event shape:
    {
        "vectors":          [[float, ...], ...],  # N x 1536 embedding vectors
        "entity_ids":       ["uuid", ...],         # N entity IDs (parallel to vectors)
        "k":                int,                   # number of clusters
        "reduction_method": "pca" | "tsne"         # optional, default "pca"
    }

Response shape (success):
    {
        "labels":     [int, ...],
        "centroids":  [[float, ...], ...],
        "coords_3d":  [[float, float, float], ...]
    }

Response shape (error):
    {
        "error": "..."
    }
"""

from ml.clustering import run_kmeans
from ml.reduction import run_reduction


def handler(event, context):
    """Lambda handler."""
    try:
        vectors = event["vectors"]
        k = int(event["k"])
        reduction_method = event.get("reduction_method", "pca")

        clustering_result = run_kmeans(vectors, k)
        coords_3d = run_reduction(vectors, method=reduction_method)

        return {
            "labels": clustering_result["labels"],
            "centroids": clustering_result["centroids"],
            "coords_3d": coords_3d,
        }

    except ValueError as exc:
        return {"error": str(exc)}

    except KeyError as exc:
        return {"error": f"Missing required field in event: {exc}"}

    except Exception as exc:  # noqa: BLE001
        return {"error": f"Unexpected error: {exc}"}
