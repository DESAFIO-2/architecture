import json
from pathlib import Path

from projector.domain import DatasetSpec
from projector.sources import FileDocumentSource, read_field, render_template


def test_read_field_follows_dots_and_tolerates_missing() -> None:
    record = {"source": {"source_id": "F01"}, "tags": ["a", "b"]}

    assert read_field(record, "source.source_id") == "F01"
    assert read_field(record, "tags") == "a, b"
    assert read_field(record, "source.missing.deep") == ""


def test_template_collapses_blank_fields() -> None:
    record = {"dcb_name": "losartana", "concentration": "50 mg", "pharmaceutical_form": None}

    text = render_template("{dcb_name} {concentration} {pharmaceutical_form}", record)

    assert text == "losartana 50 mg"


def test_jsonl_source_prefixes_ids_and_skips_empty_text(tmp_path: Path) -> None:
    rows = [
        {"id": "B1", "pergunta": "qual remédio tomo?", "esperado": "bloquear"},
        {"id": "B2", "pergunta": "  ", "esperado": "bloquear"},
    ]
    (tmp_path / "d.jsonl").write_text("\n".join(json.dumps(r) for r in rows), encoding="utf-8")
    spec = DatasetSpec(
        id="g",
        path="d.jsonl",
        format="jsonl",
        id_field="id",
        label_field="id",
        text_field="pergunta",
        group_field="esperado",
    )

    docs = FileDocumentSource(tmp_path).load(spec)

    assert [d.id for d in docs] == ["g:B1"]
    assert docs[0].group == "bloquear"


def test_constant_group_value(tmp_path: Path) -> None:
    (tmp_path / "d.json").write_text(json.dumps([{"id": 1, "q": "x"}]), encoding="utf-8")
    spec = DatasetSpec(
        id="g",
        path="d.json",
        format="json",
        id_field="id",
        label_field="id",
        text_field="q",
        group_value="pergunta",
    )

    assert FileDocumentSource(tmp_path).load(spec)[0].group == "pergunta"
