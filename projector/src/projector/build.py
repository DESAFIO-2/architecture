"""Caso de uso: transformar os textos de um agente em disposições 3D (PCA e t-SNE)."""

from __future__ import annotations

import numpy as np

from projector.domain import AgentSpec, Coords, Document, Layout, ProjectedPoint, Projection
from projector.geometry import Matrix, fit_unit_sphere, nearest_neighbors, pca_3d, tsne_3d
from projector.ports import DocumentSource, Embedder

NEIGHBORS = 8


def _frame(coords: Matrix) -> tuple[Coords, ...]:
    return tuple((float(x), float(y), float(z)) for x, y, z in coords)


def _pct(value: float) -> str:
    return f"{value * 100:.1f}%".replace(".", ",")


def build_projection(
    agent: AgentSpec,
    source: DocumentSource,
    embedder: Embedder,
    *,
    source_repo: str,
    source_commit: str,
) -> Projection:
    documents: list[Document] = []
    for spec in agent.datasets:
        documents.extend(source.load(spec))
    if len(documents) < 4:
        raise ValueError(f"Agente {agent.id} tem menos de 4 textos para projetar")

    vectors = np.asarray(embedder.embed([d.text for d in documents]), dtype=np.float64)
    pca, variance = pca_3d(vectors)
    tsne = tsne_3d(vectors)
    layouts = (
        Layout(
            id="pca",
            label="PCA",
            note=f"3 componentes explicam {_pct(sum(variance))} da variância",
            frames=(_frame(fit_unit_sphere(pca)),),
        ),
        Layout(
            id="tsne",
            label="t-SNE",
            note=f"perplexidade {tsne.perplexity:.0f}, {tsne.iterations[-1]} iterações",
            frames=tuple(_frame(f) for f in tsne.frames),
            iterations=tsne.iterations,
        ),
    )
    neighbors = nearest_neighbors(vectors, NEIGHBORS)
    points = tuple(
        ProjectedPoint(document=doc, neighbors=idx, similarities=sims)
        for doc, (idx, sims) in zip(documents, neighbors, strict=True)
    )
    return Projection(
        agent=agent,
        model=embedder.model,
        dimensions=int(vectors.shape[1]),
        source_repo=source_repo,
        source_commit=source_commit,
        explained_variance=variance,
        layouts=layouts,
        points=points,
    )
