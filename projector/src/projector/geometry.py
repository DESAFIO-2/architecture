"""Cálculos numéricos do projetor: PCA, t-SNE com quadros intermediários e vizinhos."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

Matrix = NDArray[np.float64]

SEED = 42


def normalize_rows(vectors: Matrix) -> Matrix:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vectors / norms


def fit_unit_sphere(coords: Matrix) -> Matrix:
    """Centraliza e escala para caber na esfera de raio 1, para a câmera enquadrar igual."""
    centered = coords - coords.mean(axis=0)
    radius = float(np.linalg.norm(centered, axis=1).max())
    return centered / radius if radius > 0 else centered


def _principal_components(vectors: Matrix, dims: int) -> tuple[Matrix, NDArray[np.float64]]:
    centered = vectors - vectors.mean(axis=0)
    _, singular, components = np.linalg.svd(centered, full_matrices=False)
    components = components[:dims]
    # Sinal fixo (maior carga absoluta positiva): a mesma entrada gera a mesma figura.
    pivots = np.abs(components).argmax(axis=1)
    signs = np.sign(components[np.arange(len(components)), pivots])
    coords = centered @ (components * signs[:, None]).T
    if coords.shape[1] < dims:
        coords = np.pad(coords, ((0, 0), (0, dims - coords.shape[1])))
    return coords, singular


def pca_3d(vectors: Matrix) -> tuple[Matrix, tuple[float, float, float]]:
    """3 componentes principais e a fração da variância explicada por cada um."""
    if vectors.ndim != 2 or vectors.shape[0] < 2:
        raise ValueError("PCA precisa de pelo menos 2 vetores")
    coords, singular = _principal_components(vectors, 3)
    variance = singular**2
    total = float(variance.sum()) or 1.0
    ratios = [float(v / total) for v in variance[:3]] + [0.0, 0.0, 0.0]
    return coords, (ratios[0], ratios[1], ratios[2])


@dataclass(frozen=True)
class TsneResult:
    frames: tuple[Matrix, ...]
    iterations: tuple[int, ...]
    perplexity: float


def _joint_probabilities(distances: Matrix, perplexity: float) -> Matrix:
    """Busca binária vetorizada do beta de cada linha até atingir a perplexidade."""
    n = distances.shape[0]
    target = np.log(perplexity)
    beta = np.ones(n)
    low = np.full(n, -np.inf)
    high = np.full(n, np.inf)
    mask = ~np.eye(n, dtype=bool)
    for _ in range(64):
        p = np.exp(-distances * beta[:, None]) * mask
        total = np.maximum(p.sum(axis=1), 1e-12)
        entropy = np.log(total) + beta * (distances * p).sum(axis=1) / total
        too_flat = entropy > target
        low = np.where(too_flat, beta, low)
        high = np.where(too_flat, high, beta)
        beta = np.where(
            too_flat,
            np.where(np.isinf(high), beta * 2, (beta + high) / 2),
            np.where(np.isinf(low), beta / 2, (beta + low) / 2),
        )
    conditional = p / total[:, None]
    joint = (conditional + conditional.T) / (2 * n)
    clipped: Matrix = np.maximum(joint, 1e-12)
    return clipped


def snapshot_schedule(iterations: int, snapshots: int) -> tuple[int, ...]:
    """Mais quadros no começo, quando a estrutura aparece; menos no fim."""
    raw = np.geomspace(1, iterations, snapshots)
    return tuple(sorted({int(x) for x in raw.round()} | {iterations}))


def tsne_3d(
    vectors: Matrix,
    *,
    perplexity: float = 30.0,
    iterations: int = 600,
    snapshots: int = 28,
) -> TsneResult:
    """t-SNE exato em 3D (van der Maaten, 2008), guardando quadros da otimização.

    Antes, PCA para até 50 dimensões, como é de praxe. Semente fixa: determinístico.
    """
    n = vectors.shape[0]
    if n < 4:
        raise ValueError("t-SNE precisa de pelo menos 4 vetores")
    perplexity = float(min(perplexity, (n - 1) / 3))
    reduced, _ = _principal_components(vectors, min(50, n - 1, vectors.shape[1]))
    reduced = reduced / (np.abs(reduced).max() or 1.0)
    squared = (reduced**2).sum(axis=1)
    distances = np.maximum(squared[:, None] + squared[None, :] - 2 * reduced @ reduced.T, 0)
    p = _joint_probabilities(distances, perplexity)

    rng = np.random.default_rng(SEED)
    y = rng.normal(0.0, 1e-4, size=(n, 3))
    velocity = np.zeros_like(y)
    gains = np.ones_like(y)
    learning_rate = max(n / 12, 50.0)
    schedule = set(snapshot_schedule(iterations, snapshots))
    frames: list[Matrix] = []
    taken: list[int] = []

    for it in range(1, iterations + 1):
        exaggeration = 12.0 if it <= 250 else 1.0
        momentum = 0.5 if it <= 250 else 0.8
        sum_y = (y**2).sum(axis=1)
        num = 1.0 / (1.0 + sum_y[:, None] + sum_y[None, :] - 2 * y @ y.T)
        np.fill_diagonal(num, 0.0)
        q = np.maximum(num / num.sum(), 1e-12)
        weights = (exaggeration * p - q) * num
        gradient = 4.0 * (weights.sum(axis=1)[:, None] * y - weights @ y)
        same_sign = (gradient > 0) == (velocity > 0)
        gains = np.maximum(np.where(same_sign, gains * 0.8, gains + 0.2), 0.01)
        velocity = momentum * velocity - learning_rate * gains * gradient
        y = y + velocity
        y = y - y.mean(axis=0)
        if it in schedule:
            frames.append(fit_unit_sphere(y))
            taken.append(it)
    return TsneResult(frames=tuple(frames), iterations=tuple(taken), perplexity=perplexity)


def nearest_neighbors(vectors: Matrix, k: int) -> list[tuple[tuple[int, ...], tuple[float, ...]]]:
    """Vizinhos por cosseno no espaço original, com a similaridade de cada um."""
    unit = normalize_rows(vectors)
    similarity = unit @ unit.T
    np.fill_diagonal(similarity, -np.inf)
    k = min(k, len(vectors) - 1)
    order = np.argsort(-similarity, axis=1, kind="stable")[:, :k]
    return [
        (tuple(int(i) for i in row), tuple(float(similarity[r, i]) for i in row))
        for r, row in enumerate(order)
    ]
