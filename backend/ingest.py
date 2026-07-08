"""Document ingest + episode extraction, span-preserving.

Pipeline per file:
  1. Parse YAML front-matter + body. Store the full raw_text immutably.
  2. Compute HTML-comment char ranges and EXCLUDE them from everything indexed —
     the sample files contain `<!-- NOTE (designed demo ...) -->` hints that would
     otherwise let gap detection cheat. They stay in raw_text (faithful source)
     but never enter a span or the index.
  3. Split the body into paragraph blocks, each carrying exact (start,end) offsets
     into raw_text — these are the indexable source spans.
  4. Extract decision episodes deterministically. Every episode's evidence span is
     located verbatim in raw_text, so we never fabricate an offset, actor, or change.

Offsets are indices into the stored raw_text, so raw_text[start:end] == span text.
"""
from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from backend.inference import router
from backend.memory import store

# --- parsing helpers --------------------------------------------------------

_FRONTMATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
_BOLD = re.compile(r"\*\*(.+?)\*\*", re.DOTALL)

# Verbs that mark a change/decision worth capturing as an episode.
_CHANGE_VERB = re.compile(
    r"\b(switch(?:ed)?|chang(?:ed)?|reduc(?:e|ed)?|increas(?:e|ed)?|"
    r"decreas(?:e|ed)?|add(?:ed)?|remov(?:e|ed)?|lower(?:ed)?|"
    r"drop(?:ped)?|rais(?:ed)?)\b",
    re.IGNORECASE,
)


def _clean(text: str) -> str:
    """Human-readable summary: drop bold markers, list bullets, Decision: prefix."""
    t = _BOLD.sub(r"\1", text)
    t = re.sub(r"^\s*[-*]\s+", "", t)
    t = re.sub(r"(?i)^\s*decision:\s*", "", t)
    return re.sub(r"\s+", " ", t).strip()


@dataclass
class ParsedDoc:
    filename: str
    frontmatter: dict[str, Any]
    doc_type: str | None
    title: str | None
    version: int | None
    status: str | None
    supersedes: int | None
    author: str | None
    date: str | None
    protocol_version: int | None
    record_id: str | None
    raw_text: str
    body_start: int
    blocks: list[tuple[int, int, str]]
    episodes: list[dict[str, Any]] = field(default_factory=list)


def _excluded_ranges(raw: str) -> list[tuple[int, int]]:
    return [(m.start(), m.end()) for m in _COMMENT.finditer(raw)]


def _in_excluded(start: int, end: int, excluded: list[tuple[int, int]]) -> bool:
    return any(start < ex_end and end > ex_start for ex_start, ex_end in excluded)


def _physical_lines(raw: str, body_start: int, excluded: list[tuple[int, int]]):
    """Yield (start, end, text) for each body line, skipping comment lines.

    `end` is exclusive of the trailing newline. Blank lines are yielded (text='').
    """
    pos = body_start
    n = len(raw)
    while pos < n:
        nl = raw.find("\n", pos)
        end = n if nl == -1 else nl
        if not _in_excluded(pos, end, excluded):
            yield pos, end, raw[pos:end]
        pos = end + 1
        if nl == -1:
            break


def _block_spans(raw: str, body_start: int, excluded: list[tuple[int, int]]) -> list[tuple[int, int, str]]:
    """Group consecutive non-blank body lines into paragraph blocks with offsets."""
    blocks: list[tuple[int, int, str]] = []
    cur_start: int | None = None
    cur_end: int | None = None
    for s, e, t in _physical_lines(raw, body_start, excluded):
        if t.strip() == "":
            if cur_start is not None:
                blocks.append((cur_start, cur_end, raw[cur_start:cur_end]))
                cur_start = cur_end = None
        else:
            if cur_start is None:
                cur_start = s
            cur_end = e
    if cur_start is not None:
        blocks.append((cur_start, cur_end, raw[cur_start:cur_end]))
    # Safety: never emit a block that overlaps an excluded (comment) range.
    return [b for b in blocks if not _in_excluded(b[0], b[1], excluded)]


def _bullet_span(lines: list[tuple[int, int, str]], i: int) -> tuple[int, int, int]:
    """Given a bullet line at index i, extend over its continuation lines.

    Returns (start_char, end_char, next_index).
    """
    start = lines[i][0]
    end = lines[i][1]
    j = i + 1
    while j < len(lines):
        s2, e2, t2 = lines[j]
        stripped = t2.strip()
        if stripped == "" or stripped.startswith("- ") or not t2.startswith((" ", "\t")):
            break
        end = e2
        j += 1
    return start, end, j


def _mk_episode(kind: str, span_start: int, span_end: int, raw: str, meta: dict[str, Any],
                doc_type: str | None) -> dict[str, Any]:
    span_text = raw[span_start:span_end]
    actor = meta.get("author") or meta.get("attendees")
    status = str(meta.get("status") or "current") if doc_type == "protocol" else "current"
    return {
        "kind": kind,
        "summary": _clean(span_text),
        "what_changed": span_text,
        "actor": str(actor) if actor is not None else None,
        "date": str(meta.get("date")) if meta.get("date") is not None else None,
        "status": status,
        "record_id": meta.get("record_id"),
        "spans": [{"start": span_start, "end": span_end, "text": span_text, "role": "decision"}],
    }


def _extract_episodes(raw: str, body_start: int, excluded: list[tuple[int, int]],
                      meta: dict[str, Any], doc_type: str | None) -> list[dict[str, Any]]:
    lines = list(_physical_lines(raw, body_start, excluded))
    episodes: list[dict[str, Any]] = []
    in_changes = False
    i = 0
    while i < len(lines):
        s, e, t = lines[i]
        stripped = t.strip()
        low = stripped.lower()

        if low.startswith("changes from"):
            in_changes = True
            i += 1
            continue

        if in_changes:
            if stripped == "":
                i += 1
                continue
            if stripped.startswith("- "):
                bs, be, nxt = _bullet_span(lines, i)
                btext = raw[bs:be]
                if _CHANGE_VERB.search(btext):
                    is_dose = re.search(r"dose", btext, re.I) and re.search(
                        r"chang|reduc|lower|drop|decreas", btext, re.I
                    )
                    episodes.append(
                        _mk_episode("dose_change" if is_dose else "protocol_change",
                                    bs, be, raw, meta, doc_type)
                    )
                i = nxt
                continue
            # a non-bullet, non-blank line ends the changes section
            in_changes = False

        if low.startswith("decision:"):
            kind = "exclusion" if doc_type == "decision_record" else "decision"
            ep = _mk_episode(kind, s, e, raw, meta, doc_type)
            # Attach the recorded reason (whole paragraph) if one follows.
            for j in range(i + 1, len(lines)):
                s2, e2, t2 = lines[j]
                if re.match(r"(?i)^\s*reason", t2):
                    r_start, r_end = s2, e2
                    for s3, e3, t3 in lines[j + 1:]:  # extend over continuation lines
                        if t3.strip() == "":
                            break
                        r_end = e3
                    ep["spans"].append(
                        {"start": r_start, "end": r_end, "text": raw[r_start:r_end], "role": "reason"}
                    )
                    break
            episodes.append(ep)
            i += 1
            continue

        # Bold change statement outside a changes section (e.g., the antibody swap).
        if "**" in t and _CHANGE_VERB.search(t):
            if stripped.startswith("- "):
                bs, be, nxt = _bullet_span(lines, i)
                nexti = nxt
            else:
                bs, be, nexti = s, e, i + 1
            btext = raw[bs:be]
            kind = "reagent_swap" if re.search(r"antibod|reagent|switch", btext, re.I) else "protocol_change"
            episodes.append(_mk_episode(kind, bs, be, raw, meta, doc_type))
            i = nexti
            continue

        i += 1
    return episodes


# --- freeform extraction (uploaded notes without the sample's structure) ----
#
# The deterministic extractor above keys off the sample corpus's markdown shape
# ("Changes from ...", "Decision:", bold change statements). A real user's note
# won't have that. For those we ask the reasoning model to extract decisions, but
# the model MUST quote each decision verbatim from the source — we then locate the
# quote in raw_text to compute the span. A quote we cannot find verbatim is dropped,
# never fabricated. Provenance stays structural: raw_text[start:end] == span.text.

_LLM_KINDS = {"dose_change", "reagent_swap", "exclusion", "protocol_change", "decision"}

_LLM_EXTRACT_SYSTEM = (
    "You extract discrete research DECISIONS from a scientist's freeform note or "
    "document. A decision is a concrete choice or change the lab made: a dose change, "
    "a reagent/antibody swap, an animal or sample exclusion, a protocol or method "
    "change. For every decision you MUST copy the exact text from the source "
    "verbatim, character for character, so it can be located and cited. Never "
    "paraphrase a quote and never invent a decision that is not stated. If the note "
    "states no concrete decision, return an empty array."
)

_LLM_EXTRACT_TEMPLATE = """Source note ({filename}):
\"\"\"
{body}
\"\"\"

Extract every concrete research decision stated above. Respond with ONLY a JSON
array, no prose. Each element:
{{
  "kind": one of "dose_change","reagent_swap","exclusion","protocol_change","decision",
  "summary": "<short human-readable summary of the decision>",
  "decision_quote": "<exact verbatim sentence/clause from the source stating the change>",
  "reason_quote": "<exact verbatim text stating WHY, if present, else null>",
  "date": "<ISO date if stated in the text, else null>",
  "actor": "<who did it if stated, else null>"
}}
Return [] if there is no concrete decision."""


def _parse_json_array(text: str) -> list[Any]:
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"no JSON array in model output: {text[:200]!r}")
    return json.loads(text[start:end + 1])


def _locate(raw: str, quote: str) -> tuple[int, int] | None:
    """Verbatim char span of `quote` in `raw`, or None. Exact provenance or nothing."""
    quote = (quote or "").strip()
    if not quote:
        return None
    idx = raw.find(quote)
    if idx != -1:
        return idx, idx + len(quote)
    # Tolerate collapsed internal whitespace, but only accept a real substring.
    norm = re.sub(r"\s+", " ", quote)
    idx = raw.find(norm)
    if idx != -1:
        return idx, idx + len(norm)
    return None


def extract_episodes_llm(raw: str, body_start: int, meta: dict[str, Any]) -> list[dict[str, Any]]:
    body = raw[body_start:]
    prompt = _LLM_EXTRACT_TEMPLATE.format(
        filename=meta.get("_filename", "note"), body=body[:8000]
    )
    result = router.reason(prompt, system=_LLM_EXTRACT_SYSTEM, max_tokens=1200, temperature=0.0)
    try:
        items = _parse_json_array(result.text)
    except (ValueError, json.JSONDecodeError):
        return []

    episodes: list[dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        loc = _locate(raw, it.get("decision_quote", ""))
        if not loc:  # no verbatim anchor -> we refuse to fabricate a span
            continue
        s, e = loc
        kind = it.get("kind") if it.get("kind") in _LLM_KINDS else "decision"
        ep: dict[str, Any] = {
            "kind": kind,
            "summary": _clean(it.get("summary") or raw[s:e]),
            "what_changed": raw[s:e],
            "actor": it.get("actor") or (str(meta["author"]) if meta.get("author") else None),
            "date": it.get("date") or (str(meta["date"]) if meta.get("date") else None),
            "status": "current",
            "record_id": meta.get("record_id"),
            "spans": [{"start": s, "end": e, "text": raw[s:e], "role": "decision"}],
        }
        rloc = _locate(raw, it.get("reason_quote", "")) if it.get("reason_quote") else None
        if rloc and rloc != loc:
            rs, re_end = rloc
            ep["spans"].append({"start": rs, "end": re_end, "text": raw[rs:re_end], "role": "reason"})
        episodes.append(ep)
    return episodes


def parse_text(filename: str, raw: str, *, allow_llm: bool = False) -> ParsedDoc:
    """Parse a document from raw text. Frontmatter is optional.

    Structured extraction runs first (preserves the sample corpus exactly). When it
    finds nothing and `allow_llm` is set (uploads), the freeform extractor runs.
    """
    m = _FRONTMATTER.match(raw)
    if m:
        meta = yaml.safe_load(m.group(1)) or {}
        body_start = m.end()
    else:
        meta, body_start = {}, 0
    if not isinstance(meta, dict):
        meta = {}

    excluded = _excluded_ranges(raw)
    blocks = _block_spans(raw, body_start, excluded)
    doc_type = meta.get("doc_type")
    episodes = _extract_episodes(raw, body_start, excluded, meta, doc_type)
    if allow_llm and not episodes and raw[body_start:].strip():
        episodes = extract_episodes_llm(raw, body_start, {**meta, "_filename": filename})

    def _int(v: Any) -> int | None:
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    return ParsedDoc(
        filename=filename,
        frontmatter=meta,
        doc_type=doc_type,
        title=meta.get("title"),
        version=_int(meta.get("version")),
        status=meta.get("status"),
        supersedes=_int(meta.get("supersedes")),
        author=str(meta.get("author")) if meta.get("author") is not None else None,
        date=str(meta.get("date")) if meta.get("date") is not None else None,
        protocol_version=_int(meta.get("protocol_version")),
        record_id=meta.get("record_id"),
        raw_text=raw,
        body_start=body_start,
        blocks=blocks,
        episodes=episodes,
    )


def parse_document(path: Path) -> ParsedDoc:
    """Parse a source file from disk (structured extraction only — used by the seeder)."""
    return parse_text(path.name, path.read_text(encoding="utf-8"), allow_llm=False)


# --- ingest into the store --------------------------------------------------

def ingest_path(con: sqlite3.Connection, path: Path) -> dict[str, Any]:
    """Ingest one file: store the document, index its spans, capture episodes."""
    doc = parse_document(path)

    doc_id = store.insert_document(
        con,
        filename=doc.filename, doc_type=doc.doc_type, title=doc.title,
        version=doc.version, status=doc.status, supersedes=doc.supersedes,
        author=doc.author, date=doc.date, protocol_version=doc.protocol_version,
        record_id=doc.record_id, frontmatter=doc.frontmatter, raw_text=doc.raw_text,
    )

    # Index source spans (paragraph blocks) with their exact offsets.
    block_texts = [b[2] for b in doc.blocks]
    vectors = router.embed(block_texts) if block_texts else []
    for (start, end, text), vec in zip(doc.blocks, vectors):
        span_id = store.insert_span(con, doc_id, start, end, text, kind="block")
        store.set_span_embedding(con, span_id, vec)

    # Capture episodes + their verbatim evidence spans.
    for ep in doc.episodes:
        ep_id = store.insert_episode(
            con, document_id=doc_id, kind=ep["kind"], summary=ep["summary"],
            what_changed=ep["what_changed"], actor=ep["actor"], date=ep["date"],
            status=ep["status"], record_id=ep["record_id"],
        )
        for sp in ep["spans"]:
            store.insert_episode_span(
                con, episode_id=ep_id, document_id=doc_id,
                start=sp["start"], end=sp["end"], text=sp["text"], role=sp["role"],
            )

    con.commit()
    return {"filename": doc.filename, "spans": len(doc.blocks), "episodes": len(doc.episodes)}


def ingest_text(con: sqlite3.Connection, filename: str, raw: str, *,
                doc_type: str | None = None, title: str | None = None,
                date: str | None = None, author: str | None = None) -> dict[str, Any]:
    """Ingest an uploaded document (freeform allowed). Form metadata fills gaps the
    file's front-matter leaves. Returns the new document + episode ids so the caller
    can run gap detection on just the new decisions."""
    doc = parse_text(filename, raw, allow_llm=True)

    doc_id = store.insert_document(
        con,
        filename=filename,
        doc_type=doc.doc_type or doc_type,
        title=doc.title or title,
        version=doc.version, status=doc.status, supersedes=doc.supersedes,
        author=doc.author or author,
        date=doc.date or date,
        protocol_version=doc.protocol_version, record_id=doc.record_id,
        frontmatter=doc.frontmatter, raw_text=raw,
    )

    # Index source spans; size the vector table to the embedding dim on first use.
    block_texts = [b[2] for b in doc.blocks]
    vectors = router.embed(block_texts) if block_texts else []
    if store.embed_dim(con) is None:
        dim = len(vectors[0]) if vectors else len(router.embed(["dimension probe"])[0])
        store.ensure_vec_table(con, dim)
    for (start, end, text), vec in zip(doc.blocks, vectors):
        span_id = store.insert_span(con, doc_id, start, end, text, kind="block")
        store.set_span_embedding(con, span_id, vec)

    episode_ids: list[int] = []
    for ep in doc.episodes:
        ep_id = store.insert_episode(
            con, document_id=doc_id, kind=ep["kind"], summary=ep["summary"],
            what_changed=ep["what_changed"], actor=ep["actor"], date=ep["date"],
            status=ep["status"], record_id=ep["record_id"],
        )
        for sp in ep["spans"]:
            store.insert_episode_span(
                con, episode_id=ep_id, document_id=doc_id,
                start=sp["start"], end=sp["end"], text=sp["text"], role=sp["role"],
            )
        episode_ids.append(ep_id)

    con.commit()
    return {
        "document_id": doc_id, "filename": filename,
        "spans": len(doc.blocks), "episodes": len(doc.episodes),
        "episode_ids": episode_ids,
    }


def _is_source_document(path: Path) -> bool:
    """A source document has YAML front-matter with a doc_type. This excludes the
    dataset README (documentation, and a spoiler for the demo) and any stray notes.
    """
    if path.name.lower() == "readme.md":
        return False
    head = path.read_text(encoding="utf-8")[:400]
    m = _FRONTMATTER.match(head + "\n")  # tolerate short files
    if not m:
        # front-matter may exceed the head slice; parse fully as a fallback
        return parse_document(path).doc_type is not None
    meta = yaml.safe_load(m.group(1)) or {}
    return isinstance(meta, dict) and meta.get("doc_type") is not None


def ingest_dir(con: sqlite3.Connection, directory: Path) -> dict[str, Any]:
    """Ingest every source .md file in a directory (sorted), indexing spans.

    Non-source files (the dataset README, files without front-matter) are skipped
    so demo-spoiler text never enters the corpus.
    """
    all_md = sorted(directory.glob("*.md"))
    files = [f for f in all_md if _is_source_document(f)]
    skipped = [f.name for f in all_md if f not in files]
    if not files:
        raise FileNotFoundError(f"no source documents found in {directory}")

    # Size the vector index to the embedding model's dimension.
    dim = len(router.embed(["dimension probe"])[0])
    store.ensure_vec_table(con, dim)

    results = [ingest_path(con, f) for f in files]
    return {"files": results, "skipped": skipped, **store.counts(con)}
