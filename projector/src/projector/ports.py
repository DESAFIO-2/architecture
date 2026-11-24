"""Portas: o caso de uso depende destes contratos, não das implementações."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from projector.domain import DatasetSpec, Document


class Embedder(Protocol):
    @property
    def model(self) -> str: ...

    def embed(self, texts: Sequence[str]) -> list[list[float]]: ...


class DocumentSource(Protocol):
    def load(self, spec: DatasetSpec) -> list[Document]: ...
