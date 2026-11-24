"""Lê `model/agents.json`, o registro de agentes do projetor."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from projector.domain import AgentSpec, DatasetSpec


@dataclass(frozen=True)
class Registry:
    embedding_model: str
    source_repo: str
    source_commit: str
    agents: tuple[AgentSpec, ...]

    def agent(self, agent_id: str) -> AgentSpec:
        for agent in self.agents:
            if agent.id == agent_id:
                return agent
        raise KeyError(f"Agente desconhecido: {agent_id}")


def _dataset(raw: dict[str, Any]) -> DatasetSpec:
    spec = DatasetSpec(
        id=raw["id"],
        path=raw["path"],
        format=raw["format"],
        id_field=raw["idField"],
        label_field=raw["labelField"],
        text_field=raw.get("textField"),
        text_template=raw.get("textTemplate"),
        group_field=raw.get("groupField"),
        group_value=raw.get("groupValue"),
    )
    if spec.format not in {"json", "jsonl"}:
        raise ValueError(f"{spec.id}: formato {spec.format!r} não suportado")
    if (spec.text_field is None) == (spec.text_template is None):
        raise ValueError(f"{spec.id}: defina textField ou textTemplate, não os dois")
    if (spec.group_field is None) == (spec.group_value is None):
        raise ValueError(f"{spec.id}: defina groupField ou groupValue, não os dois")
    return spec


def parse_registry(raw: dict[str, Any]) -> Registry:
    agents = tuple(
        AgentSpec(
            id=a["id"],
            label=a["label"],
            question=a["question"],
            datasets=tuple(_dataset(d) for d in a["datasets"]),
        )
        for a in raw["agents"]
    )
    ids = [a.id for a in agents]
    if len(ids) != len(set(ids)):
        raise ValueError("IDs de agente repetidos no registro")
    return Registry(
        embedding_model=raw["embeddingModel"],
        source_repo=raw["sourceRepo"],
        source_commit=raw["sourceCommit"],
        agents=agents,
    )


def load_registry(path: Path) -> Registry:
    return parse_registry(json.loads(path.read_text(encoding="utf-8")))
