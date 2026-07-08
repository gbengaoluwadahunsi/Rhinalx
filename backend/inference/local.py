"""Ollama-backed local inference.

Phase 1 uses only embeddings (`nomic-embed-text`), which per CLAUDE.md are always
local so retrieval works fully offline. The local LLM (reason() fallback) is wired
in later phases.
"""
from __future__ import annotations

import httpx

from backend.config import settings
from backend.inference.base import Vector


class OllamaError(RuntimeError):
    """Raised when the local Ollama server is unreachable or errors."""


def embed(texts: list[str]) -> list[Vector]:
    """Embed each text with the local embedding model. Returns one vector per text.

    Uses Ollama's /api/embeddings (single-prompt) per text — the corpus is tiny,
    so a simple loop is plenty and avoids version-specific batch endpoints.
    """
    url = f"{settings.ollama_host.rstrip('/')}/api/embeddings"
    vectors: list[Vector] = []
    try:
        with httpx.Client(timeout=60) as client:
            for text in texts:
                resp = client.post(
                    url, json={"model": settings.embed_model, "prompt": text}
                )
                resp.raise_for_status()
                emb = resp.json().get("embedding")
                if not emb:
                    raise OllamaError(
                        f"empty embedding from {settings.embed_model}; is the model pulled?"
                    )
                vectors.append(emb)
    except httpx.HTTPError as exc:
        raise OllamaError(
            f"Ollama embedding call failed at {url} "
            f"(model={settings.embed_model}): {exc}"
        ) from exc
    return vectors


def reason(prompt: str, *, system: str | None = None, max_tokens: int = 1024,
           temperature: float = 0.2) -> str:
    """Reason with the local Ollama LLM (offline fallback for the smart steps)."""
    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    try:
        with httpx.Client(timeout=180) as client:
            resp = client.post(url, json={
                "model": settings.local_llm_model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": max_tokens},
            })
            resp.raise_for_status()
            return resp.json()["message"]["content"].strip()
    except httpx.HTTPError as exc:
        raise OllamaError(
            f"Ollama chat call failed at {url} "
            f"(model={settings.local_llm_model}): {exc}"
        ) from exc
