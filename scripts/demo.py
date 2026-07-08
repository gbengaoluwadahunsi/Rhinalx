"""One-command launcher for Rhinalx.

Starts the backend + UI. The app boots **empty** by default — a production start
where you ingest your own sources at http://localhost:5173/app/ingest. Pass --seed
to load the bundled sample study (the canned demo) instead.

  api  — FastAPI backend on http://localhost:8000
  ui   — Vite dev server on http://localhost:5173

Run from the repo root:

    uv run python scripts/demo.py            # start empty (production)
    uv run python scripts/demo.py --seed     # load the sample study first (demo)
    uv run python scripts/demo.py --reseed   # rebuild the sample study, then run

Press Ctrl+C to stop both servers. Seeding calls Claude (gap detection,
consolidation) + local Ollama (embeddings), so it needs those available.
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
    seed_demo = reseed or "--seed" in sys.argv or "--demo" in sys.argv

    for port, name in ((8000, "API"), (5173, "UI")):
        if not port_free(port):
            print(f"[demo] port {port} ({name}) is already in use — stop whatever is on it first.")
            return 1

    if seed_demo:
        if reseed and DB_PATH.exists():
            DB_PATH.unlink()
        print("[demo] loading the sample study (ingest -> episodes -> gap detection -> consolidation) ...")
        seeded = subprocess.run([uv, "run", "python", "scripts/seed.py"], cwd=ROOT, env=env)
        if seeded.returncode != 0:
            print("[demo] seed failed — is Ollama running (embeddings) and is a model available?")
            return 1
    elif DB_PATH.exists():
        print(f"[demo] using the existing store at {DB_PATH.relative_to(ROOT)}")
    else:
        print("[demo] starting with an empty study — ingest your own sources at http://localhost:5173/app/ingest")

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
