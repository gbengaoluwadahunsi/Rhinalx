# Convenience wrapper. `make` is optional on Windows; the canonical one-command
# entry point is `uv run python scripts/demo.py`.

.PHONY: demo setup api ui test frontend-smoke eval prod-api prod-ui

demo:
	uv run python scripts/demo.py

setup:
	uv sync
	cd frontend && npm install

api:
	uv run uvicorn backend.main:app --reload --port 8000

ui:
	cd frontend && npm run dev

test:
	uv run pytest
	cd frontend && npm run test:smoke

frontend-smoke:
	cd frontend && npm run test:smoke

eval:
	uv run python scripts/agentic_eval.py

prod-api:
	uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000

prod-ui:
	cd frontend && npm run build && npm run preview -- --host 127.0.0.1 --port 4173
