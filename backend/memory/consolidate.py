"""Phase 5 — consolidation (episodic -> semantic) + adaptive forgetting.

Consolidation distills stable, current rationale from the decision episodes into the
knowledge layer. Forgetting handles supersession: when a newer decision replaces an
older one (the LPS dose dropped from 1 mg/kg to 250 ug/kg between protocol v2 and v3),
the old rationale is ARCHIVED — kept, cited, and searchable, but marked superseded and
given a lower retrieval weight. Nothing is deleted.
"""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from backend.inference import router
from backend.memory import store

_DOSE_SYSTEM = (
    "You are Rhinalx, a rigorous research-memory assistant. Distill stable rationale "
    "from the record using ONLY the passages provided. Never invent facts. Write "
    "concise, scientist-facing statements."
)

_DOSE_TEMPLATE = """The lab reduced the LPS induction dose from 1 mg/kg to 250 ug/kg between protocol v2 and v3.

SOURCE PASSAGES:
{passages}

Produce two consolidated rationale statements, each ONE sentence and grounded only in the passages:
- "current": why the CURRENT 250 ug/kg dose is used.
- "archived": the SUPERSEDED 1 mg/kg dosing — what it was and why it was abandoned.

Do NOT include passage numbers or bracket citations (like [1,2]) in the statements.
Respond with ONLY a JSON object: {{"current": "...", "archived": "..."}}"""


def _polish(text: str) -> str:
    """Clean a rationale statement for the knowledge layer: drop markdown bold,
    any leaked passage-number citations, and a leading 'Reason:' label."""
    t = text.replace("**", "")
    t = re.sub(r"\s*\[[\d,\s]+\]", "", t)               # e.g. "[1,4,5]"
    t = re.sub(r"(?i)^\s*reason[^:]*:\s*", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    if t and t[-1] not in ".!?":
        t += "."
    return t


def _passages(hits: list[dict[str, Any]]) -> str:
    lines = []
    for i, h in enumerate(hits, 1):
        text = re.sub(r"\s+", " ", h["text"]).strip()
        lines.append(f"[{i}] ({h['filename']}) {text}")
    return "\n".join(lines)


def _parse_json(text: str) -> dict[str, Any]:
    s, e = text.find("{"), text.rfind("}")
    if s == -1 or e == -1 or e < s:
        raise ValueError("no JSON")
    return json.loads(text[s:e + 1])


def _consolidate_dose(con: sqlite3.Connection, dose_ep: dict[str, Any]) -> str | None:
    """Distill the current dose rationale and archive the superseded 1 mg/kg one."""
    vec = router.embed([
        "LPS induction dose reduced from 1 mg/kg to 250 ug/kg pilot mortality tolerability rationale"
    ])[0]
    hits = store.search_spans(con, vec, k=8)
    prompt = _DOSE_TEMPLATE.format(passages=_passages(hits))
    result = router.reason(prompt, system=_DOSE_SYSTEM, max_tokens=400, temperature=0.0)
    try:
        data = _parse_json(result.text)
    except (ValueError, json.JSONDecodeError):
        return None

    current = _polish(str(data.get("current", "")))
    archived = _polish(str(data.get("archived", "")))
    if not current:
        return None

    current_id = store.insert_rationale(
        con, statement=current, episode_id=dose_ep["id"], source="consolidation",
        status="current", weight=1.0,
        provenance={
            "type": "consolidation",
            "note": "Distilled across the pilot notebook, the supervisor meeting, and protocol v3.",
            "backend": result.backend,
        },
    )
    if archived:
        store.insert_rationale(
            con, statement=archived, episode_id=dose_ep["id"], source="consolidation",
            status="archived", weight=0.25, superseded_by=current_id,
            provenance={
                "type": "consolidation",
                "note": "Superseded when the induction dose was reduced to 250 ug/kg (protocol v3).",
                "backend": result.backend,
            },
        )
    return result.backend


def _consolidate_recorded_reason(con: sqlite3.Connection, ep: dict[str, Any]) -> None:
    """A decision whose reason is recorded once becomes a current knowledge card."""
    reason = next((s["text"] for s in ep.get("spans", []) if s.get("role") == "reason"), None)
    if not reason:
        return
    store.insert_rationale(
        con, statement=_polish(reason), episode_id=ep["id"], source="consolidation",
        status="current", weight=1.0,
        provenance={
            "type": "consolidation", "author": "record", "source_file": ep["filename"],
            "note": "Consolidated from the recorded reason.",
        },
    )


def run_consolidation(con: sqlite3.Connection) -> dict[str, Any]:
    """(Re)build the semantic layer from episodes. Idempotent; keeps interview answers."""
    store.clear_consolidation(con)
    episodes = store.list_episodes(con)

    backend: str | None = None
    dose = next((e for e in episodes if e["kind"] == "dose_change"), None)
    if dose:
        backend = _consolidate_dose(con, dose)

    for ep in episodes:
        if ep["kind"] == "exclusion":
            _consolidate_recorded_reason(con, ep)

    rationales = store.list_rationales(con)
    current = sum(1 for r in rationales if r["status"] == "current")
    archived = sum(1 for r in rationales if r["status"] == "archived")
    return {"current": current, "archived": archived, "backend": backend}
