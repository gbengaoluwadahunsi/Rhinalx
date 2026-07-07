"""One-command demo launcher for Rhinalx.

Brings up the whole demo environment so it never has to be assembled on camera:

  1. seed  — ingest data/sample into the single-file memory store
  2. api    — FastAPI backend on :8000
  3. ui     — Vite dev server on :5173

Run from the repo root:

    uv run python scripts/demo.py

Phase 0: (2) and (3) are wired and launched; (1) is a placeholder that becomes
real in Phase 1 (ingest + span-preserving store). Press Ctrl+C to stop both.
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"


def seed() -> None:
    """Ingest data/sample into the memory store. Wired up in Phase 1."""
    seed_script = ROOT / "scripts" / "seed.py"
    if seed_script.exists():
        print("[seed] running scripts/seed.py …")
        subprocess.run([sys.executable, str(seed_script)], cwd=ROOT, check=True)
    else:
        print("[seed] no seed script yet (arrives in Phase 1) — skipping.")


def main() -> int:
    seed()

    procs: list[subprocess.Popen] = []
    try:
        print("[api] starting FastAPI on http://localhost:8000 …")
        procs.append(
            subprocess.Popen(
                ["uv", "run", "uvicorn", "backend.main:app", "--port", "8000"],
                cwd=ROOT,
                shell=(sys.platform == "win32"),
            )
        )

        print("[ui]  starting Vite on http://localhost:5173 …")
        procs.append(
            subprocess.Popen(
                ["npm", "run", "dev"],
                cwd=FRONTEND,
                shell=(sys.platform == "win32"),
            )
        )

        print("\nRhinalx demo is up. API :8000 · UI :5173 — Ctrl+C to stop.\n")
        while True:
            time.sleep(1)
            for p in procs:
                if p.poll() is not None:
                    print(f"[demo] a process exited (code {p.returncode}); shutting down.")
                    raise KeyboardInterrupt
    except KeyboardInterrupt:
        print("\n[demo] stopping …")
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
