from __future__ import annotations

import pytest

from backend.memory import store


def _insert(con, filename: str) -> int:
    return store.insert_document(
        con,
        filename=filename,
        doc_type="note",
        title=None,
        version=None,
        status="current",
        supersedes=None,
        author=None,
        date=None,
        protocol_version=None,
        record_id=None,
        frontmatter={},
        raw_text="local project note",
    )


def test_projects_switch_and_isolate_documents(tmp_path):
    con = store.connect(tmp_path / "projects.db")
    store.ensure_schema(con)
    try:
        _insert(con, "default-note.txt")
        assert [d["filename"] for d in store.list_documents(con)] == ["default-note.txt"]

        second = store.create_project(con, "Second study")
        assert store.active_project_id(con) == second
        assert store.list_documents(con) == []

        _insert(con, "second-note.txt")
        assert [d["filename"] for d in store.list_documents(con)] == ["second-note.txt"]

        store.set_active_project(con, 1)
        assert [d["filename"] for d in store.list_documents(con)] == ["default-note.txt"]
        projects = store.list_projects(con)
        assert next(p for p in projects if p["id"] == 1)["active"] is True
        assert next(p for p in projects if p["id"] == second)["documents"] == 1
    finally:
        con.close()


def test_project_name_is_required(tmp_path):
    con = store.connect(tmp_path / "projects.db")
    store.ensure_schema(con)
    try:
        with pytest.raises(ValueError, match="project name"):
            store.create_project(con, "   ")
    finally:
        con.close()