"""Central configuration, loaded from the environment (.env if present).

Everything reads settings from here so no module hardcodes a model, host, or
path. Secrets (the Anthropic key) are read from the env and never written to code.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Repo root = parent of the backend/ package.
ROOT = Path(__file__).resolve().parents[1]

# Load .env if the developer created one (copy of .env.example). Absent is fine —
# the core loop (local embeddings) needs no secrets.
load_dotenv(ROOT / ".env")


def _resolve(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else (ROOT / p)


@dataclass(frozen=True)
class Settings:
    # Reasoning backend policy: "claude" (API when allowed, local fallback) or "local".
    policy: str = os.getenv("POLICY", "claude")

    # Anthropic (reasoning path; used from Phase 2 onward). Read from env only.
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    model: str = os.getenv("MODEL", "claude-sonnet-5")

    # Ollama (local models).
    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    embed_model: str = os.getenv("EMBED_MODEL", "nomic-embed-text")
    local_llm_model: str = os.getenv("LOCAL_LLM_MODEL", "llama3.1:8b")

    # Single-file store.
    db_path: Path = _resolve(os.getenv("DB_PATH", "data/rhinalx.db"))

    # Where the demo corpus lives.
    sample_dir: Path = ROOT / "data" / "sample"


settings = Settings()
