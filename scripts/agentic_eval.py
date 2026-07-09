"""Local agentic-memory smoke checks.

This script does not grade model quality. It inspects the current Rhinalx memory
for behaviors the demo should surface: repeated changes, possible contradictions,
and rationale evolution. Run after seeding or ingesting your own corpus:

    uv run python scripts/agentic_eval.py
"""
from __future__ import annotations

import re
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.config import settings  # noqa: E402
from backend.memory import store  # noqa: E402

TERMS = {
    "lps dose": re.compile(r"\b(lps|dose|mg/kg|ug/kg|µg/kg)\b", re.I),
    "antibody": re.compile(r"\b(antibody|abcam|novus|gal-?3|elisa)\b", re.I),
    "exclusion": re.compile(r"\b(exclud|animal|mwm|visible-platform|retain)\b", re.I),
}
CONTRADICTION_HINTS = re.compile(r"\b(revert|contradict|instead|however|but|failed|no longer|supersede|supersedes)\b", re.I)


def main() -> int:
    con = store.connect(settings.db_path)
    store.ensure_schema(con)
    try:
        episodes = store.list_episodes(con)
        rationales = store.list_rationales(con)
    finally:
        con.close()

    print("Rhinalx agentic-memory eval")
    print(f"store: {settings.db_path}")
    print(f"episodes: {len(episodes)} | rationales: {len(rationales)}")

    if not episodes:
        print("\nNo episodes yet. Ingest sources first or run: uv run python scripts/seed.py")
        return 1

    print("\nRepeated-change signals")
    grouped: dict[str, list[dict]] = defaultdict(list)
    for ep in episodes:
        haystack = " ".join([ep.get("summary") or "", ep.get("what_changed") or ""])
        for label, rx in TERMS.items():
            if rx.search(haystack):
                grouped[label].append(ep)
    for label, rows in grouped.items():
        if len(rows) < 2:
            continue
        print(f"- {label}: changed or discussed {len(rows)} times")
        for ep in rows[:4]:
            print(f"  {ep.get('date') or 'undated'} | {ep['filename']} | {ep['summary']}")

    print("\nPotential contradiction / supersession hints")
    hits = [ep for ep in episodes if CONTRADICTION_HINTS.search(" ".join([ep.get("summary") or "", ep.get("what_changed") or ""]))]
    if not hits:
        print("- none found in episode summaries")
    for ep in hits[:6]:
        print(f"- {ep.get('date') or 'undated'} | {ep['filename']} | {ep['summary']}")

    print("\nRationale evolution")
    by_episode: dict[int, list[dict]] = defaultdict(list)
    for r in rationales:
        if r.get("episode_id") is not None:
            by_episode[int(r["episode_id"])].append(r)
    evolved = {eid: rows for eid, rows in by_episode.items() if len(rows) > 1 or any(r.get("status") == "archived" for r in rows)}
    if not evolved:
        print("- no multi-rationale or archived-rationale chains yet")
    for eid, rows in list(evolved.items())[:5]:
        print(f"- episode {eid}: {len(rows)} rationale records")
        for r in rows:
            print(f"  {r['status']} weight={r.get('weight', 1)} | {r['statement'][:110]}")

    print("\nDemo prompts to try")
    print("- Why did we change the LPS dose in cohort 3?")
    print("- Have we excluded an animal for this reason before?")
    print("- What changed about the Gal-3 ELISA antibody?")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())