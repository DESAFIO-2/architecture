"""PCA e vizinhos mais próximos, os dois cálculos numéricos do projetor."""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

Matrix = NDArray[np.float64]


def normalize_rows(vectors: Matrix) -> Matrix:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vectors / norms


def pca_3d(vectors: Matrix) -> tuple[Matrix, tuple[float, float, float]]:
    """Projeta em 3 componentes principais e devolve a variância explicada de cada um.

    O sinal de cada componente é fixado (maior carga absoluta positiva) para que a
    mesma entrada gere sempre a mesma figura.
    """
    if vectors.ndim != 2 or vectors.shape[0] < 2:
        raise ValueError("PCA precisa de pelo menos 2 vetores")
    centered = vectors - vectors.mean(axis=0)
    _, singular, components = np.linalg.svd(centered, full_matrices=False)
    components = components[:3]
    signs = np.sign(components[np.arange(len(components)), np.abs(components).argmax(axis=1)])
    components = components * signs[:, None]
    coords = centered @ components.T
    if coords.shape[1] < 3:
        coords = np.pad(coords, ((0, 0), (0, 3 - coords.shape[1])))
    variance = singular**2
    total = float(variance.sum()) or 1.0
    ratios = [float(v / total) for v in variance[:3]] + [0.0, 0.0, 0.0]
    return coords, (ratios[0], ratios[1], ratios[2])


def nearest_neighbors(vectors: Matrix, k: int) -> list[tuple[int, ...]]:
    """Vizinhos por cosseno no espaço original, não na projeção, como no TF Projector."""
    unit = normalize_rows(vectors)
    similarity = unit @ unit.T
    np.fill_diagonal(similarity, -np.inf)
    k = min(k, len(vectors) - 1)
    order = np.argsort(-similarity, axis=1, kind="stable")[:, :k]
    return [tuple(int(i) for i in row) for row in order]
