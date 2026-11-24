"""Converte a projeção no JSON que o site lê em `site/public/data/projector/`."""

from __future__ import annotations

from typing import Any

from projector.domain import Projection

TEXT_LIMIT = 280
SCHEMA = "projector/v1"


def _short(text: str) -> str:
    return text if len(text) <= TEXT_LIMIT else text[: TEXT_LIMIT - 1].rstrip() + "…"


def to_payload(projection: Projection, generated_at: str) -> dict[str, Any]:
    agent = projection.agent
    return {
        "schema": SCHEMA,
        "agent": {"id": agent.id, "label": agent.label, "question": agent.question},
        "model": projection.model,
        "generatedAt": generated_at,
        "source": {
            "repo": projection.source_repo,
            "commit": projection.source_commit,
            "datasets": [{"id": d.id, "path": d.path} for d in agent.datasets],
        },
        "explainedVariance": [round(v, 4) for v in projection.explained_variance],
        "points": [
            {
                "id": p.document.id,
                "dataset": p.document.dataset,
                "group": p.document.group,
                "label": p.document.label,
                "text": _short(p.document.text),
                "x": round(p.coords[0], 5),
                "y": round(p.coords[1], 5),
                "z": round(p.coords[2], 5),
                "neighbors": list(p.neighbors),
            }
            for p in projection.points
        ],
    }


def to_index(payloads: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schema": SCHEMA,
        "agents": [
            {
                "id": p["agent"]["id"],
                "label": p["agent"]["label"],
                "file": f"{p['agent']['id']}.json",
                "points": len(p["points"]),
            }
            for p in payloads
        ],
    }
