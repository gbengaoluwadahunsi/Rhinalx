"""Rhinalx FastAPI application.

Phase 0: app shell + a /health route so the frontend can confirm the backend
is reachable. Feature routes (ingest, ask, open-questions, precedent) are added
in later phases, in the strict build order from CLAUDE.md.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Rhinalx API", version="0.1.0")

# The Vite dev server (5173) calls this API cross-origin during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe. Returns ok when the API is up."""
    return {"status": "ok", "service": "rhinalx"}
