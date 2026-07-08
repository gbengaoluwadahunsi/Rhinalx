"""Seed the memory store from data/sample.

Rebuilds the single-file store from scratch (idempotent): drops the DB, recreates
the schema, ingests every sample document (immutable), extracts decision episodes
with evidence spans, and builds the sqlite-vec index over source spans.

    uv run python scripts/seed.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Allow running as a plain script (add repo root to sys.path).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.config import settings  # noqa: E402
from backend.ingest import ingest_dir  # noqa: E402
from backend.inference.local import OllamaError  # noqa: E402
from backend.memory import consolidate, interview, store  # noqa: E402


def main() -> int:
    print(f"[seed] store: {settings.db_path}")
    print(f"[seed] corpus: {settings.sample_dir}")
    print(f"[seed] embeddings: {settings.embed_model} @ {settings.ollama_host}")

    store.reset_db(settings.db_path)
    con = store.connect(settings.db_path)
    store.ensure_schema(con)

    try:
        result = ingest_dir(con, settings.sample_dir)
    except OllamaError as exc:
        print(f"\n[seed] ERROR: {exc}")
        print("[seed] Is Ollama running and is the embedding model pulled?")
        print(f"[seed]   ollama pull {settings.embed_model}")
        return 1
    finally:
        con.close()

    print("\n[seed] ingested:")
    for f in result["files"]:
        print(f"  - {f['filename']:<34} spans={f['spans']:<3} episodes={f['episodes']}")
    if result.get("skipped"):
        print(f"[seed] skipped (not source docs): {', '.join(result['skipped'])}")
    print(
        f"\n[seed] done: {result['documents']} documents, "
        f"{result['episodes']} episodes, {result['spans']} indexed spans."
    )

    # Beat 1 — detect decisions whose rationale is absent, and raise interviews.
    print(f"\n[seed] detecting rationale gaps (policy={settings.policy}) ...")
    con = store.connect(settings.db_path)
    try:
        gaps = interview.detect_gaps(con)
    except Exception as exc:  # noqa: BLE001 - seed should still succeed without gaps
        print(f"[seed] gap detection skipped ({type(exc).__name__}: {exc})")
    else:
        print(f"[seed] checked {gaps['episodes_checked']} decisions, "
              f"raised {gaps['gaps_raised']} open question(s):")
        for g in gaps["raised"]:
            print(f"  ? [{g['backend']}] {g['kind']}: {g['episode']}  ({g['filename']})")

    # Phase 5 — consolidate episodic rationale into the semantic layer + archive
    # the superseded dose rationale (never deleted).
    print("\n[seed] consolidating rationale (episodic -> semantic) ...")
    try:
        cons = consolidate.run_consolidation(con)
    except Exception as exc:  # noqa: BLE001
        print(f"[seed] consolidation skipped ({type(exc).__name__}: {exc})")
    else:
        print(f"[seed] knowledge: {cons['current']} current, {cons['archived']} archived "
              f"(superseded, recoverable).")
    finally:
        con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
