import numpy as np
import pytest

from projector.geometry import nearest_neighbors, pca_3d


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

    assert neighbors == [(1,), (0,), (3,), (2,)]


def test_neighbors_never_include_self_and_cap_k() -> None:
    neighbors = nearest_neighbors(np.eye(3), k=10)

    assert all(len(row) == 2 for row in neighbors)
    assert all(i not in row for i, row in enumerate(neighbors))
