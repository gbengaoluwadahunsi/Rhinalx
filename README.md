# Rhinalx — an AI memory system for scientific reasoning

> Laboratories don't lose data. They lose **decisions**. Rhinalx makes scientific
> reasoning permanent.

A lab notebook records *what* happened — the dose, the antibody, the cohort, the
date — but almost never *why*: why the dose dropped between cohorts, why an animal
was excluded, why a reagent was swapped. That reasoning lives in the PI's head, in
meeting notes, and in Slack, and it evaporates. Rhinalx captures it as structured,
**source-traceable** memory and answers the two questions that actually bite a
researcher:

1. **"Why did we change this?"** — reconstructs the reasoning behind a decision,
   every claim cited to its exact source span.
2. **"Have we ruled this out before?"** — surfaces precedent so the lab doesn't
   repeat a dead end.

And its signature move: on ingest it **notices rationale that's missing everywhere
in the record and interviews you for it** — an AI collaborator that fills the holes
in the lab's memory before they close. Pure RAG never does this.

Built for the 2026 *Built with Claude: Life Sciences* hackathon (Builder track).

---

## The three demo beats

Run against the synthetic Gal-3 / LPS neuroinflammation study in `data/sample/`:

1. **Proactive interview** — Rhinalx detects that cohort 3's notebook records a
   Gal-3 antibody swap with *no recorded reason*, and asks you for it. Your answer
   is filed as memory, attributed to your own words. → **Open Questions**
2. **Cited "why" reconstruction** — *"Why did we drop the LPS dose in cohort 3?"*
   The answer isn't in protocol v3; Claude reconstructs it across the pilot notebook
   (mortality at 1 mg/kg) + the supervisor meeting note, every claim carrying a
   provenance chip. → **Ask**
3. **Precedent** — *"Have we excluded an animal for this reason before?"* surfaces
   the earlier pilot exclusion via embeddings, with a Claude-explained resemblance,
   both cases cited. → **Precedent**

Consolidation distils these into a **Knowledge** library; when a decision is
superseded (LPS dose 1 mg/kg → 250 µg/kg) the old rationale is **archived, never
deleted**, and weighted down → **Archive**.

---

## Principles

- **Provenance always.** No claim is asserted without a citation to a source span.
  If it can't be cited, Rhinalx refuses ("insufficient evidence in the record")
  rather than guessing.
- **Local-first.** Ingestion, embeddings, and search run entirely on your machine
  against a single inspectable file (`data/rhinalx.db`). Claude is an opt-in
  enhancement — flip the top-bar toggle to **Local** and the whole loop runs
  offline on Ollama. Every answer shows which backend served it.
- **Forgetting never deletes.** Superseded reasoning is archived and de-weighted,
  fully recoverable.

---

## Quickstart

Prerequisites: [uv](https://docs.astral.sh/uv/), Node.js, and
[Ollama](https://ollama.com/) running locally.

```bash
# 1. models (embeddings always local; llama3.1 is the offline reasoning fallback)
ollama pull nomic-embed-text
ollama pull llama3.1:8b

# 2. config — copy and add your key (optional; without it, runs fully local)
cp .env.example .env      # set ANTHROPIC_API_KEY, POLICY=claude|local

# 3. deps
uv sync
npm --prefix frontend install

# 4. one command: seed the store, then run both servers
uv run python scripts/demo.py            # add --reseed to rebuild the store
```

Then open **http://localhost:5173**. The API is on `http://localhost:8000`.

Run the pieces separately if you prefer:

```bash
uv run python scripts/seed.py                 # build data/rhinalx.db
uv run uvicorn backend.main:app --port 8000   # API
npm --prefix frontend run dev                 # UI on :5173
uv run pytest                                 # provenance round-trip tests
```

---

## Stack

Python 3.11 · FastAPI · SQLite + sqlite-vec (single-file store) · Ollama
`nomic-embed-text` (embeddings, always local) + `llama3.1:8b` (offline reasoning
fallback) · Anthropic Claude (`claude-sonnet-5`) for the reasoning path, routed
through one `backend/inference/router.py` · React + Vite + TypeScript + Tailwind.

MIT licensed.
