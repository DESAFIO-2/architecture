"""Entidades do projetor. Não conhecem arquivos, HTTP nem numpy."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DatasetSpec:
    """Como ler um conjunto de textos de um agente, conforme `model/agents.json`."""

    id: str
    path: str
    format: str
    id_field: str
    label_field: str
    text_field: str | None = None
    text_template: str | None = None
    group_field: str | None = None
    group_value: str | None = None


@dataclass(frozen=True)
class AgentSpec:
    id: str
    label: str
    question: str
    datasets: tuple[DatasetSpec, ...]


@dataclass(frozen=True)
class Document:
    """Um texto que o agente consulta, já com o grupo usado para colorir o ponto."""

    id: str
    dataset: str
    text: str
    group: str
    label: str


@dataclass(frozen=True)
class ProjectedPoint:
    document: Document
    coords: tuple[float, float, float]
    neighbors: tuple[int, ...]


@dataclass(frozen=True)
class Projection:
    agent: AgentSpec
    model: str
    source_repo: str
    source_commit: str
    explained_variance: tuple[float, float, float]
    points: tuple[ProjectedPoint, ...] = field(default_factory=tuple)
