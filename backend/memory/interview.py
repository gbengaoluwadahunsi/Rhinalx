"""Beat 1 — proactive interview: gap detection + answer capture.

On ingest we have decision episodes. For each, we ask the reasoning model whether
its *rationale* — an explicit statement of WHY — exists anywhere in the corpus,
grounded strictly in retrieved passages. If none does, we raise an OpenQuestion and
interview the scientist. Their answer is filed as a ConsolidatedRationale whose
provenance is their own words. The model is instructed never to invent a rationale;
catalog numbers, dates, and what-changed do not count.
"""
from __future__ import annotations

import datetime as _dt
import json
import re
import sqlite3
from typing import Any

from backend.inference import router
from backend.memory import store

# Episode kinds that represent a decision whose "why" could be missing.
_DECISION_KINDS = {"dose_change", "reagent_swap", "protocol_change", "decision", "exclusion"}

_GAP_SYSTEM = (
    "You are Rhinalx, a rigorous research-memory assistant for a bench scientist. "
    "You judge ONLY from the passages provided and you NEVER invent rationale. "
    "A 'rationale' is an explicit statement of WHY a decision was made (a cause, "
    "a justification, a trade-off). It may appear inside the decision statement "
    "itself — a parenthetical, a 'because', or a 'to <purpose>' clause — or in a "
    "separate passage. Catalog/lot numbers, dates, who did it, and a plain "
    "restatement of WHAT changed are NOT a rationale. If no passage gives an "
    "explicit reason, you must report that the rationale is missing."
)

_GAP_TEMPLATE = """A decision was extracted from a lab's records:

  DECISION: {summary}
  Recorded in: {filename} (dated {date})

Below are the passages from the ENTIRE corpus most related to this decision. This is
everything the record contains near it:

{passages}

Question: Do these passages explicitly state the RATIONALE — the reason WHY this
decision was made? Judge only from the passages above.

Respond with ONLY a JSON object, no prose:
{{
  "has_rationale": true or false,
  "evidence_filename": "<file that states the reason, or null>",
  "reason_summary": "<one-sentence summary of the stated reason, or null>",
  "question": "<if has_rationale is false: one concise, specific question (second person, addressed to the scientist) asking why this decision was made — reference the concrete change; else null>"
}}"""


def _passages(hits: list[dict[str, Any]]) -> str:
    lines = []
    for i, h in enumerate(hits, 1):
        text = re.sub(r"\s+", " ", h["text"]).strip()
        lines.append(f"[{i}] ({h['filename']}) {text}")
    return "\n".join(lines) if lines else "(no related passages found)"


def _parse_json(text: str) -> dict[str, Any]:
    """Extract the first JSON object from a model response (robust to stray prose)."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"no JSON object in model output: {text[:200]!r}")
    return json.loads(text[start:end + 1])


def _default_question(episode: dict[str, Any]) -> str:
    return (
        f"You recorded \"{episode['summary']}\" ({episode['filename']}, "
        f"{episode.get('date')}), but no reason for it appears anywhere in the record. "
        f"Why was this done?"
    )


def detect_gap_for_episode(con: sqlite3.Connection, episode: dict[str, Any]) -> dict[str, Any]:
    """Decide whether an episode's rationale is present in the corpus (grounded)."""
    # Surface the episode's OWN spans (the decision, and any recorded reason) first —
    # a rationale may live inline inside the decision statement (a parenthetical or a
    # "to <purpose>" clause) — then add the retrieved surrounding record. The prompt
    # enforces that a mere restatement of WHAT changed is not a rationale.
    own = episode.get("spans", [])
    own_sorted = sorted(own, key=lambda s: 0 if s.get("role") == "decision" else 1)

    query = f"{episode['summary']} — reason, rationale, why, justification"
    vec = router.embed([query])[0]
    hits = store.search_spans(con, vec, k=10)

    passages: list[dict[str, Any]] = [
        {"filename": episode["filename"], "text": s["text"]} for s in own_sorted
    ]
    seen = {(p["filename"], p["text"]) for p in passages}
    for h in hits:
        key = (h["filename"], h["text"])
        if key not in seen:
            passages.append(h)
            seen.add(key)
    hits = passages[:9]

    prompt = _GAP_TEMPLATE.format(
        summary=episode["summary"], filename=episode["filename"],
        date=episode.get("date"), passages=_passages(hits),
    )
    result = router.reason(prompt, system=_GAP_SYSTEM, max_tokens=500, temperature=0.0)
    try:
        data = _parse_json(result.text)
    except (ValueError, json.JSONDecodeError):
        # If the model didn't return usable JSON, treat as inconclusive (no gap raised).
        data = {"has_rationale": True, "question": None}

    has_rationale = bool(data.get("has_rationale"))
    question = data.get("question") or (None if has_rationale else _default_question(episode))
    return {
        "episode_id": episode["id"],
        "has_rationale": has_rationale,
        "reason_summary": data.get("reason_summary"),
        "evidence_filename": data.get("evidence_filename"),
        "question": question,
        "backend": result.backend,
    }


def detect_gaps(con: sqlite3.Connection) -> dict[str, Any]:
    """Run gap detection across all decision episodes; raise OpenQuestions for gaps."""
    store.clear_open_questions(con)
    episodes = [e for e in store.list_episodes(con) if e["kind"] in _DECISION_KINDS]

    raised = []
    for ep in episodes:
        outcome = detect_gap_for_episode(con, ep)
        if not outcome["has_rationale"] and outcome["question"]:
            oq_id = store.insert_open_question(
                con, episode_id=ep["id"], prompt=outcome["question"],
                detected_backend=outcome["backend"],
            )
            raised.append({
                "open_question_id": oq_id,
                "episode": ep["summary"],
                "kind": ep["kind"],
                "filename": ep["filename"],
                "backend": outcome["backend"],
            })
    return {"episodes_checked": len(episodes), "gaps_raised": len(raised), "raised": raised}


def answer_open_question(con: sqlite3.Connection, oq_id: int, answer: str) -> dict[str, Any]:
    """Capture the scientist's answer as a ConsolidatedRationale (provenance = them)."""
    oq = store.get_open_question(con, oq_id)
    if not oq:
        raise KeyError(f"no open question {oq_id}")
    if not answer.strip():
        raise ValueError("answer is empty")

    today = _dt.date.today().isoformat()
    provenance = {
        "type": "interview",
        "author": "scientist",
        "date": today,
        "open_question_id": oq_id,
        "note": "Captured from the scientist's own words in response to a Rhinalx interview.",
    }
    rationale_id = store.insert_rationale(
        con, statement=answer.strip(), episode_id=oq["episode_id"],
        source="interview", provenance=provenance, status="current",
    )
    store.mark_question_answered(con, oq_id, answer.strip(), rationale_id)
    return store.get_rationale(con, rationale_id)
