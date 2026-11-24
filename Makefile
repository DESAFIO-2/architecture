# Atalhos. SOURCE é um clone do development no commit citado em model/agents.json.

.PHONY: install check projector dev

install:
	cd site && npm ci
	cd projector && uv sync --frozen

check:
	cd site && npm run check
	cd projector && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q

projector:
	@test -n "$(SOURCE)" || (echo "uso: make projector SOURCE=<clone do development>"; exit 1)
	cd projector && uv run projector --source-root "$(abspath $(SOURCE))"

dev:
	cd site && npm run dev
