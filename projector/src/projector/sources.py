"""Adaptador que lê os datasets de um clone local do repositório de origem."""

from __future__ import annotations

import json
import string
from pathlib import Path
from typing import Any

from projector.domain import DatasetSpec, Document


def read_field(record: dict[str, Any], dotted: str) -> str:
    """Lê `a.b.c` de um registro aninhado. Campo ausente vira texto vazio."""
    value: Any = record
    for part in dotted.split("."):
        if not isinstance(value, dict):
            return ""
        value = value.get(part)
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    return str(value)


def render_template(template: str, record: dict[str, Any]) -> str:
    fields = [name for _, name, _, _ in string.Formatter().parse(template) if name]
    values = {name: read_field(record, name) for name in fields}
    return " ".join(template.format(**values).split())


class FileDocumentSource:
    def __init__(self, root: Path) -> None:
        self._root = root

    def _records(self, spec: DatasetSpec) -> list[dict[str, Any]]:
        path = self._root / spec.path
        text = path.read_text(encoding="utf-8")
        if spec.format == "jsonl":
            return [json.loads(line) for line in text.splitlines() if line.strip()]
        data = json.loads(text)
        if not isinstance(data, list):
            raise ValueError(f"{spec.path}: esperava uma lista JSON")
        return data

    def load(self, spec: DatasetSpec) -> list[Document]:
        documents = []
        for record in self._records(spec):
            if spec.text_template is not None:
                text = render_template(spec.text_template, record)
            else:
                text = read_field(record, spec.text_field or "").strip()
            if not text:
                continue
            group = spec.group_value or read_field(record, spec.group_field or "") or "sem grupo"
            documents.append(
                Document(
                    id=f"{spec.id}:{read_field(record, spec.id_field)}",
                    dataset=spec.id,
                    text=text,
                    group=group,
                    label=read_field(record, spec.label_field),
                )
            )
        return documents
