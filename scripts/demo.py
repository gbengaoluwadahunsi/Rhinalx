"""One-command demo launcher for Rhinalx.

Brings up the whole demo so it never has to be assembled on camera:

  1. seed  — ingest data/sample, extract episodes, detect the rationale gap,
             consolidate knowledge (only if the store doesn't exist yet)
  2. api    — FastAPI backend on http://localhost:8000
  3. ui     — Vite dev server on http://localhost:5173

Run from the repo root:

    uv run python scripts/demo.py            # seed only if the store is missing
    uv run python scripts/demo.py --reseed   # force a clean rebuild first

Press Ctrl+C to stop both servers. Seeding calls Claude (gap detection,
consolidation) + local Ollama (embeddings), so it needs those available; once the
store exists, subsequent launches skip straight to the servers.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
DB_PATH = ROOT / "data" / "rhinalx.db"
IS_WIN = os.name == "nt"


def find_uv() -> str:
    """Locate uv even when it's installed to ~/.local/bin and not on PATH."""
    found = shutil.which("uv")
    if found:
        return found
    candidate = Path.home() / ".local" / "bin" / ("uv.exe" if IS_WIN else "uv")
    return str(candidate) if candidate.exists() else "uv"


def env_with(uv: str) -> dict[str, str]:
    env = os.environ.copy()
    env["PATH"] = str(Path(uv).parent) + os.pathsep + env.get("PATH", "")
    return env


def port_free(port: int) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def main() -> int:
    uv = find_uv()
    env = env_with(uv)
    reseed = "--reseed" in sys.argv

    for port, name in ((8000, "API"), (5173, "UI")):
        if not port_free(port):
            print(f"[demo] port {port} ({name}) is already in use — stop whatever is on it first.")
            return 1

    if reseed or not DB_PATH.exists():
        print("[demo] seeding the memory store (ingest -> episodes -> gap detection -> consolidation) ...")
        seeded = subprocess.run([uv, "run", "python", "scripts/seed.py"], cwd=ROOT, env=env)
        if seeded.returncode != 0:
            print("[demo] seed failed — is Ollama running (embeddings) and is a model available?")
            return 1
    else:
        print(f"[demo] using the existing store at {DB_PATH.relative_to(ROOT)} (pass --reseed to rebuild)")

    procs: list[subprocess.Popen] = []
    try:
        print("[api] starting FastAPI  -> http://localhost:8000")
        procs.append(subprocess.Popen(
            [uv, "run", "uvicorn", "backend.main:app", "--port", "8000"], cwd=ROOT, env=env,
        ))
        print("[ui]  starting Vite     -> http://localhost:5173")
        procs.append(subprocess.Popen(
            "npm run dev" if IS_WIN else ["npm", "run", "dev"],
            cwd=FRONTEND, env=env, shell=IS_WIN,
        ))
        print("\n  Rhinalx is up.  Open  ->  http://localhost:5173     (Ctrl+C to stop)\n")
        while True:
            time.sleep(1)
            for p in procs:
                if p.poll() is not None:
                    print(f"[demo] a process exited (code {p.returncode}); shutting down.")
                    raise KeyboardInterrupt
    except KeyboardInterrupt:
        print("\n[demo] stopping ...")
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
