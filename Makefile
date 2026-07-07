# Convenience wrapper. `make` isn't installed on every machine (notably Windows);
# the canonical one-command entry point is `uv run python scripts/demo.py`.

.PHONY: demo setup api ui

demo:
	uv run python scripts/demo.py

setup:
	uv sync
	cd frontend && npm install

api:
	uv run uvicorn backend.main:app --reload --port 8000

ui:
	cd frontend && npm run dev
