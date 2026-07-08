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


def parse_document(path: Path) -> ParsedDoc:
    raw = path.read_text(encoding="utf-8")
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

    def _int(v: Any) -> int | None:
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    return ParsedDoc(
        filename=path.name,
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
