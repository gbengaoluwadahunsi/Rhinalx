# Rhinalx — Built with Claude: Life Sciences (Builder Track)

## Positioning (the first thing a judge should hear)

**Rhinalx is an AI memory system for scientific reasoning.** Laboratories don't lose
data — they lose the *reasoning* behind their decisions. A lab notebook records *what*
happened; Rhinalx remembers *why* it happened. It proactively captures missing
rationale, reconstructs decision histories with citations, and keeps labs from
repeating forgotten mistakes.

## Written summary (100–200 words)

Laboratories don't lose data — they lose the *reasoning* behind their decisions. Why
was this antibody changed? Why was this mouse excluded? Why did the dose drop? A lab
notebook records *what* happened; six months later, nobody remembers *why* — and that
is expensive.

Rhinalx is an AI memory system for scientific reasoning. It ingests protocols, notebook
entries, and meeting notes, and answers the two questions that bite a researcher:
*"Why did we change this?"* and *"Have we ruled this out before?"* — every claim traced
to an exact source span. Its signature move goes beyond retrieval: on ingest, Claude
**notices** rationale that's missing everywhere in the record and **interviews the
scientist** for it, filing the answer as cited memory. When it can't cite a claim, it
refuses rather than guesses, and superseded reasoning is archived, never deleted.
Reasoning runs on **Claude**; embeddings and search run locally, so unpublished data
never has to leave the machine. Built with Claude Code for the 2026 Built with Claude:
Life Sciences hackathon.

---

## Submission checklist

- [ ] 3-minute demo video (YouTube / Loom) — link: _TBD_
- [ ] Public GitHub repository — link: _TBD_
- [x] Written summary (above, ~180 words)
- [x] Open-source license (MIT, see `LICENSE`)
- [ ] Built entirely during the event (kickoff July 7; due July 13, 9 PM ET)

## The three demo beats (the video spine)

1. **Proactive interview** — on ingest, Rhinalx detects the cohort-3 Gal-3 antibody
   swap has no recorded reason and interviews the scientist; the answer is filed as
   cited memory.
2. **"Why did we drop the LPS dose in cohort 3?"** — reconstructed across the pilot
   notebook + meeting note (not in protocol v3), every claim cited.
3. **"Have we excluded an animal for this reason before?"** — surfaces the prior pilot
   exclusion via embeddings, resemblance explained by Claude, both cited.

## Why it's more than RAG (the memory-science framing)

Rhinalx maps to how scientific memory actually works: decisions are *episodic* memory,
consolidated rationale is *semantic* memory, superseding archives instead of deleting
(*adaptive forgetting*), the "why" reconstruction is *recall*, and the proactive
interview is *metacognition* — the system noticing what it doesn't know and asking.
That's applying neuroscience principles to AI memory, not just retrieval.

## Future direction — scientific reflection

Beyond "why did we do this?", the same architecture can ask **"given everything we've
learned since, would we still make this decision today?"** — comparing a past decision's
rationale against later accumulated evidence. Memory becomes reflection. (Roadmap, not in
the current demo.)
