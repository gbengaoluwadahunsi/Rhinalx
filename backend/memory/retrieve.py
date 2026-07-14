"""Beat 2 — "why did we change this?" reconstruction.

Retrieve the source spans most relevant to a question, then have the reasoning
model assemble a concise narrative answer where EVERY claim is grounded in a
specific retrieved span (cited by number). The model uses only the provided
passages; if they don't support an answer it refuses ("insufficient evidence in
the record") rather than guessing. Each claim carries its source spans (with exact
offsets) all the way to the UI, so provenance is structural, not decorative.
"""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from backend.inference import router
from backend.memory import store

_ASSEMBLY_SYSTEM = (
    "You are Rhinalx, a rigorous research-memory assistant for a bench scientist. "
    "Reconstruct the reasoning behind a research decision using ONLY the numbered "
    "source passages provided. Every claim you make must be supported by at least "
    "one passage, and you must cite the passage number(s) it rests on. Do NOT use "
    "outside knowledge and do NOT state anything the passages don't support. If the "
    "passages do not actually explain the reason asked about, say so honestly. Be "
    "concise and precise — a scientist is reading, and a confident wrong answer is "
    "worse than an honest gap. Some passages are reasons the scientist recorded "
    "directly through an interview (labelled 'captured reason'); treat those as valid "
    "evidence you may cite, exactly like a source passage."
)

_ASSEMBLY_TEMPLATE = """QUESTION: {claim}

SOURCE PASSAGES (the record's most relevant spans):
{passages}

Assemble the answer. Respond with ONLY a JSON object, no prose:
{{
  "sufficient": true or false,
  "claims": [
    {{"text": "<one sentence stating a single fact that answers the question>", "cites": [<passage numbers that support it>]}}
  ]
}}

Rules:
- 2 to 5 claims. Each claim must cite the passage number(s) that support it.
- Never assert a fact that isn't in the cited passage(s). No outside knowledge.
- If no passage gives the actual reason, return {{"sufficient": false, "claims": []}}."""


def _passages(hits: list[dict[str, Any]]) -> str:
    lines = []
    for i, h in enumerate(hits, 1):
        text = re.sub(r"\s+", " ", h["text"]).strip()
        lines.append(f"[{i}] ({h['filename']}) {text}")
    return "\n".join(lines)


def _parse_json(text: str) -> dict[str, Any]:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("no JSON object in model output")
    return json.loads(text[start:end + 1])


def _norm(t: str) -> str:
    return re.sub(r"\s+", " ", t or "").strip()


def _relevant_rationales(con: sqlite3.Connection, query_vec: list[float], limit: int = 6) -> list[dict[str, Any]]:
    """Current captured rationale (interview answers + consolidated reasons), ranked
    to the query when there are many. A decision explained only through the interview
    is still answerable, because the scientist's recorded reason IS part of the record."""
    rats = [r for r in store.list_rationales(con, status="current") if (r.get("statement") or "").strip()]
    if len(rats) <= limit:
        return rats
    import numpy as np
    vecs = router.embed([r["statement"] for r in rats])
    q = np.asarray(query_vec, dtype=float)
    m = np.asarray(vecs, dtype=float)
    sims = (m @ q) / (np.linalg.norm(m, axis=1) * np.linalg.norm(q) + 1e-9)
    return [rats[int(i)] for i in np.argsort(-sims)[:limit]]


def _rationale_source(r: dict[str, Any]) -> dict[str, Any]:
    """Render a captured rationale as a citation source (no document offsets)."""
    prov = r.get("provenance")
    if isinstance(prov, str):
        try:
            prov = json.loads(prov)
        except (ValueError, json.JSONDecodeError):
            prov = {}
    prov = prov or {}
    who = prov.get("author") or ("the scientist" if r.get("source") == "interview" else "the record")
    return {
        "filename": f"captured reason ({who})",
        "date": prov.get("date") or r.get("created_at"),
        "start_char": 0, "end_char": 0,
        "text": _norm(r.get("statement", "")),
        "context_before": "",
        "context_after": f"re: {r['episode_summary']}" if r.get("episode_summary") else "",
    }


def reconstruct(con: sqlite3.Connection, claim: str, k: int = 8, context: int = 90) -> dict[str, Any]:
    """Reconstruct a cited 'why' answer from the record: source-document spans PLUS
    any reasons the scientist captured through the interview."""
    query_vec = router.embed([claim])[0]
    span_hits = store.search_spans(con, query_vec, k=k)
    rationales = _relevant_rationales(con, query_vec)

    if not span_hits and not rationales:
        return {"claim": claim, "sufficient": False,
                "message": "insufficient evidence in the record", "answer": []}

    # Raw text per document (for surrounding context on each cited span).
    raw_by_doc: dict[int, str] = {}

    def span_source(h: dict[str, Any]) -> dict[str, Any]:
        doc_id = h["document_id"]
        if doc_id not in raw_by_doc:
            doc = store.get_document(con, doc_id)
            raw_by_doc[doc_id] = doc["raw_text"] if doc else ""
        raw = raw_by_doc[doc_id]
        s, e = h["start_char"], h["end_char"]
        return {
            "filename": h["filename"], "date": h["date"],
            "start_char": s, "end_char": e, "text": h["text"],
            "context_before": raw[max(0, s - context):s],
            "context_after": raw[e:e + context],
        }

    # Numbered passages: source spans first, then captured reasons.
    n_spans = len(span_hits)
    lines = [f"[{i}] (source: {h['filename']}) {_norm(h['text'])}" for i, h in enumerate(span_hits, 1)]
    lines += [f"[{n_spans + j}] (captured reason, recorded by the scientist) {_norm(r['statement'])}"
              for j, r in enumerate(rationales, 1)]
    prompt = _ASSEMBLY_TEMPLATE.format(claim=claim, passages="\n".join(lines))
    result = router.reason(prompt, system=_ASSEMBLY_SYSTEM, max_tokens=900, temperature=0.0)

    try:
        data = _parse_json(result.text)
    except (ValueError, json.JSONDecodeError):
        data = {"sufficient": False, "claims": []}

    def insufficient() -> dict[str, Any]:
        return {"claim": claim, "sufficient": False,
                "message": "insufficient evidence in the record",
                "backend": result.backend, "model": result.model, "answer": []}

    if not data.get("sufficient") or not data.get("claims"):
        return insufficient()

    total = n_spans + len(rationales)
    answer = []
    cited_files: set[str] = set()
    for c in data["claims"]:
        cites = [i for i in c.get("cites", []) if isinstance(i, int) and 1 <= i <= total]
        sources = [span_source(span_hits[i - 1]) if i <= n_spans
                   else _rationale_source(rationales[i - 1 - n_spans]) for i in cites]
        for src in sources:
            cited_files.add(src["filename"])
        text = str(c.get("text", "")).strip()
        if text and sources:  # drop any uncited claim — provenance-always
            answer.append({"text": text, "sources": sources})

    if not answer:
        return insufficient()

    return {
        "claim": claim, "sufficient": True,
        "backend": result.backend, "model": result.model,
        "source_count": len(cited_files), "answer": answer,
    }
