"""Rhinalx FastAPI application.

Phase 0: app shell + /health.
Phase 1: read-only views over the span-preserving store, and the provenance
round-trip endpoint — given a claim, return the exact source file + character
span it rests on. Every result carries its provenance; nothing is asserted
without a citable span.
"""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend import extract, ingest
from backend.config import settings
from backend.connectors import protocols_io
from backend.inference import router as inference_router
from backend.memory import consolidate, deviation, interview, precedent, retrieve, store

# Episode kinds whose "why" a proactive interview can chase (mirrors interview.py).
_DECISION_KINDS = {"dose_change", "reagent_swap", "protocol_change", "decision", "exclusion"}
_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

app = FastAPI(title="Rhinalx API", version="0.1.0")

# The Vite dev server (5173) calls this API cross-origin during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _con() -> sqlite3.Connection:
    """Open a store connection, creating an empty schema if needed.

    An empty store is a valid state now: a real user starts blank and uploads their
    own sources via /ingest. Read endpoints return empty results; search endpoints
    refuse ("no sources ingested yet") until the vector index exists.
    """
    con = store.connect(settings.db_path)
    store.ensure_schema(con)
    return con


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe. Returns ok when the API is up."""
    return {"status": "ok", "service": "rhinalx"}


@app.get("/stats")
def stats() -> dict[str, Any]:
    con = _con()
    try:
        return {"seeded": True, **store.counts(con)}
    finally:
        con.close()


def _derive_study_name(latest_protocol: dict[str, Any] | None) -> str:
    """A short study label derived from the latest protocol's filename + title."""
    if not latest_protocol:
        return "Untitled study"
    stem = latest_protocol["filename"].rsplit(".", 1)[0]
    stem = re.sub(r"(?i)^protocol[_-]", "", stem)
    stem = re.sub(r"(?i)[_-]v\d+$", "", stem)
    base = stem.replace("_", " ").strip() or "Study"
    title = latest_protocol.get("title") or ""
    return f"{base} / PVO study" if re.search(r"\bPVO\b", title) else f"{base} study"


@app.get("/study")
def study() -> dict[str, Any]:
    """Study identity + counts, all derived from the ingested record (no hardcoding)."""
    con = _con()
    try:
        docs = store.list_documents(con)
        protocols = [d for d in docs if d.get("doc_type") == "protocol"]
        latest = max(protocols, key=lambda d: d.get("version") or 0) if protocols else None
        rationales = store.list_rationales(con)
        c = store.counts(con)
        return {
            "name": _derive_study_name(latest),
            "version": latest.get("version") if latest else None,
            "title": latest.get("title") if latest else None,
            "counts": {
                "documents": c["documents"],
                "decisions": c["episodes"],
                "current_rationale": sum(1 for r in rationales if r["status"] == "current"),
                "archived_rationale": sum(1 for r in rationales if r["status"] == "archived"),
                "open_questions": c["open_questions"],
            },
        }
    finally:
        con.close()


@app.get("/documents")
def documents() -> dict[str, Any]:
    con = _con()
    try:
        return {"documents": store.list_documents(con)}
    finally:
        con.close()


@app.get("/documents/{doc_id}")
def document(doc_id: int) -> dict[str, Any]:
    con = _con()
    try:
        doc = store.get_document(con, doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail=f"No document {doc_id}")
        doc["spans"] = store.spans_for_document(con, doc_id)
        doc["episodes"] = store.episodes_for_document(con, doc_id)
        return doc
    finally:
        con.close()


@app.get("/episodes")
def episodes() -> dict[str, Any]:
    con = _con()
    try:
        return {"episodes": store.list_episodes(con)}
    finally:
        con.close()


@app.get("/episodes/{episode_id}")
def episode(episode_id: int) -> dict[str, Any]:
    con = _con()
    try:
        ep = store.get_episode(con, episode_id)
        if not ep:
            raise HTTPException(status_code=404, detail=f"No episode {episode_id}")
        return ep
    finally:
        con.close()


@app.get("/config")
def config() -> dict[str, Any]:
    """Non-secret runtime config for the Settings screen + backend indicator."""
    return {
        "policy": inference_router.current_policy(),
        "model": settings.model,
        "embed_model": settings.embed_model,
        "local_llm_model": settings.local_llm_model,
        "ollama_host": settings.ollama_host,
        "claude_available": bool(settings.anthropic_api_key),
        "protocolsio_available": bool(settings.protocolsio_token),
        "db_file": settings.db_path.name,
    }


class ProjectBody(BaseModel):
    name: str
    description: str | None = None


@app.get("/projects")
def projects() -> dict[str, Any]:
    con = _con()
    try:
        return {"projects": store.list_projects(con), "active_project_id": store.active_project_id(con)}
    finally:
        con.close()


@app.post("/projects")
def create_project(body: ProjectBody) -> dict[str, Any]:
    con = _con()
    try:
        try:
            pid = store.create_project(con, body.name, body.description)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"project": store.set_active_project(con, pid), "active_project_id": pid}
    finally:
        con.close()


@app.post("/projects/{project_id}/activate")
def activate_project(project_id: int) -> dict[str, Any]:
    con = _con()
    try:
        try:
            project = store.set_active_project(con, project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {"project": project, "active_project_id": project_id}
    finally:
        con.close()


class PolicyBody(BaseModel):
    policy: str


@app.post("/policy")
def set_policy(body: PolicyBody) -> dict[str, Any]:
    """Switch the reasoning backend live: 'claude' (when a key is present) or 'local'."""
    try:
        policy = inference_router.set_policy(body.policy)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"policy": policy, "claude_available": bool(settings.anthropic_api_key)}


@app.get("/open-questions")
def open_questions(status: str = Query("open")) -> dict[str, Any]:
    """Rationale gaps the agent found — the Open Questions inbox (Beat 1)."""
    con = _con()
    try:
        return {"open_questions": store.list_open_questions(con, status=status)}
    finally:
        con.close()


class AnswerBody(BaseModel):
    answer: str


@app.post("/open-questions/{oq_id}/answer")
def answer_open_question(oq_id: int, body: AnswerBody) -> dict[str, Any]:
    """Capture the scientist's answer as a ConsolidatedRationale (provenance = them)."""
    con = _con()
    try:
        rationale = interview.answer_open_question(con, oq_id, body.answer)
        return {"filed": True, "rationale": rationale}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        con.close()


@app.post("/detect-gaps")
def detect_gaps() -> dict[str, Any]:
    """Re-run gap detection over all decision episodes (admin / demo reset)."""
    con = _con()
    try:
        return interview.detect_gaps(con)
    finally:
        con.close()


class IngestBody(BaseModel):
    filename: str = "note.md"
    content: str
    doc_type: str | None = None
    title: str | None = None
    date: str | None = None
    author: str | None = None


def _ingest_and_interview(con: sqlite3.Connection, filename: str, content: str, *,
                          doc_type: str | None = None, title: str | None = None,
                          date: str | None = None, author: str | None = None) -> dict[str, Any]:
    """Ingest text, then proactively interview: each new decision missing a rationale
    raises an Open Question on the spot. Shared by the JSON and file endpoints."""
    result = ingest.ingest_text(
        con, filename, content, doc_type=doc_type, title=title, date=date, author=author,
    )
    raised = []
    for ep_id in result["episode_ids"]:
        ep = store.get_episode(con, ep_id)
        if not ep or ep["kind"] not in _DECISION_KINDS:
            continue
        outcome = interview.detect_gap_for_episode(con, ep)
        if not outcome["has_rationale"] and outcome["question"]:
            oq_id = store.insert_open_question(
                con, episode_id=ep_id, prompt=outcome["question"],
                detected_backend=outcome["backend"],
            )
            raised.append({
                "open_question_id": oq_id, "episode": ep["summary"],
                "prompt": outcome["question"], "backend": outcome["backend"],
            })
    return {
        **result,
        "new_open_questions": raised,
        "episodes_detail": [store.get_episode(con, i) for i in result["episode_ids"]],
    }


@app.post("/ingest")
def ingest_route(body: IngestBody) -> dict[str, Any]:
    """Ingest a pasted note (JSON) in real time, span-preserving, with live interview."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="empty document")
    con = _con()
    try:
        return _ingest_and_interview(
            con, body.filename or "note.md", body.content,
            doc_type=body.doc_type, title=body.title, date=body.date, author=body.author,
        )
    finally:
        con.close()


@app.post("/ingest/file")
async def ingest_file_route(file: UploadFile = File(...)) -> dict[str, Any]:
    """Ingest an uploaded document (PDF, DOCX, CSV, TXT, MD, ...).

    Text is extracted server-side by file type, then run through the same
    span-preserving, provenance-exact pipeline as a pasted note.
    """
    data = await file.read()
    filename = file.filename or "upload"
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file is larger than the 25 MB local ingest limit")
    try:
        content = extract.extract_text(filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # malformed/corrupt file
        raise HTTPException(status_code=422, detail=f"could not read {filename}: {exc}") from exc
    if not content.strip():
        raise HTTPException(
            status_code=422,
            detail=f"no extractable text in {filename}. If this is a scanned PDF or image, run OCR first, then upload the OCR text or searchable PDF.",
        )
    con = _con()
    try:
        return _ingest_and_interview(con, filename, content)
    finally:
        con.close()


@app.post("/reset")
def reset_route() -> dict[str, Any]:
    """Empty this machine's live memory so you can ingest your own sources.

    This clears the local DB only; the sample dataset files on disk are untouched
    and can always be re-seeded with scripts/seed.py.
    """
    store.reset_db(settings.db_path)
    con = _con()
    try:
        return {"reset": True, **store.counts(con)}
    finally:
        con.close()


def _canonical_from_input(canonical: dict | None, canonical_text: str | None,
                          doi: str | None, version: str | None, title: str | None) -> dict[str, Any]:
    c: dict[str, Any] = dict(canonical) if isinstance(canonical, dict) else {}
    if canonical_text and not c.get("steps"):
        txt = canonical_text.strip()
        try:
            parsed = json.loads(txt)
            if isinstance(parsed, dict):
                c = {**parsed, **c}
            elif isinstance(parsed, list):
                c["steps"] = parsed
        except json.JSONDecodeError:
            c["steps"] = [{"step": str(i + 1), "text": ln.strip()}
                          for i, ln in enumerate(txt.splitlines()) if ln.strip()]
    if doi:
        c.setdefault("doi", doi)
    if version:
        c.setdefault("version", version)
    if title:
        c.setdefault("title", title)
    return c


class DeviationBody(BaseModel):
    canonical: dict | None = None
    canonical_text: str | None = None
    doi: str | None = None
    version: str | None = None
    title: str | None = None


@app.post("/deviation/detect")
def deviation_detect(body: DeviationBody) -> dict[str, Any]:
    """Deviation-diff: compare a pasted/uploaded canonical protocol against the
    ingested execution corpus; file an Open Question for each material, unexplained
    departure. The protocols.io reference frame, no network required."""
    canonical = _canonical_from_input(body.canonical, body.canonical_text,
                                      body.doi, body.version, body.title)
    if not canonical.get("steps"):
        raise HTTPException(status_code=400,
                            detail="provide a canonical protocol (steps as JSON, or paste the method text)")
    con = _con()
    try:
        if store.embed_dim(con) is None:
            return {"canonical_source": {"doi": canonical.get("doi"), "version": canonical.get("version")},
                    "deviations": [], "filed": [], "message": "ingest your execution record first"}
        detection = deviation.detect_deviations(con, canonical)
        filed = deviation.file_deviations(con, detection)
        return {**detection, "filed": filed}
    finally:
        con.close()


class ProtocolRefBody(BaseModel):
    ref: str


@app.post("/deviation/from-protocolsio")
def deviation_from_protocolsio(body: ProtocolRefBody) -> dict[str, Any]:
    """Live protocols.io path: fetch a protocol by id/DOI/URL (token-gated), then run
    the same deviation-diff against the ingested corpus."""
    try:
        canonical = protocols_io.fetch_protocol(body.ref)
    except protocols_io.ProtocolsIoError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    con = _con()
    try:
        if store.embed_dim(con) is None:
            return {"canonical": canonical,
                    "canonical_source": {"doi": canonical.get("doi"), "version": canonical.get("version")},
                    "deviations": [], "filed": [], "message": "ingest your execution record first"}
        detection = deviation.detect_deviations(con, canonical)
        filed = deviation.file_deviations(con, detection)
        return {"canonical": canonical, **detection, "filed": filed}
    finally:
        con.close()


@app.get("/rationales")
def rationales(status: str | None = Query(None)) -> dict[str, Any]:
    con = _con()
    try:
        return {"rationales": store.list_rationales(con, status=status)}
    finally:
        con.close()


@app.post("/consolidate")
def consolidate_route() -> dict[str, Any]:
    """Rebuild the semantic layer (episodic -> consolidated) + archive superseded (admin)."""
    con = _con()
    try:
        return consolidate.run_consolidation(con)
    finally:
        con.close()


@app.get("/precedent")
def precedent_route(episode_id: int | None = Query(None)) -> dict[str, Any]:
    """Beat 3: find a prior decision that resembles the current one, Claude-explained."""
    con = _con()
    try:
        if store.embed_dim(con) is None:
            return {"found": False, "message": "no sources ingested yet"}
        return precedent.find_precedent(con, episode_id=episode_id)
    finally:
        con.close()


@app.get("/ask")
def ask(
    q: str = Query(..., min_length=3, description="A 'why did we…' question about a decision"),
    k: int = Query(8, ge=1, le=12),
) -> dict[str, Any]:
    """Beat 2: reconstruct a cited 'why' narrative across the record (or refuse)."""
    con = _con()
    try:
        if store.embed_dim(con) is None:
            return {"claim": q, "sufficient": False,
                    "message": "no sources ingested yet", "answer": []}
        return retrieve.reconstruct(con, q, k=k)
    finally:
        con.close()


@app.get("/provenance")
def provenance(
    claim: str = Query(..., min_length=3, description="A claim/question to ground in sources"),
    k: int = Query(3, ge=1, le=10),
    context: int = Query(80, ge=0, le=400, description="Chars of surrounding context per span"),
) -> dict[str, Any]:
    """Provenance round-trip: return the exact source spans a claim rests on.

    Embeds the claim locally, finds the nearest indexed source spans, and returns
    each with its source file, exact char offsets, verbatim text, and surrounding
    context. If nothing is indexed, it refuses rather than guesses.
    """
    con = _con()
    try:
        if store.embed_dim(con) is None:
            return {"claim": claim, "sufficient": False,
                    "message": "no sources ingested yet", "results": []}
        query_vec = inference_router.embed([claim])[0]
        hits = store.search_spans(con, query_vec, k=k)

        if not hits:
            return {
                "claim": claim,
                "sufficient": False,
                "message": "insufficient evidence in the record",
                "results": [],
            }

        # Attach surrounding context from each source document's raw_text.
        raw_by_doc: dict[int, str] = {}
        results = []
        for h in hits:
            doc_id = h["document_id"]
            if doc_id not in raw_by_doc:
                doc = store.get_document(con, doc_id)
                raw_by_doc[doc_id] = doc["raw_text"] if doc else ""
            raw = raw_by_doc[doc_id]
            s, e = h["start_char"], h["end_char"]
            results.append({
                "filename": h["filename"],
                "doc_type": h["doc_type"],
                "title": h["title"],
                "date": h["date"],
                "start_char": s,
                "end_char": e,
                "text": h["text"],
                "context_before": raw[max(0, s - context):s],
                "context_after": raw[e:e + context],
                "distance": round(h["distance"], 4),
                # Provenance is structural: this must equal the stored raw_text slice.
                "exact": raw[s:e] == h["text"],
            })
        return {
            "claim": claim,
            "sufficient": True,
            "backend": "local",
            "model": settings.embed_model,
            "results": results,
        }
    finally:
        con.close()
