# Rhinalx - 3-minute demo script

Lead with the outcome, not the architecture. Open on the pain, then show the product
answering it. Do NOT say "agentic memory" on camera. Say what it does for a scientist.

Setup before recording:
- Seed the scripted study: `uv run python scripts/demo.py --seed`
- Light theme, window ~1200px wide, other tabs closed.
- Do NOT demo the live protocols.io API or an empty app on camera.

---

## 0:00-0:18  Cold open (the "six months later" story)

Voice over a slow scroll of a protocol document:

> "Six months later, you open your protocol.
> The dose changed. The antibody changed. Two animals disappeared from the analysis.
> Nobody remembers why. The postdoc graduated, the supervisor moved institutions,
> the Slack messages are gone - and the paper is due next week.
>
> Your notebook remembers WHAT you did. Rhinalx remembers WHY."

Cut to the Rhinalx study overview.

## 0:18-1:05  It noticed the hole - and asked (the headline)

Click **Open Questions**.

> "On ingest, Rhinalx read the lab's own notes and noticed something: cohort 3 swapped
> the Gal-3 antibody - and never recorded why. So it asked."

Type a one-line reason, submit.

> "That answer is now memory, in the scientist's own words, with provenance.
> A search tool waits to be asked. This fills the hole before it closes."

## 1:05-1:50  Reconstruct the why, cited

Click **Ask** -> "Why did we drop the LPS dose in cohort 3?"

> "The answer isn't in the protocol - it only states the new dose. Rhinalx reconstructs
> it across the pilot notebook and the meeting note..."

Click a provenance chip.

> "...and every claim points back to its exact source. If it can't cite it, it refuses -
> because a confident wrong answer about your own science is worse than an honest gap."

## 1:50-2:25  Have we been here before?

Click **Precedent**.

> "It also asks the question a tired scientist forgets to: have we ruled this out before?
> Here it surfaces an earlier exclusion with the same pattern, and explains the resemblance -
> both cases cited. The lab stops re-litigating settled calls."

## 2:25-2:55  It knows what's still true

Show **Knowledge** then **Archive**.

> "When a decision is superseded, the old reasoning isn't deleted - it's archived and
> weighted down. Current answers reflect current thinking; the history is one click away."

(Optional, only if time and steady: the Deviation "gap that looked filled" beat.)

## 2:55-3:05  Close

> "Local-first: your unpublished data never has to leave the machine.
> Your notebook remembers what. Rhinalx remembers why."

---

## Notes
- If a Claude call is slow, keep talking over it - never sit in silence.
- Beats 1-3 run on the seeded study. Record the Deviation beat as a SEPARATE take
  (different dataset) and edit it in, or cut it. Beats 1-3 are a complete story alone.
- One product, one name: Rhinalx. Do not mention an engine/platform split.
