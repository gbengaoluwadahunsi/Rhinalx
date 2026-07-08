"""The single-file memory store: SQLite + sqlite-vec, span-preserving.

Design rules from CLAUDE.md:
  - Documents are immutable once ingested (we insert, never update raw_text).
  - Provenance is structural: every indexable span records the exact
    (document_id, start_char, end_char) into that document's raw_text, so a
    retrieval result maps back to an exact source span, not an opaque chunk.
  - The whole lab memory is one portable, auditable file (settings.db_path).

Char offsets are indices into the document's stored raw_text (LF-normalized on
read), so `document.raw_text[start_char:end_char] == span.text` always holds.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

import sqlite_vec

from backend.config import settings
from backend.inference.base import Vector

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id               INTEGER PRIMARY KEY,
    filename         TEXT UNIQUE NOT NULL,
    doc_type         TEXT,
    title            TEXT,
    version          INTEGER,
    status           TEXT,
    supersedes       INTEGER,
    author           TEXT,
    date             TEXT,
    protocol_version INTEGER,
    record_id        TEXT,
    frontmatter_json TEXT,
    raw_text         TEXT NOT NULL,
    ingested_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS spans (
    id           INTEGER PRIMARY KEY,
    document_id  INTEGER NOT NULL REFERENCES documents(id),
    start_char   INTEGER NOT NULL,
    end_char     INTEGER NOT NULL,
    text         TEXT NOT NULL,
    kind         TEXT
);

CREATE TABLE IF NOT EXISTS episodes (
    id           INTEGER PRIMARY KEY,
    document_id  INTEGER NOT NULL REFERENCES documents(id),
    kind         TEXT,
    summary      TEXT,
    what_changed TEXT,
    actor        TEXT,
    date         TEXT,
    status       TEXT,
    record_id    TEXT
);

CREATE TABLE IF NOT EXISTS episode_spans (
    id          INTEGER PRIMARY KEY,
    episode_id  INTEGER NOT NULL REFERENCES episodes(id),
    document_id INTEGER NOT NULL REFERENCES documents(id),
    start_char  INTEGER NOT NULL,
    end_char    INTEGER NOT NULL,
    text        TEXT NOT NULL,
    role        TEXT
);

CREATE TABLE IF NOT EXISTS open_questions (
    id               INTEGER PRIMARY KEY,
    episode_id       INTEGER NOT NULL REFERENCES episodes(id),
    prompt           TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'open',
    detected_backend TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    answer           TEXT,
    rationale_id     INTEGER,
    answered_at      TEXT
);

CREATE TABLE IF NOT EXISTS consolidated_rationales (
    id              INTEGER PRIMARY KEY,
    statement       TEXT NOT NULL,
    episode_id      INTEGER REFERENCES episodes(id),
    status          TEXT NOT NULL DEFAULT 'current',   -- 'current' | 'archived'
    source          TEXT,                              -- 'interview' | 'consolidation'
    provenance_json TEXT,
    weight          REAL NOT NULL DEFAULT 1.0,         -- retrieval weight; archived ones are lowered
    superseded_by   INTEGER,                           -- id of the rationale that replaced this one
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
"""


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    """Open a connection with sqlite-vec loaded and row access by name."""
    path = db_path or settings.db_path
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.enable_load_extension(True)
    sqlite_vec.load(con)
    con.enable_load_extension(False)
    con.execute("PRAGMA foreign_keys = ON")
    return con


def ensure_schema(con: sqlite3.Connection) -> None:
    con.executescript(SCHEMA)
    con.commit()


def ensure_vec_table(con: sqlite3.Connection, dim: int) -> None:
    """Create the vector index sized to the embedding model's dimension.

    Dimension is recorded in `meta` so the store is model-agnostic and can be
    reopened without re-probing.
    """
    con.execute(
        "INSERT OR REPLACE INTO meta(key, value) VALUES ('embed_dim', ?)", (str(dim),)
    )
    con.execute(
        f"CREATE VIRTUAL TABLE IF NOT EXISTS vec_spans USING vec0(embedding float[{dim}])"
    )
    con.commit()


def embed_dim(con: sqlite3.Connection) -> int | None:
    row = con.execute("SELECT value FROM meta WHERE key = 'embed_dim'").fetchone()
    return int(row["value"]) if row else None


def reset_db(db_path: Path | None = None) -> None:
    """Delete the store file (and WAL/SHM) for a clean rebuild by the seeder."""
    path = Path(db_path or settings.db_path)
    for p in (path, path.with_suffix(path.suffix + "-wal"), path.with_suffix(path.suffix + "-shm")):
        if p.exists():
            p.unlink()


# --- writes -----------------------------------------------------------------

def insert_document(con: sqlite3.Connection, *, filename: str, doc_type: str | None,
                    title: str | None, version: int | None, status: str | None,
                    supersedes: int | None, author: str | None, date: str | None,
                    protocol_version: int | None, record_id: str | None,
                    frontmatter: dict[str, Any], raw_text: str) -> int:
    cur = con.execute(
        """INSERT INTO documents
           (filename, doc_type, title, version, status, supersedes, author, date,
            protocol_version, record_id, frontmatter_json, raw_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (filename, doc_type, title, version, status, supersedes, author, date,
         protocol_version, record_id, json.dumps(frontmatter, default=str), raw_text),
    )
    return int(cur.lastrowid)


def insert_span(con: sqlite3.Connection, document_id: int, start: int, end: int,
                text: str, kind: str | None = None) -> int:
    cur = con.execute(
        "INSERT INTO spans (document_id, start_char, end_char, text, kind) VALUES (?, ?, ?, ?, ?)",
        (document_id, start, end, text, kind),
    )
    return int(cur.lastrowid)


def set_span_embedding(con: sqlite3.Connection, span_id: int, vector: Vector) -> None:
    con.execute(
        "INSERT INTO vec_spans (rowid, embedding) VALUES (?, ?)",
        (span_id, sqlite_vec.serialize_float32(vector)),
    )


def insert_episode(con: sqlite3.Connection, *, document_id: int, kind: str,
                   summary: str, what_changed: str, actor: str | None,
                   date: str | None, status: str, record_id: str | None) -> int:
    cur = con.execute(
        """INSERT INTO episodes
           (document_id, kind, summary, what_changed, actor, date, status, record_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (document_id, kind, summary, what_changed, actor, date, status, record_id),
    )
    return int(cur.lastrowid)


def insert_episode_span(con: sqlite3.Connection, *, episode_id: int, document_id: int,
                        start: int, end: int, text: str, role: str) -> int:
    cur = con.execute(
        """INSERT INTO episode_spans (episode_id, document_id, start_char, end_char, text, role)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (episode_id, document_id, start, end, text, role),
    )
    return int(cur.lastrowid)


# --- reads ------------------------------------------------------------------

def search_spans(con: sqlite3.Connection, query_vec: Vector, k: int = 5) -> list[dict[str, Any]]:
    """K-nearest source spans to the query vector, each with its exact provenance.

    Returns dicts carrying the source filename, doc metadata, the exact char
    offsets, the verbatim span text, and the vector distance.
    """
    rows = con.execute(
        """
        WITH knn AS (
            SELECT rowid, distance FROM vec_spans
            WHERE embedding MATCH ? AND k = ?
        )
        SELECT s.id AS span_id, s.document_id, s.start_char, s.end_char, s.text, s.kind,
               d.filename, d.doc_type, d.title, d.date, knn.distance
        FROM knn
        JOIN spans s ON s.id = knn.rowid
        JOIN documents d ON d.id = s.document_id
        ORDER BY knn.distance
        """,
        (sqlite_vec.serialize_float32(query_vec), k),
    ).fetchall()
    return [dict(r) for r in rows]


def get_document(con: sqlite3.Connection, doc_id: int) -> dict[str, Any] | None:
    row = con.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    return dict(row) if row else None


def spans_for_document(con: sqlite3.Connection, doc_id: int) -> list[dict[str, Any]]:
    """The indexed source spans (with exact offsets) for one document — for the
    source-span viewer, so grounding spans can be highlighted in place."""
    rows = con.execute(
        "SELECT id, start_char, end_char, text, kind FROM spans WHERE document_id = ? ORDER BY start_char",
        (doc_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def episodes_for_document(con: sqlite3.Connection, doc_id: int) -> list[dict[str, Any]]:
    rows = con.execute(
        "SELECT id, kind, summary, date, status, record_id FROM episodes WHERE document_id = ? ORDER BY id",
        (doc_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def list_documents(con: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = con.execute(
        """SELECT id, filename, doc_type, title, version, status, supersedes,
                  author, date, protocol_version, record_id
           FROM documents ORDER BY date, filename"""
    ).fetchall()
    return [dict(r) for r in rows]


def list_episodes(con: sqlite3.Connection) -> list[dict[str, Any]]:
    """Episodes with their grounding evidence spans (each with source filename)."""
    eps = [dict(r) for r in con.execute(
        """SELECT e.*, d.filename FROM episodes e
           JOIN documents d ON d.id = e.document_id
           ORDER BY e.date, e.id"""
    ).fetchall()]
    for ep in eps:
        ep["spans"] = [dict(r) for r in con.execute(
            """SELECT es.start_char, es.end_char, es.text, es.role, d.filename
               FROM episode_spans es JOIN documents d ON d.id = es.document_id
               WHERE es.episode_id = ? ORDER BY es.start_char""",
            (ep["id"],),
        ).fetchall()]
    return eps


def get_episode(con: sqlite3.Connection, episode_id: int) -> dict[str, Any] | None:
    row = con.execute(
        """SELECT e.*, d.filename FROM episodes e
           JOIN documents d ON d.id = e.document_id WHERE e.id = ?""",
        (episode_id,),
    ).fetchone()
    if not row:
        return None
    ep = dict(row)
    ep["spans"] = [dict(r) for r in con.execute(
        """SELECT es.start_char, es.end_char, es.text, es.role, d.filename
           FROM episode_spans es JOIN documents d ON d.id = es.document_id
           WHERE es.episode_id = ? ORDER BY es.start_char""",
        (episode_id,),
    ).fetchall()]
    return ep


def counts(con: sqlite3.Connection) -> dict[str, int]:
    def n(table: str) -> int:
        return int(con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
    return {
        "documents": n("documents"),
        "episodes": n("episodes"),
        "spans": n("spans"),
        "episode_spans": n("episode_spans"),
        "open_questions": n("open_questions"),
        "rationales": n("consolidated_rationales"),
    }


# --- open questions + consolidated rationale (Beat 1) -----------------------

def insert_open_question(con: sqlite3.Connection, *, episode_id: int, prompt: str,
                         detected_backend: str | None) -> int:
    cur = con.execute(
        "INSERT INTO open_questions (episode_id, prompt, detected_backend) VALUES (?, ?, ?)",
        (episode_id, prompt, detected_backend),
    )
    con.commit()
    return int(cur.lastrowid)


def clear_open_questions(con: sqlite3.Connection) -> None:
    """Reset detected gaps (gap detection is re-run on seed)."""
    con.execute("DELETE FROM open_questions")
    con.commit()


def list_open_questions(con: sqlite3.Connection, status: str | None = "open") -> list[dict[str, Any]]:
    """Open questions with the decision they refer to and its evidence span."""
    sql = (
        """SELECT q.id, q.prompt, q.status, q.detected_backend, q.created_at,
                  q.answer, q.rationale_id, q.answered_at,
                  e.id AS episode_id, e.kind AS episode_kind, e.summary AS episode_summary,
                  e.what_changed, e.date AS episode_date, e.actor, d.filename
           FROM open_questions q
           JOIN episodes e ON e.id = q.episode_id
           JOIN documents d ON d.id = e.document_id"""
    )
    params: tuple[Any, ...] = ()
    if status:
        sql += " WHERE q.status = ?"
        params = (status,)
    sql += " ORDER BY q.created_at, q.id"
    out = []
    for r in con.execute(sql, params).fetchall():
        item = dict(r)
        span = con.execute(
            """SELECT start_char, end_char, text, role FROM episode_spans
               WHERE episode_id = ? ORDER BY start_char LIMIT 1""",
            (item["episode_id"],),
        ).fetchone()
        item["evidence"] = dict(span) if span else None
        out.append(item)
    return out


def get_open_question(con: sqlite3.Connection, oq_id: int) -> dict[str, Any] | None:
    row = con.execute("SELECT * FROM open_questions WHERE id = ?", (oq_id,)).fetchone()
    return dict(row) if row else None


def insert_rationale(con: sqlite3.Connection, *, statement: str, episode_id: int | None,
                     source: str, provenance: dict[str, Any], status: str = "current",
                     weight: float = 1.0, superseded_by: int | None = None) -> int:
    cur = con.execute(
        """INSERT INTO consolidated_rationales
           (statement, episode_id, status, source, provenance_json, weight, superseded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (statement, episode_id, status, source, json.dumps(provenance, default=str),
         weight, superseded_by),
    )
    con.commit()
    return int(cur.lastrowid)


def set_superseded_by(con: sqlite3.Connection, rationale_id: int, superseded_by: int) -> None:
    con.execute(
        "UPDATE consolidated_rationales SET superseded_by = ? WHERE id = ?",
        (superseded_by, rationale_id),
    )
    con.commit()


def clear_consolidation(con: sqlite3.Connection) -> None:
    """Remove consolidation-produced rationales (kept idempotent across re-runs).
    Interview-captured rationales are preserved."""
    con.execute("DELETE FROM consolidated_rationales WHERE source = 'consolidation'")
    con.commit()


def mark_question_answered(con: sqlite3.Connection, oq_id: int, answer: str,
                           rationale_id: int) -> None:
    con.execute(
        """UPDATE open_questions
           SET status = 'answered', answer = ?, rationale_id = ?, answered_at = datetime('now')
           WHERE id = ?""",
        (answer, rationale_id, oq_id),
    )
    con.commit()


def get_rationale(con: sqlite3.Connection, rid: int) -> dict[str, Any] | None:
    row = con.execute("SELECT * FROM consolidated_rationales WHERE id = ?", (rid,)).fetchone()
    if not row:
        return None
    out = dict(row)
    out["provenance"] = json.loads(out.pop("provenance_json") or "{}")
    return out


def list_rationales(con: sqlite3.Connection, status: str | None = None) -> list[dict[str, Any]]:
    sql = """SELECT r.*, e.summary AS episode_summary, e.kind AS episode_kind, d.filename
             FROM consolidated_rationales r
             LEFT JOIN episodes e ON e.id = r.episode_id
             LEFT JOIN documents d ON d.id = e.document_id"""
    params: tuple[Any, ...] = ()
    if status:
        sql += " WHERE r.status = ?"
        params = (status,)
    sql += " ORDER BY r.created_at, r.id"
    out = []
    for r in con.execute(sql, params).fetchall():
        item = dict(r)
        item["provenance"] = json.loads(item.pop("provenance_json") or "{}")
        out.append(item)
    return out
