"""Adaptador de embeddings via Ollama local (`/api/embed`). Nada sai da máquina."""

from __future__ import annotations

import json
import urllib.request
from collections.abc import Sequence

BATCH = 32


class OllamaEmbedder:
    def __init__(self, model: str, base_url: str = "http://localhost:11434", timeout: int = 300):
        self._model = model
        self._url = base_url.rstrip("/") + "/api/embed"
        self._timeout = timeout

    @property
    def model(self) -> str:
        return self._model

    def _post(self, texts: Sequence[str]) -> list[list[float]]:
        body = json.dumps({"model": self._model, "input": list(texts)}).encode("utf-8")
        request = urllib.request.Request(
            self._url, data=body, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=self._timeout) as response:
            payload = json.loads(response.read())
        vectors: list[list[float]] = payload["embeddings"]
        if len(vectors) != len(texts):
            raise RuntimeError("Ollama devolveu um número de vetores diferente do pedido")
        return vectors

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), BATCH):
            vectors.extend(self._post(texts[start : start + BATCH]))
        return vectors
