"""Rhinalx MCP server — the lab's rationale memory, exposed as tools.

This is the agentic surface: instead of Rhinalx making one Claude call per feature,
it hands Claude (in Claude Desktop, Claude Code, or any MCP client) a set of memory
tools and lets *Claude* decide how to use them — list the decisions, reconstruct a
"why", surface a precedent, find the open gaps, and even file a missing rationale or
ingest a new note. Claude becomes the agent operating over the lab's memory.

Every answer stays provenance-bound: tools return the exact source spans a claim
rests on, and the engine refuses ("insufficient evidence in the record") rather than
guess — the same contract as the app.

Run (stdio):
    uv run python -m backend.mcp_server.server

Register in Claude Desktop (claude_desktop_config.json):
    {
      "mcpServers": {
        "rhinalx": {
          "command": "uv",
          "args": ["run", "python", "-m", "backend.mcp_server.server"],
          "cwd": "<absolute path to this repo>"
        }
      }
    }
"""
from __future__ import annotations

import contextlib
import json
import sqlite3
from typing import Any, Iterator

from mcp.server.fastmcp import FastMCP

from backend import ingest as ingest_mod
from backend.config import settings
from backend.inference import router as inference_router
from backend.memory import deviation, interview, precedent, retrieve, store

mcp = FastMCP(
    "rhinalx",
    instructions=(
        "Rhinalx is the rationale memory for a bench-science study: it remembers WHY "
        "research decisions were made, every claim cited to a source span. Use "
        "why_was_decided to reconstruct the reasoning behind a decision, find_precedent "
        "to check whether something was tried or ruled out before, list_open_questions "
        "to see decisions the lab recorded with no reason, and answer_open_question to "
        "capture the reason from the scientist. Never assert a rationale the tools do "
        "not return; if a tool reports insufficient evidence, say so."
    ),
)


@contextlib.contextmanager
def _con() -> Iterator[sqlite3.Connection]:
    con = store.connect(settings.db_path)
    store.ensure_schema(con)
    try:
        yield con
    finally:
        con.close()


def _indexed(con: sqlite3.Connection) -> bool:
    return store.embed_dim(con) is not None


@mcp.tool()
def study_overview() -> dict[str, Any]:
    """Summarize the current study: its counts of sources, decisions, rationale, and
    unanswered rationale gaps. Call this first to see what memory is available."""
    with _con() as con:
        docs = store.list_documents(con)
        protocols = [d for d in docs if d.get("doc_type") == "protocol"]
        latest = max(protocols, key=lambda d: d.get("version") or 0) if protocols else None
        c = store.counts(con)
        rationales = store.list_rationales(con)
        return {
            "title": latest.get("title") if latest else None,
            "protocol_version": latest.get("version") if latest else None,
            "sources": c["documents"],
            "decisions": c["episodes"],
            "current_rationale": sum(1 for r in rationales if r["status"] == "current"),
            "archived_rationale": sum(1 for r in rationales if r["status"] == "archived"),
            "open_questions": c["open_questions"],
        }


@mcp.tool()
def list_decisions() -> list[dict[str, Any]]:
    """List every decision (episode) captured in the study's memory, with the source
    file and date. Use the returned `id` with find_precedent."""
    with _con() as con:
        return [
            {
                "id": e["id"], "kind": e["kind"], "summary": e["summary"],
                "date": e.get("date"), "source": e.get("filename"),
                "status": e.get("status"),
            }
            for e in store.list_episodes(con)
        ]


@mcp.tool()
def why_was_decided(question: str) -> dict[str, Any]:
    """Reconstruct the reasoning behind a decision from across the record, with every
    claim cited to its exact source span. Ask in natural language, e.g.
    "Why did we drop the LPS dose in cohort 3?". Refuses if the record is insufficient."""
    with _con() as con:
        if not _indexed(con):
            return {"sufficient": False, "message": "no sources ingested yet"}
        return retrieve.reconstruct(con, question, k=8)


@mcp.tool()
def find_precedent(decision_id: int | None = None) -> dict[str, Any]:
    """Check whether a decision resembles an earlier one — so the lab does not repeat a
    dead end or re-litigate a settled call. Pass a decision id from list_decisions, or
    omit it to analyze the most recent exclusion. Returns the prior case, a similarity
    score, and a Claude-written explanation of the resemblance."""
    with _con() as con:
        if not _indexed(con):
            return {"found": False, "message": "no sources ingested yet"}
        return precedent.find_precedent(con, episode_id=decision_id)


@mcp.tool()
def list_open_questions() -> list[dict[str, Any]]:
    """List decisions the lab recorded with NO reason — the rationale gaps Rhinalx
    detected. Each has an `id` you can answer with answer_open_question."""
    with _con() as con:
        return [
            {
                "id": q["id"], "prompt": q["prompt"],
                "decision": q.get("episode_summary"), "source": q.get("filename"),
                "detected_by": q.get("detected_backend"),
            }
            for q in store.list_open_questions(con, status="open")
        ]


@mcp.tool()
def answer_open_question(open_question_id: int, answer: str) -> dict[str, Any]:
    """File the scientist's reason for a decision that was missing one. The answer is
    stored as rationale whose provenance is the scientist's own words, and the question
    is marked answered. Only call this with a reason the scientist actually gave."""
    with _con() as con:
        try:
            rationale = interview.answer_open_question(con, open_question_id, answer)
        except KeyError:
            return {"filed": False, "error": f"no open question {open_question_id}"}
        except ValueError as exc:
            return {"filed": False, "error": str(exc)}
        return {"filed": True, "rationale": rationale}


@mcp.tool()
def ground_claim(claim: str, k: int = 3) -> dict[str, Any]:
    """Return the exact source spans a claim rests on: source file, char offsets, and
    verbatim text. Use to verify any statement against the record. Refuses if nothing
    in the corpus supports it."""
    with _con() as con:
        if not _indexed(con):
            return {"sufficient": False, "message": "no sources ingested yet", "results": []}
        vec = inference_router.embed([claim])[0]
        hits = store.search_spans(con, vec, k=k)
        if not hits:
            return {"sufficient": False, "message": "insufficient evidence in the record", "results": []}
        raw_by_doc: dict[int, str] = {}
        out = []
        for h in hits:
            doc_id = h["document_id"]
            if doc_id not in raw_by_doc:
                d = store.get_document(con, doc_id)
                raw_by_doc[doc_id] = d["raw_text"] if d else ""
            raw = raw_by_doc[doc_id]
            s, e = h["start_char"], h["end_char"]
            out.append({
                "source": h["filename"], "start_char": s, "end_char": e,
                "text": h["text"], "exact": raw[s:e] == h["text"],
                "distance": round(h["distance"], 4),
            })
        return {"sufficient": True, "results": out}


@mcp.tool()
def ingest_note(content: str, filename: str = "note.md") -> dict[str, Any]:
    """Add a new note or document to the lab's memory in real time. Extracts the
    decisions inside (each grounded verbatim) and reports any decision that arrives
    without a reason as a new open question."""
    if not content.strip():
        return {"error": "empty document"}
    with _con() as con:
        result = ingest_mod.ingest_text(con, filename, content)
        raised = []
        for ep_id in result["episode_ids"]:
            ep = store.get_episode(con, ep_id)
            if not ep or ep["kind"] not in interview._DECISION_KINDS:
                continue
            outcome = interview.detect_gap_for_episode(con, ep)
            if not outcome["has_rationale"] and outcome["question"]:
                store.insert_open_question(
                    con, episode_id=ep_id, prompt=outcome["question"],
                    detected_backend=outcome["backend"],
                )
                raised.append(outcome["question"])
        return {
            "ingested": filename,
            "decisions_extracted": result["episodes"],
            "decisions": [store.get_episode(con, i)["summary"] for i in result["episode_ids"]],
            "new_open_questions": raised,
        }


@mcp.tool()
def check_deviations(canonical_json: str) -> dict[str, Any]:
    """Compare a CANONICAL protocol (the field-standard method, e.g. from protocols.io)
    against the lab's ingested execution record, and surface MATERIAL deviations that
    have no recorded reason. Pass the canonical as JSON: {"steps": [{"step","text"}],
    "doi": "...", "version": "..."}. Files an Open Question for each material,
    unexplained departure and returns the full typed diff (including the ones it
    stayed silent on and why)."""
    try:
        canonical = json.loads(canonical_json)
    except (json.JSONDecodeError, TypeError):
        return {"error": "canonical_json must be valid JSON with a 'steps' list"}
    if not isinstance(canonical, dict) or not canonical.get("steps"):
        return {"error": "provide {\"steps\": [{\"step\", \"text\"}], \"doi\"?, \"version\"?}"}
    with _con() as con:
        if not _indexed(con):
            return {"deviations": [], "message": "ingest your execution record first"}
        det = deviation.detect_deviations(con, canonical)
        filed = deviation.file_deviations(con, det)
        return {
            "canonical_source": det["canonical_source"],
            "deviations": [
                {
                    "field": d.get("field"), "type": d.get("type"),
                    "canonical": (d.get("canonical") or {}).get("value"),
                    "observed": (d.get("observed") or {}).get("value"),
                    "materiality": d.get("materiality"),
                    "rationale_status": d.get("rationale_status"),
                    "interview_needed": d.get("interview_needed"),
                }
                for d in det["deviations"]
            ],
            "questions_raised": [f["summary"] for f in filed],
        }


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
