"""Composição: o único lugar que escolhe as implementações concretas."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from projector.build import build_projection
from projector.ollama import OllamaEmbedder
from projector.registry import load_registry
from projector.serialize import to_index, to_payload
from projector.sources import FileDocumentSource


def _args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gera a projeção 3D dos embeddings de cada agente do registro."
    )
    parser.add_argument("--registry", type=Path, default=Path("../model/agents.json"))
    parser.add_argument(
        "--source-root",
        type=Path,
        required=True,
        help="Clone do repositório de origem no commit citado em agents.json",
    )
    parser.add_argument("--out", type=Path, default=Path("../site/public/data/projector"))
    parser.add_argument("--ollama-url", default="http://localhost:11434")
    parser.add_argument("--agent", action="append", help="Gera só estes agentes (repetível)")
    return parser.parse_args()


def main() -> None:
    args = _args()
    registry = load_registry(args.registry)
    source = FileDocumentSource(args.source_root)
    embedder = OllamaEmbedder(registry.embedding_model, args.ollama_url)
    generated_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    args.out.mkdir(parents=True, exist_ok=True)

    selected = set(args.agent or [a.id for a in registry.agents])
    for agent in registry.agents:
        if agent.id not in selected:
            continue
        projection = build_projection(
            agent,
            source,
            embedder,
            source_repo=registry.source_repo,
            source_commit=registry.source_commit,
        )
        payload = to_payload(projection, generated_at)
        target = args.out / f"{agent.id}.json"
        target.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        print(f"{agent.id}: {len(payload['points'])} pontos -> {target}")

    payloads = [
        json.loads((args.out / f"{a.id}.json").read_text(encoding="utf-8"))
        for a in registry.agents
        if (args.out / f"{a.id}.json").exists()
    ]
    (args.out / "index.json").write_text(
        json.dumps(to_index(payloads), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
