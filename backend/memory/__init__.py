"""Memory engine package.

Modules land here in later phases (per CLAUDE.md build order):
  store.py        — sqlite-vec read/write, span-preserving   (Phase 1)
  interview.py    — OpenQuestion generation + answer capture (Phase 2)
  retrieve.py     — span-returning retrieval + "why" assembly (Phase 3)
  precedent.py    — similarity + explanation                 (Phase 4)
  consolidate.py  — episodic -> semantic consolidation       (Phase 5)
  forget.py       — supersede / archive (never deletes)      (Phase 5)
"""
