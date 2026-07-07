# Rhinalx — research rationale memory for the bench scientist

> Name aside: a *palimpsest* is a manuscript overwritten but still readable
> underneath — the guiding metaphor for Rhinalx: "superseded decisions are
> archived, never deleted."

## What this is

A **local-first memory system for the *rationale* behind research decisions.**
A lab notebook records *what* happened (the LPS dose, the antibody, the cohort,
the date) but almost never *why*: why the dose dropped between cohorts, why two
animals were excluded, why a reagent was swapped, why a docking hit was dropped.
That reasoning lives in the PI's head, in meeting notes, and in Slack — and it
evaporates. Rhinalx captures it as structured, source-traceable memory and
answers the two questions that actually bite a scientist:

1. **"Why did we change this?"** — reconstructs the reasoning chain behind a
   specific decision (a dose change, an exclusion, a reagent swap), every claim
   cited to its source entry.
2. **"Have we tried or ruled this out before?"** — surfaces precedent so the lab
   doesn't repeat a dead end or re-litigate a settled call.

**Primary user:** a bench/dry-lab scientist or PhD student running a multi-cohort
study. **Secondary:** their supervisor / the next student who inherits the project.

This is a hackathon build (Anthropic "Built with Claude: Life Sciences", Builder
track). Optimize every decision for the demo and the judging rubric, not for
production completeness.

---

## Hard constraints — read before writing any code

- **New work only.** Built from scratch during the event. Reuse ideas, not code.
- **Provenance always.** No rationale, answer, or precedent claim is ever asserted
  without a citation to a specific source document + span. If the engine can't
  cite it, it doesn't say it. This is the core trust property for scientists.
- **Forgetting never deletes.** Superseding a decision means marking it archived /
  not-current and lowering its retrieval weight. The record stays fully
  recoverable. Deleting research history is a disqualifying anti-goal.
- **Local-first / data governance.** Runs entirely offline against a local store +
  local Ollama models. Unpublished data and unblinded results must never need to
  leave the machine. The Claude path is an opt-in enhancement, never required for
  the core loop to function.
- **Voice input is a thin convenience, NOT the product.** If you accept voice
  memos, transcribe with a local Whisper as a utility only. Do NOT build or market
  a transcription/scribe product — the product is the rationale memory and
  reasoning. (This also keeps a clean boundary from prior clinical-transcription
  work; stay in "why did this research decision happen / find precedent" territory.)
- **Demo-first.** Build backward from the 3-minute demo below. If a feature doesn't
  serve that arc, it waits.

---

## The money demo — build backward from this

A 3-minute recorded demo drives 30% of the score. The demo runs entirely on the
hand-built dataset in `data/sample/` (a synthetic Gal-3 / LPS neuroinflammation
study that mirrors the builder's real thesis). Three beats:

1. **Proactive interview (headline Claude feature).** On ingest, the agent notices
   that cohort 3's notebook records a Gal-3 antibody swap with *no recorded reason*,
   and asks the scientist for it: "You switched the Gal-3 antibody for cohort 3 but
   there's no recorded reason — what happened?" The answer is captured with
   provenance and becomes queryable. **This is the "beyond a basic app" moment —
   an agent that notices the holes in the lab's memory and fills them before they
   close. Pure RAG never does this.**
2. **"Why did we drop the LPS dose in cohort 3?"** The answer is NOT in protocol v3
   (which only states the new dose). The engine reconstructs it from the pilot
   notebook (mortality at 1 mg/kg) + the supervisor meeting note (decision +
   literature rationale), with sources shown inline.
3. **"Have we excluded an animal for this reason before?"** The engine surfaces the
   earlier pilot exclusion (same pattern: fails cued trials → suspected
   visual/sensorimotor cause) and explains the resemblance, prior reason shown.

Everything else is scaffolding for these three beats. Ship them end-to-end before
adding anything. See `data/sample/README.md` for the exact provenance map.

---

## Architecture

### Data model (the memory)

- **Document** — a source artifact: protocol version, lab-notebook entry, meeting
  note, decision/exclusion record. Fields: id, doc_type, title, version, author,
  date, raw_text, span offsets. Immutable once ingested. (See the YAML front-matter
  in the sample files for the fields to parse.)
- **Episode (Decision)** — a discrete decision event: "reduced LPS dose v2→v3",
  "excluded C3-22", "swapped Gal-3 antibody". Fields: id, summary, what_changed,
  actor, date, status (current | superseded), and **evidence spans** (document_id +
  char range) that ground it. Episodic layer.
- **ConsolidatedRationale** — the semantic layer: a stable reason distilled across
  episodes. Fields: id, statement, supporting_episode_ids, status
  (current | archived), superseded_by. Produced by consolidation, or captured live
  by the interview flow.
- **OpenQuestion** — a decision detected with NO recorded rationale (the interview
  targets). Fields: id, episode_id, prompt, status (open | answered), answer,
  answer_provenance. This is what powers Beat 1.
- **PrecedentLink** — a similarity edge between two episodes, with a score and a
  Claude-generated explanation of the resemblance.

Store everything in a single inspectable local file. "The whole lab memory is one
portable, auditable artifact" is a good line for the demo.

### Memory engine (map each mechanism to a real function)

- **Episodic capture** — on ingest, extract decision episodes with evidence spans.
  Never fabricate an actor/date/change not in source.
- **Gap detection + interview** — flag episodes whose rationale isn't present
  anywhere in the corpus; generate an `OpenQuestion`; ask the scientist; store the
  answer as a `ConsolidatedRationale` with provenance = the scientist's response.
- **Consolidation (episodic → semantic)** — cluster related episodes; distill
  stable rationale tagged back to supporting episodes. What makes it *memory*.
- **Adaptive forgetting** — when a newer episode supersedes an older decision, mark
  the old one archived + lower its weight. Keep it recoverable. Current answers
  surface current rationale; the archive is one query away.
- **Indexing** — the index points back to exact source spans, so provenance is
  structural. Retrieval returns spans, not opaque chunks.

### Hybrid inference (keep Claude visibly central to the smart step)

Single interface, two backends, chosen by a `POLICY` config flag:

- **Reasoning** (gap detection, interview question generation, "why" narrative
  assembly, precedent explanation, consolidation) → **Claude** when policy allows;
  **Ollama local LLM** as the offline fallback.
- **Embeddings** → local Ollama (`nomic-embed-text`) always, so retrieval works
  fully offline.

Abstract behind one `reason()` / `embed()` interface so feature code never branches
on backend. Log which backend answered; show it in the UI.

---

## Tech stack

- **Python 3.11**, deps via `uv`.
- **FastAPI** backend.
- **SQLite + sqlite-vec** as the single-file local store (documents, episodes,
  rationale, open questions, embeddings).
- **Ollama**: `nomic-embed-text` (embeddings, always); `llama3.1:8b` or
  `qwen2.5:7b` (LLM fallback). Optional: local Whisper for voice memos (utility only).
- **Anthropic API** for the reasoning path. Model in config (`claude-sonnet-5`
  default; escalate hardest consolidation to `claude-opus-4-8` only if needed).
  Never hardcode a key — read from env.
- **Frontend:** React + Vite + TypeScript, styled with **Tailwind CSS**
  (install the current Tailwind version and follow its official Vite setup — do
  not assume an older config). Deliberately minimal, three surfaces: (a) a question
  box with cited answers, (b) an "open questions" inbox where the agent's interview
  prompts appear and get answered, (c) a decision timeline / precedent panel. Clean
  and legible beats feature-rich for the demo.

---

## Repo layout

```
rhinalx/
  CLAUDE.md
  README.md
  pyproject.toml
  .env.example              # ANTHROPIC_API_KEY, POLICY=claude|local, MODEL=...
  data/
    sample/                 # the demo dataset (already built — see its README.md)
    rhinalx.db              # gitignored; the single-file memory
  backend/
    main.py                 # FastAPI app + routes
    ingest.py               # document ingest + episode extraction + gap detection
    memory/
      store.py              # sqlite-vec read/write, span-preserving
      interview.py          # OpenQuestion generation + answer capture (Beat 1)
      consolidate.py        # episodic -> semantic consolidation
      forget.py             # supersede / archive logic (never deletes)
      precedent.py          # similarity + Claude explanation (Beat 3)
      retrieve.py           # span-returning retrieval + "why" assembly (Beat 2)
    inference/
      base.py               # reason() / embed() interface
      claude.py             # Anthropic backend
      local.py              # Ollama backend
      router.py             # policy-based backend selection + logging
  frontend/                 # React + Vite + TypeScript + Tailwind
  scripts/
    seed.py                 # ingests data/sample into the db
```

---

## Commands

```bash
uv sync
cp .env.example .env            # fill ANTHROPIC_API_KEY; set POLICY
ollama pull nomic-embed-text
ollama pull llama3.1:8b

uv run python scripts/seed.py                  # ingest data/sample, build memory
uv run uvicorn backend.main:app --reload       # api on :8000
cd frontend && npm install && npm run dev       # ui on :5173
```

Keep a single `make demo` (or one script) that seeds + runs, so the demo env comes
up in one command. Do not debug setup on camera.

---

## Conventions

- Every retrieval result and generated claim carries its source spans all the way
  to the UI. Dropping a span is a bug.
- Reasoning-model calls go through `inference/router.py` — never call Anthropic or
  Ollama directly from feature code.
- Prompts live next to the code that uses them, versioned in-repo.
- The engine must refuse ("insufficient evidence in the record") rather than guess.
  A confident wrong answer about someone's own science is worse than an honest gap.
- Log which inference backend served each request; expose it in the UI (makes the
  hybrid story visible in the demo).

---

## Build order (strict priority — stop-the-line if out of order)

1. **Ingest + episode extraction + span-preserving store** against `data/sample/`.
   Prove provenance round-trips (a claim → its exact source span).
2. **Beat 1 — gap detection + interview.** Detect the unexplained antibody swap,
   generate the question, capture + store the answer with provenance, show it in the
   Open Questions inbox. This is the headline; get it working early.
3. **Beat 2 — "why" reconstruction** end to end (retrieve across pilot notebook +
   meeting note → assemble narrative → cite) in the UI.
4. **Beat 3 — precedent surfacing** with Claude-explained resemblance.
5. **Consolidation + forgetting** made visible (a "current vs archived rationale"
   view). The "beyond basic RAG" proof for the Claude Use score.
6. **Hybrid backend toggle** working + shown in UI.
7. Polish the demo path only. Then record.

---

## What NOT to build (anti-goals)

- No auth, accounts, multi-tenancy, or roles.
- No transcription/scribe product. Voice memo → text is a thin local utility, not a
  feature to showcase.
- No cloud deployment, Docker orchestration, or CI. Local run only.
- No general document chatbot. The product answers "why", "precedent", and asks for
  missing rationale — resist scope creep into open-ended Q&A.
- No deleting or hard-editing ingested source or historical rationale, ever.
