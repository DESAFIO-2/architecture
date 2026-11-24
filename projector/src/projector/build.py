"""Caso de uso: transformar os textos de um agente numa projeção 3D."""

from __future__ import annotations

import numpy as np

from projector.domain import AgentSpec, Document, ProjectedPoint, Projection
from projector.geometry import nearest_neighbors, pca_3d
from projector.ports import DocumentSource, Embedder

NEIGHBORS = 5


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
    if len(documents) < 2:
        raise ValueError(f"Agente {agent.id} tem menos de 2 textos para projetar")

    vectors = np.asarray(embedder.embed([d.text for d in documents]), dtype=np.float64)
    coords, variance = pca_3d(vectors)
    neighbors = nearest_neighbors(vectors, NEIGHBORS)

    points = tuple(
        ProjectedPoint(
            document=doc,
            coords=(float(c[0]), float(c[1]), float(c[2])),
            neighbors=neighbors[i],
        )
        for i, (doc, c) in enumerate(zip(documents, coords, strict=True))
    )
    return Projection(
        agent=agent,
        model=embedder.model,
        source_repo=source_repo,
        source_commit=source_commit,
        explained_variance=variance,
        points=points,
    )
