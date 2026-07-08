"""Deviation-diff gap detection - the protocols.io reference frame.

A second reference frame for the interview engine. The inward scan (interview.py)
finds decisions with no baseline at all. This compares a CANONICAL protocol (the
field-standard method, e.g. anchored to a protocols.io DOI) against what the lab
ACTUALLY did (its ingested execution record + rationale notes), and surfaces
MATERIAL, UNEXPLAINED departures as interview triggers.

Two design decisions carry the whole feature:

  * Materiality gate - a diff finds dozens of divergences; most are noise (vendor,
    rounding). Only deviations that plausibly change the readout proceed. This is
    what prevents alert fatigue.
  * Sufficiency, not presence - "we reduced the dose to 3 mg/kg" is a DESCRIPTION of
    what changed, not a REASON for it. A restatement still counts as a gap. This is
    the "catch that looked filled" - the sharpest moment in the product.

Read-only, inbound: canonical steps flow in; the local corpus never leaves. The
canonical side is cited by DOI/version/step; the execution side stays provenance-
exact (the observed value is grounded in a verbatim span of a source document).
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from backend import ingest
from backend.inference import router
from backend.memory import store

_SYSTEM = (
    "You are the deviation-diff engine inside Rhinalx, a local-first research "
    "rationale memory system. You compare a CANONICAL protocol (the field-standard "
    "method) against a lab's ACTUAL execution and notes, and surface MATERIAL "
    "deviations that have no recorded REASON, so the scientist can be interviewed to "
    "capture the missing 'why'.\n\n"
    "For each genuine deviation between the corpus and the canonical protocol:\n"
    "1. TYPE: one of PARAMETER_CHANGE, SUBSTITUTION, STEP_SKIPPED, STEP_ADDED, ORDER_CHANGE.\n"
    "2. MATERIALITY (high|medium|low): does the deviation plausibly change the "
    "BIOLOGICAL readout or a reader's ability to reproduce the result?\n"
    "   - LOW (do NOT fire, even if unexplained): reagent vendor/catalog, tube or "
    "plate brand, rounding of volumes, and routine bench-technique durations such as "
    "vortex/mixing/pipetting time and brief spins.\n"
    "   - HIGH: drug or agent DOSE, dosing schedule, animal strain/age/sex, "
    "model-defining reagents or antibodies, sample size (n), and skipped controls.\n"
    "   - MEDIUM: genuinely ambiguous cases that could go either way.\n"
    "   Do not inflate a routine bench-technique difference to medium.\n"
    "3. RATIONALE SUFFICIENCY in the corpus: distinguish a REASON (why the choice was "
    "made) from a DESCRIPTION (a restatement of what changed). A description alone is "
    "NOT sufficient. status is one of: explained | partial | unexplained.\n"
    "4. INTERVIEW_NEEDED = (unexplained OR partial) AND materiality is high or medium.\n"
    "5. For every observed value you MUST copy a short VERBATIM quote from the corpus "
    "(observed.quote), character for character, so it can be located and cited. Never "
    "invent an observation. If the lab followed a step as written, omit that step.\n"
    "6. If interview needed, write ONE grounded question that names the canonical "
    "source (DOI, version, step), states BOTH values, and asks for the reason. If the "
    "corpus already gives a genuine reason, set explained and do NOT ask.\n"
    "7. The canonical excerpt may be PARTIAL. Do NOT flag a lab step merely because "
    "the excerpt does not mention it. Only report STEP_ADDED when the lab step "
    "conflicts with or replaces a canonical step, and STEP_SKIPPED when a canonical "
    "step that IS in the excerpt was clearly omitted.\n\n"
    "Never invent a rationale. The absence of a reason IS the finding. "
    "Output ONLY a JSON array, no prose and no markdown fences."
)

_TEMPLATE = """CANONICAL_PROTOCOL (field-standard method; DOI {doi}, version {version}):
{canonical}

CORPUS (the lab's actual execution record AND its rationale notes - treat as both):
{corpus}

Return a JSON array. Each element:
{{
  "type": "PARAMETER_CHANGE|SUBSTITUTION|STEP_SKIPPED|STEP_ADDED|ORDER_CHANGE",
  "field": "<short label, e.g. LPS dose>",
  "canonical": {{"step": "<id>", "value": "<canonical value>", "text": "<verbatim canonical line>"}},
  "observed": {{"value": "<lab value>", "quote": "<verbatim text copied from the corpus>", "source": "<corpus filename>", "scope": "<e.g. aged cohort, or null>"}},
  "materiality": "high|medium|low",
  "rationale_status": "explained|partial|unexplained",
  "interview_needed": true or false,
  "interview_question": "<the grounded question if interview_needed, else null>"
}}
Include only genuine deviations. Omit steps the lab followed as written."""


def _canonical_text(canonical: dict[str, Any]) -> str:
    steps = canonical.get("steps") if isinstance(canonical, dict) else None
    return json.dumps(steps if steps is not None else canonical, ensure_ascii=False, indent=2)[:8000]


def _corpus(con: sqlite3.Connection) -> tuple[str, dict[str, int]]:
    """The lab's ingested documents as one text block; also a filename -> id map."""
    parts: list[str] = []
    fn_to_id: dict[str, int] = {}
    for d in store.list_documents(con):
        full = store.get_document(con, d["id"])
        raw = (full["raw_text"] if full else "").strip()
        fn_to_id[d["filename"]] = d["id"]
        parts.append(f"### {d['filename']}\n{raw[:2000]}")
    return "\n\n".join(parts), fn_to_id


def detect_deviations(con: sqlite3.Connection, canonical: dict[str, Any]) -> dict[str, Any]:
    """Diff the canonical protocol against the ingested corpus (does not write)."""
    corpus, fn_to_id = _corpus(con)
    doi = canonical.get("doi") or "unknown"
    version = str(canonical.get("version") or "unversioned")
    source = {"doi": doi, "version": version, "title": canonical.get("title")}
    if not corpus.strip():
        return {"backend": None, "canonical_source": source, "deviations": [],
                "message": "no execution corpus ingested yet"}

    prompt = _TEMPLATE.format(doi=doi, version=version,
                             canonical=_canonical_text(canonical), corpus=corpus)
    result = router.reason(prompt, system=_SYSTEM, max_tokens=1800, temperature=0.0)
    try:
        items = ingest._parse_json_array(result.text)
    except (ValueError, json.JSONDecodeError):
        items = []

    id_to_fn = {v: k for k, v in fn_to_id.items()}
    deviations: list[dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        obs = it.get("observed") or {}
        quote = (obs.get("quote") or "").strip()
        # Ground the observed value in a verbatim span: check the named source first,
        # then any document. Provenance is exact on the lab side, or we don't cite it.
        located = None
        candidate_ids = []
        named = fn_to_id.get(obs.get("source"))
        if named is not None:
            candidate_ids.append(named)
        candidate_ids += [i for i in fn_to_id.values() if i != named]
        if quote:
            for did in candidate_ids:
                full = store.get_document(con, did)
                raw = full["raw_text"] if full else ""
                loc = ingest._locate(raw, quote)
                if loc:
                    located = {"document_id": did, "start": loc[0], "end": loc[1],
                               "text": raw[loc[0]:loc[1]], "filename": id_to_fn.get(did)}
                    break
        it["grounded"] = located is not None
        if located:
            it.setdefault("observed", {})["span"] = located
        deviations.append(it)

    return {"backend": result.backend, "canonical_source": source, "deviations": deviations}


def file_deviations(con: sqlite3.Connection, detection: dict[str, Any]) -> list[dict[str, Any]]:
    """Turn each material, unexplained deviation into a deviation episode + Open
    Question, so it lands in the same inbox as the inward scan. Only grounded
    deviations (with an exact lab-side span) are filed."""
    src = detection["canonical_source"]
    filed: list[dict[str, Any]] = []
    for d in detection["deviations"]:
        if not d.get("interview_needed"):
            continue
        span = (d.get("observed") or {}).get("span")
        if not span:
            continue  # no exact lab-side citation -> we don't assert it
        field = d.get("field") or "protocol step"
        cval = (d.get("canonical") or {}).get("value")
        oval = (d.get("observed") or {}).get("value")
        summary = f"Deviation from {src['doi']} {src['version']}: {field} {cval} -> {oval}"
        ep_id = store.insert_episode(
            con, document_id=span["document_id"], kind="deviation", summary=summary,
            what_changed=span["text"], actor=None, date=None, status="current",
            record_id=src.get("doi"),
        )
        store.insert_episode_span(
            con, episode_id=ep_id, document_id=span["document_id"],
            start=span["start"], end=span["end"], text=span["text"], role="observed",
        )
        oq_id = store.insert_open_question(
            con, episode_id=ep_id, prompt=d.get("interview_question") or summary,
            detected_backend=detection.get("backend"),
        )
        filed.append({
            "open_question_id": oq_id, "episode_id": ep_id, "summary": summary,
            "materiality": d.get("materiality"), "rationale_status": d.get("rationale_status"),
        })
    con.commit()
    return filed
