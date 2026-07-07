# Rhinalx — Built with Claude: Life Sciences (Builder Track)

## Written summary (100–200 words)

Rhinalx is a local-first **rationale memory** for bench scientists. A lab notebook
records *what* happened — the dose, the antibody, the cohort — but the reasoning
behind those decisions lives in the PI's head, meeting notes, and Slack, and it
evaporates. Rhinalx captures it as structured, source-traceable memory and answers
the two questions that bite a researcher: *"Why did we change this?"* and *"Have we
ruled this out before?"* It ingests protocols, notebook entries, and meeting notes;
extracts decision episodes with exact evidence spans; and — its signature move —
**proactively interviews the scientist when it notices rationale is missing** (an
unexplained Gal-3 antibody swap), filing the answer as cited memory. Every claim
carries a provenance chip back to its source span; when it cannot cite, it refuses
rather than guesses. Superseded decisions are archived, never deleted. Reasoning runs
on **Claude**, with a local Ollama fallback so unpublished data never has to leave the
machine. Built with Claude Code during the 2026 Built with Claude: Life Sciences
hackathon.

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
