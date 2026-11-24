import json
from collections.abc import Sequence
from pathlib import Path

import pytest

from projector.build import build_projection
from projector.domain import AgentSpec, DatasetSpec, Document
from projector.registry import load_registry, parse_registry
from projector.serialize import TEXT_LIMIT, to_index, to_payload

REGISTRY = Path(__file__).resolve().parents[2] / "model" / "agents.json"


class FakeEmbedder:
    model = "fake"

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return [
            [float(len(t)), float(t.count("a")), float(i % 3), 1.0] for i, t in enumerate(texts)
        ]


class ListSource:
    def __init__(self, docs: list[Document]) -> None:
        self._docs = docs

    def load(self, spec: DatasetSpec) -> list[Document]:
        return [d for d in self._docs if d.dataset == spec.id]


def _agent() -> AgentSpec:
    spec = DatasetSpec(
        id="ds",
        path="x",
        format="json",
        id_field="id",
        label_field="id",
        text_field="t",
        group_value="g",
    )
    return AgentSpec(id="a", label="A", question="?", datasets=(spec,))


def test_build_and_serialize_round_trip() -> None:
    docs = [Document(f"ds:{i}", "ds", "a" * (i + 1) + " texto" * 80, "g", str(i)) for i in range(8)]

    projection = build_projection(
        _agent(), ListSource(docs), FakeEmbedder(), source_repo="development", source_commit="abc"
    )
    payload = to_payload(projection, "2026-11-24T00:00:00Z")

    assert payload["model"] == "fake"
    assert len(payload["points"]) == 8
    assert all(len(p["text"]) <= TEXT_LIMIT for p in payload["points"])
    assert all(len(p["neighbors"]) == 5 for p in payload["points"])
    assert to_index([payload])["agents"][0] == {
        "id": "a",
        "label": "A",
        "file": "a.json",
        "points": 8,
    }
    json.dumps(payload)


def test_build_requires_two_documents() -> None:
    docs = [Document("ds:1", "ds", "só um", "g", "1")]

    with pytest.raises(ValueError):
        build_projection(
            _agent(), ListSource(docs), FakeEmbedder(), source_repo="r", source_commit="c"
        )


def test_repository_registry_is_valid() -> None:
    registry = load_registry(REGISTRY)

    assert registry.embedding_model == "bge-m3"
    assert {a.id for a in registry.agents} >= {"triagem", "auditor_farmaceutico"}


def test_registry_rejects_ambiguous_text_definition() -> None:
    raw = {
        "embeddingModel": "m",
        "sourceRepo": "r",
        "sourceCommit": "c",
        "agents": [
            {
                "id": "a",
                "label": "A",
                "question": "?",
                "datasets": [
                    {
                        "id": "d",
                        "path": "p",
                        "format": "json",
                        "idField": "id",
                        "labelField": "id",
                        "textField": "t",
                        "textTemplate": "{t}",
                        "groupValue": "g",
                    }
                ],
            }
        ],
    }

    with pytest.raises(ValueError):
        parse_registry(raw)
