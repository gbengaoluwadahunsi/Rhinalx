"""Beat 3 — precedent surfacing.

Given a decision (default: the most recent exclusion), find the most similar PRIOR
decision by embedding similarity, then have the reasoning model explain the
resemblance — grounded only in what both records actually say. If the two don't
genuinely resemble each other, it says so rather than inventing a connection.
Both cases are returned with their recorded reasons for citation.
"""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

import numpy as np

from backend.inference import router
from backend.memory import store

_SYSTEM = (
    "You are Rhinalx, a rigorous research-memory assistant. Explain the resemblance "
    "between two research decisions using ONLY the details provided. Ground the "
    "explanation in what both records actually state; never invent a shared reason. "
    "If the two decisions do not genuinely resemble each other, say so honestly."
)

_TEMPLATE = """CURRENT CASE — {cur_file} ({cur_date}){cur_rid}
Decision: {cur_summary}
Reason recorded: {cur_reason}

PRIOR CASE — {prec_file} ({prec_date}){prec_rid}
Decision: {prec_summary}
Reason recorded: {prec_reason}

Do these two decisions resemble each other — same underlying pattern or criterion?
Respond with ONLY a JSON object:
{{
  "resembles": true or false,
  "explanation": "<2-3 sentences naming the shared pattern, grounded only in the records above; empty if they don't resemble>"
}}"""


def _reason_text(ep: dict[str, Any]) -> str | None:
    for s in ep.get("spans", []):
        if s.get("role") == "reason":
            return s["text"]
    return None


def _signature(ep: dict[str, Any]) -> str:
    parts = [ep["summary"]]
    reason = _reason_text(ep)
    if reason:
        parts.append(reason)
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


def _parse_json(text: str) -> dict[str, Any]:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("no JSON object")
    return json.loads(text[start:end + 1])


def _pack(ep: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": ep["id"], "kind": ep["kind"], "summary": ep["summary"],
        "filename": ep["filename"], "date": ep.get("date"),
        "record_id": ep.get("record_id"), "reason": _reason_text(ep),
    }


def find_precedent(con: sqlite3.Connection, episode_id: int | None = None) -> dict[str, Any]:
    episodes = store.list_episodes(con)
    if not episodes:
        return {"found": False, "message": "no decisions in the record yet"}

    # Choose the "current" case: an explicit episode, else the most recent exclusion.
    current: dict[str, Any] | None = None
    if episode_id is not None:
        current = next((e for e in episodes if e["id"] == episode_id), None)
    if current is None:
        pool = [e for e in episodes if e["kind"] == "exclusion"] or episodes
        current = sorted(pool, key=lambda e: (e.get("date") or ""), reverse=True)[0]

    # Candidates: any other decision in a different source document.
    cands = [e for e in episodes if e["id"] != current["id"] and e["document_id"] != current["document_id"]]
    if not cands:
        return {"found": False, "current": _pack(current), "message": "no other decisions to compare against"}

    # Embedding similarity; prefer a candidate of the same kind (e.g. exclusion↔exclusion).
    vectors = router.embed([_signature(current)] + [_signature(c) for c in cands])
    cur_v = np.asarray(vectors[0], dtype=float)
    cand_v = np.asarray(vectors[1:], dtype=float)
    sims = (cand_v @ cur_v) / (np.linalg.norm(cand_v, axis=1) * np.linalg.norm(cur_v) + 1e-9)
    order = sorted(
        range(len(cands)),
        key=lambda i: (cands[i]["kind"] == current["kind"], float(sims[i])),
        reverse=True,
    )
    best = order[0]
    precedent = cands[best]
    score = float(sims[best])

    prompt = _TEMPLATE.format(
        cur_file=current["filename"], cur_date=current.get("date"),
        cur_rid=f" · {current['record_id']}" if current.get("record_id") else "",
        cur_summary=current["summary"], cur_reason=_reason_text(current) or "(none)",
        prec_file=precedent["filename"], prec_date=precedent.get("date"),
        prec_rid=f" · {precedent['record_id']}" if precedent.get("record_id") else "",
        prec_summary=precedent["summary"], prec_reason=_reason_text(precedent) or "(none)",
    )
    result = router.reason(prompt, system=_SYSTEM, max_tokens=400, temperature=0.0)
    try:
        data = _parse_json(result.text)
    except (ValueError, json.JSONDecodeError):
        data = {"resembles": False, "explanation": ""}

    resembles = bool(data.get("resembles")) and score >= 0.4
    return {
        "found": resembles,
        "similarity": round(score, 3),
        "backend": result.backend,
        "model": result.model,
        "current": _pack(current),
        "precedent": _pack(precedent) if resembles else None,
        "explanation": (data.get("explanation") or "").strip() if resembles else None,
        "message": None if resembles else "no clear precedent in the record",
    }
