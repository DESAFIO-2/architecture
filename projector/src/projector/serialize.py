"""Converte a projeção no JSON que o site lê em `site/public/data/projector/`."""

from __future__ import annotations

from typing import Any

from projector.domain import Layout, Projection

TEXT_LIMIT = 280
SCHEMA = "projector/v2"


def _short(text: str) -> str:
    return text if len(text) <= TEXT_LIMIT else text[: TEXT_LIMIT - 1].rstrip() + "…"


def _layout(layout: Layout) -> dict[str, Any]:
    # Quadros achatados [x0, y0, z0, x1, ...] com 4 casas: menos bytes, mesma figura.
    return {
        "id": layout.id,
        "label": layout.label,
        "note": layout.note,
        "iterations": list(layout.iterations),
        "frames": [[round(c, 4) for xyz in frame for c in xyz] for frame in layout.frames],
    }


def to_payload(projection: Projection, generated_at: str) -> dict[str, Any]:
    agent = projection.agent
    return {
        "schema": SCHEMA,
        "agent": {"id": agent.id, "label": agent.label, "question": agent.question},
        "model": projection.model,
        "dimensions": projection.dimensions,
        "generatedAt": generated_at,
        "source": {
            "repo": projection.source_repo,
            "commit": projection.source_commit,
            "datasets": [{"id": d.id, "path": d.path} for d in agent.datasets],
        },
        "explainedVariance": [round(v, 4) for v in projection.explained_variance],
        "layouts": [_layout(layout) for layout in projection.layouts],
        "points": [
            {
                "id": p.document.id,
                "dataset": p.document.dataset,
                "group": p.document.group,
                "label": p.document.label,
                "text": _short(p.document.text),
                "neighbors": list(p.neighbors),
                "similarity": [round(s, 4) for s in p.similarities],
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
