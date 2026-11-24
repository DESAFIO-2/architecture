import numpy as np
import pytest

from projector.geometry import (
    fit_unit_sphere,
    nearest_neighbors,
    pca_3d,
    snapshot_schedule,
    tsne_3d,
)


def test_pca_orders_variance_and_is_deterministic() -> None:
    rng = np.random.default_rng(0)
    vectors = rng.normal(size=(50, 8)) * np.array([10, 5, 2, 1, 1, 1, 1, 1])

    coords, variance = pca_3d(vectors)
    again, _ = pca_3d(vectors)

    assert coords.shape == (50, 3)
    assert variance[0] >= variance[1] >= variance[2] > 0
    assert sum(variance) <= 1.0
    np.testing.assert_allclose(coords, again)


def test_pca_pads_when_fewer_than_three_components() -> None:
    coords, variance = pca_3d(np.array([[0.0, 0.0], [1.0, 1.0]]))

    assert coords.shape == (2, 3)
    assert variance[1] == pytest.approx(0.0)


def test_pca_rejects_single_vector() -> None:
    with pytest.raises(ValueError):
        pca_3d(np.array([[1.0, 2.0]]))


def test_neighbors_use_cosine_in_original_space() -> None:
    vectors = np.array([[1.0, 0.0], [0.9, 0.1], [0.0, 1.0], [0.1, 0.9]])

    neighbors = nearest_neighbors(vectors, k=1)

    assert [idx for idx, _ in neighbors] == [(1,), (0,), (3,), (2,)]
    assert all(0.9 < sims[0] <= 1.0 for _, sims in neighbors)


def test_neighbors_never_include_self_and_cap_k() -> None:
    neighbors = nearest_neighbors(np.eye(3), k=10)

    assert all(len(idx) == 2 for idx, _ in neighbors)
    assert all(i not in idx for i, (idx, _) in enumerate(neighbors))


def _clusters() -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(0)
    centers = rng.normal(size=(3, 32)) * 6
    vectors = np.vstack([c + rng.normal(size=(25, 32)) for c in centers])
    return vectors, np.repeat([0, 1, 2], 25)


def test_tsne_separates_clusters_and_is_deterministic() -> None:
    vectors, labels = _clusters()

    first = tsne_3d(vectors, iterations=500, snapshots=10)
    again = tsne_3d(vectors, iterations=500, snapshots=10)
    final = first.frames[-1]
    spread = np.mean(
        [
            np.linalg.norm(final[labels == k] - final[labels == k].mean(0), axis=1).mean()
            for k in range(3)
        ]
    )
    gap = min(
        np.linalg.norm(final[labels == a].mean(0) - final[labels == b].mean(0))
        for a in range(3)
        for b in range(a + 1, 3)
    )

    assert gap > 3 * spread
    assert first.iterations[-1] == 500
    assert len(first.frames) == len(first.iterations)
    np.testing.assert_allclose(final, again.frames[-1])


def test_tsne_caps_perplexity_for_small_sets() -> None:
    result = tsne_3d(np.random.default_rng(1).normal(size=(10, 8)), iterations=50, snapshots=5)

    assert result.perplexity == pytest.approx(3.0)


def test_frames_fit_unit_sphere() -> None:
    coords = fit_unit_sphere(np.random.default_rng(2).normal(size=(30, 3)) * 50)

    assert np.linalg.norm(coords, axis=1).max() == pytest.approx(1.0)
    np.testing.assert_allclose(coords.mean(axis=0), 0, atol=1e-12)


def test_schedule_is_dense_early_and_ends_at_last_iteration() -> None:
    schedule = snapshot_schedule(600, 20)

    assert schedule[0] == 1 and schedule[-1] == 600
    assert schedule[1] - schedule[0] < schedule[-1] - schedule[-2]
