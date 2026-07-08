"""Phase 1 acceptance: provenance round-trips to an exact source span.

These tests build a fresh store from data/sample in a temp DB and assert the core
trust property — every span maps back to the exact characters of its source file —
plus that the designed demo episodes were captured. Requires a running Ollama with
the embedding model pulled; skipped otherwise.
"""
from __future__ import annotations

import pytest

from backend.config import settings
from backend.ingest import ingest_dir
from backend.inference import router
from backend.inference.local import OllamaError
from backend.memory import store


@pytest.fixture(scope="module")
def con(tmp_path_factory):
    # Skip cleanly if the local embedding backend isn't available.
    try:
        router.embed(["healthcheck"])
    except OllamaError as exc:
        pytest.skip(f"Ollama embedding backend unavailable: {exc}")

    db_path = tmp_path_factory.mktemp("store") / "test.db"
    c = store.connect(db_path)
    store.ensure_schema(c)
    ingest_dir(c, settings.sample_dir)
    yield c
    c.close()


def test_readme_not_ingested(con):
    """The dataset README (a demo spoiler) must never enter the corpus."""
    names = {d["filename"] for d in store.list_documents(con)}
    assert "README.md" not in names
    assert len(names) == 8


def test_every_span_is_exact(con):
    """Structural provenance: raw_text[start:end] == span text, for every span."""
    docs = {d["id"]: store.get_document(con, d["id"]) for d in store.list_documents(con)}
    rows = con.execute("SELECT document_id, start_char, end_char, text FROM spans").fetchall()
    assert rows, "no spans indexed"
    for r in rows:
        raw = docs[r["document_id"]]["raw_text"]
        assert raw[r["start_char"]:r["end_char"]] == r["text"]


def test_episode_spans_are_exact(con):
    """Episode evidence spans are also exact slices of their source."""
    docs = {d["id"]: store.get_document(con, d["id"]) for d in store.list_documents(con)}
    rows = con.execute(
        "SELECT document_id, start_char, end_char, text FROM episode_spans"
    ).fetchall()
    for r in rows:
        raw = docs[r["document_id"]]["raw_text"]
        assert raw[r["start_char"]:r["end_char"]] == r["text"]


def test_antibody_swap_episode_captured(con):
    """The unexplained Gal-3 antibody swap (Beat 1 target) is an episode with span."""
    eps = store.list_episodes(con)
    swap = [e for e in eps if e["kind"] == "reagent_swap"]
    assert swap, "antibody swap episode not extracted"
    text = " ".join(s["text"] for e in swap for s in e["spans"])
    assert "Abcam ab209344" in text
    assert "Novus NBP2-27373" in text
    assert swap[0]["spans"][0]["filename"] == "notebook_cohort3_2025-01-15.md"


def test_key_decision_episodes_present(con):
    """Dose change (v3) and both exclusions are captured."""
    kinds = [e["kind"] for e in store.list_episodes(con)]
    assert kinds.count("dose_change") >= 1
    assert kinds.count("exclusion") == 2


def test_why_dose_grounds_across_pilot_and_meeting(con):
    """'Why did we drop the LPS dose?' — the answer lives in the pilot notebook +
    meeting note, NOT protocol v3. Retrieval must surface those source spans."""
    vec = router.embed(["Why did we drop the LPS dose in cohort 3?"])[0]
    hits = store.search_spans(con, vec, k=6)
    files = {h["filename"] for h in hits}
    assert "meeting_2024-11-12.md" in files or "notebook_pilot_2024-10-30.md" in files
    # And the grounding text is real evidence (mortality / decision), cited exactly.
    joined = " ".join(h["text"] for h in hits)
    assert ("250" in joined) or ("mortality" in joined.lower()) or ("died" in joined.lower())


def test_precedent_exclusion_retrievable(con):
    """The cohort-3 exclusion query surfaces the prior pilot exclusion (Beat 3)."""
    vec = router.embed(
        ["Have we excluded an animal for failing cued visible-platform trials before?"]
    )[0]
    hits = store.search_spans(con, vec, k=6)
    files = {h["filename"] for h in hits}
    assert "exclusion_pilot_2024-10-28.md" in files
