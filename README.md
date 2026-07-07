# Demo dataset — Rhinalx (bench-scientist rationale memory)

A small, hand-built synthetic research record for a Gal-3 / LPS neuroinflammation
study (mirrors a real Alzheimer's model). Everything here is synthetic — safe to
publish, no unpublished or animal-identifying data. It is engineered so the three
demo beats land cleanly. **Swap in your own de-identified thesis entries later for
maximum authenticity, but this runs the demo on its own.**

## Files
| File | Type | Role in demo |
|------|------|--------------|
| `protocol_LPS-AD_v1.md` | protocol v1 | baseline |
| `protocol_LPS-AD_v2.md` | protocol v2 | n increased, NOR habituation (rationale recorded inline) |
| `protocol_LPS-AD_v3.md` | protocol v3 | **dose change 1 mg/kg → 250 µg/kg, no inline reason** |
| `notebook_pilot_2024-10-30.md` | notebook | pilot mortality at 1 mg/kg (half the "why") |
| `meeting_2024-11-12.md` | meeting note | dose-reduction decision + rationale (other half of the "why") |
| `notebook_cohort3_2025-01-15.md` | notebook | **antibody swap with NO recorded reason** |
| `exclusion_pilot_2024-10-28.md` | decision | pilot exclusion, visual/sensorimotor cause (precedent source) |
| `exclusion_cohort3_2025-02-03.md` | decision | cohort-3 exclusion, same pattern (precedent query) |

## The three designed demo beats

**Beat 1 — proactive interview (headline Claude feature).**
On ingest, the agent should detect that `notebook_cohort3_2025-01-15.md` records a
Gal-3 antibody swap (Abcam ab209344 → Novus NBP2-27373) with no rationale anywhere in
the corpus, and *interview the scientist*: "You switched the Gal-3 ELISA antibody for
cohort 3 but there's no recorded reason — what happened?" The captured answer is stored
with provenance and becomes queryable.

**Beat 2 — "why did we change this?" (reconstruction with provenance).**
Query: *"Why did we drop the LPS dose in cohort 3?"* The answer is NOT in protocol v3
(which only states the new dose). The engine must reconstruct it from two sources:
`notebook_pilot_2024-10-30.md` (2/8 mortality, ~18% weight loss at 1 mg/kg) and
`meeting_2024-11-12.md` (decision + literature rationale). Every claim cites its source.

**Beat 3 — precedent surfacing.**
Query: *"Have we excluded an animal for this reason before?"* against
`exclusion_cohort3_2025-02-03.md`. The engine should surface `exclusion_pilot_2024-10-28.md`
(EXC-2024-01) — same pattern (fails cued/visible-platform trials → suspected
visual/sensorimotor impairment) — and explain the resemblance, with the prior reason shown.

## Provenance rule
Every generated answer must cite the specific file(s) and span(s) it rests on. If a
claim can't be traced to a source here, the engine should say so rather than guess.
