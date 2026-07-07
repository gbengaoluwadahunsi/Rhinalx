# Rhinalx — Full UI Design Prompt (landing + 26 screens)

Paste this into your design tool (Claude Design, v0, Figma AI, or Claude Code with
the frontend-design skill). It specifies a complete design system and every screen.
Design tokens are named so they map cleanly to a Tailwind config.

Screens tagged **⭐DEMO** are the only ones needed for the 3-minute hackathon demo —
design the rest for the landing page and product vision, but build the ⭐ set first.

---

## 0. Your role & deliverable

You are a senior product designer. Design a cohesive, distinctive UI for **Rhinalx**,
a local-first research rationale-memory app for bench scientists. Deliver a design
system (tokens + reusable components) and high-fidelity screens for every screen listed
in section 6. Keep it consistent, accessible (WCAG AA), and desktop-first (the app is a
focused workspace); the public/landing pages are responsive.

---

## 1. Product & audience

**What it is:** Rhinalx remembers *why* research decisions were made. A lab notebook
records *what* happened (a dose, an antibody, a cohort); the *why* evaporates. Rhinalx
ingests protocols, notebook entries, and meeting notes, and it: reconstructs the reasoning
behind any decision with every claim traceable to a source; surfaces precedent ("have we
ruled this out before?"); and — its signature move — proactively **interviews the
scientist for rationale it notices is missing**. It runs entirely on the scientist's own
machine (local-first), because the data is unpublished and sensitive.

**Primary user:** a PhD student / bench scientist running a multi-cohort study.
**Secondary:** their supervisor, and the next student who inherits the project.

**Emotional job:** make the scientist feel their reasoning is *safe, recoverable, and
trustworthy* — never lost, never guessed at.

---

## 2. Art direction

**Mood:** "A scientist's memory, made trustworthy." Calm, precise, archival, quietly
confident. Ink on good paper. Provenance-forward. This is a rigor tool, not a hype-y AI
SaaS.

**Reference points to borrow from:** Linear (restraint, keyboard-first precision,
crisp hierarchy), Obsidian (local-first knowledge, quiet density), Zotero/Readwise
(source-centric, citation as a first-class object), and the typographic seriousness of a
scientific journal.

**The palimpsest metaphor drives the visual language:** layers where older writing stays
readable beneath newer. Use it literally — superseded rationale is dimmed and set
*behind* current knowledge, never deleted. Timelines read as strata.

**Avoid:** gradient-heavy hero blobs, purple-on-black "AI" clichés, glassmorphism,
oversized rounded bubbles, emoji, playful mascots, drop-shadow soup. Restraint over
decoration. If a shadow can be a 1px hairline instead, make it a hairline.

---

## 3. Design system

### Color (light theme is primary; also provide a dark theme)
- `ink` #1A1A17 — primary text (warm near-black, like ink not pure black)
- `ink-soft` #4A4740 — secondary text
- `ink-faint` #8A867C — metadata, timestamps
- `paper` #FAF8F3 — app background (warm off-white, lab-notebook)
- `surface` #FFFFFF — cards
- `surface-sunk` #F3F0E8 — insets, code/source wells
- `line` #E7E3D9 — hairline borders
- `primary` #10726B — deep ink-teal = **current / living knowledge**, primary actions
- `primary-soft` #E0EFED — primary tint backgrounds
- `attention` #B8791E — gold = **open questions / rationale gaps** (an invitation, not an error)
- `attention-soft` #FBF1DD — open-question card backgrounds
- `link` #4C5FD5 — muted indigo = **precedent & connections** between records
- `citation` #F3ECC9 — pale highlighter for source spans that ground a claim
- `archive` #9A7B3C — ochre tag for superseded/archived items (rendered ~55% opacity)
- `danger` #B23A2E — reserve strictly for destructive confirms (rare; nothing truly deletes)
- Local/offline status dot: a calm green #3E9B6E

Semantic use, non-negotiable: teal = current knowledge, gold = a gap to fill, indigo =
a link/precedent, ochre + dimming = archived-but-readable, pale-yellow = a cited source
span. Keep these meanings consistent on every screen.

### Typography
- **Spectral** (serif) — headings, and all *rationale / answer prose*. The serif signals
  scholarship and makes generated reasoning feel considered, not chatbot-y.
- **IBM Plex Sans** — all UI: labels, buttons, nav, metadata.
- **IBM Plex Mono** — source excerpts, span references, IDs, dates, model names. Mono for
  verbatim source text reinforces "this is exact, traceable."
Type scale (px): 40/32/24/20 headings (Spectral), 16 body, 15 rationale, 14 UI, 13
metadata, 12.5 mono spans. Generous line-height (1.55) on rationale prose.

### Space, shape, depth, motion
- 4px base unit; 8-pt rhythm. Roomy but dense — a workspace, not a marketing page.
- Radius 6px (precise, not bubbly); 8px for modals.
- Depth via 1px hairline borders first; shadows only for overlays/popovers, and soft.
- Motion is subtle and *meaningful*: episodes visibly **merge into** a consolidated
  rationale card; archived items **fade and recede** a layer back; a newly answered open
  question settles into the knowledge library. 150–220ms, ease-out. No bounce.
- Icons: Lucide, 1.5px stroke. Line only, never filled.
- Keyboard-first: a ⌘K command palette; every primary action has a shortcut.

---

## 4. Signature components (design these once, reuse everywhere)

1. **Provenance chip** — an inline mono chip, e.g. `protocol_v3 · §dose`, attached to every
   factual claim. Hover/click expands a popover showing the exact source span highlighted
   in `citation` yellow, with doc title + date. This is the soul of the product; make it
   beautiful and unmissable. A claim with no chip should look *wrong*.
2. **Backend badge** — a small pill showing which model answered: `Claude` (primary teal)
   or `Local` (neutral). Honest, and a demo asset. Sits on answers and open-question cards.
3. **Offline / on-this-machine indicator** — a calm green dot + "On this machine" in the
   top bar. Reinforces local-first at all times.
4. **Rationale card** — a card holding a consolidated *why*, in Spectral, with its
   supporting provenance chips and a `current`/`archived` state.
5. **Open-question card** — gold-edged (`attention`). The agent's question shown in Spectral
   (it "speaks"), an answer field below, and the decision it refers to linked. Reused in the
   inbox and the interview modal.
6. **Decision node** — a timeline/graph node for a decision (dose change, exclusion, swap),
   with version + date + a state dot (current teal / superseded ochre).
7. **Source-span viewer** — a document rendered with grounding spans highlighted; clicking a
   provenance chip anywhere scrolls to and pulses its span here.
8. **Empty states** — warm, instructive, never blank. Each names the next action.

---

## 5. Global layout

- **Left rail:** project switcher at top; nav — Home, Ask, Open Questions (with a gold count
  badge), Timeline, Knowledge, Archive, Sources, Search. Collapsible.
- **Top bar:** current study name + version context, ⌘K search, offline indicator, backend
  policy toggle (Claude-when-allowed / Local-only), settings.
- **Main canvas:** one focused surface per screen. Right-side contextual panel (provenance,
  related precedents) slides in rather than crowding the main column.

---

## 6. Screen inventory (26)

### A. Public / marketing (responsive)
1. **Landing / hero** — headline on the core promise ("Your lab remembers *what*. Rhinalx
   remembers *why*."). Show the product's real moment: a query reconstructing a decision with
   provenance chips. Sections: the three capabilities (reconstruct why / surface precedent /
   interview for gaps), the local-first guarantee, the neuroscience-grounded story, CTA to
   download. Anti-hype, screenshot-led.
2. **How it works** — the pipeline as a calm narrative: ingest → detect gaps → interview →
   answer with sources → surface precedent. Diagrammatic, not busy.
3. **Data governance / security** — the buyer's screen: "your unpublished data never leaves
   this machine." Local-first architecture diagram, Claude-only-when-you-allow explanation,
   no-telemetry promise. Serious, trust-building.
4. **The science** — the neuroscience-grounded memory story (episodic capture, consolidation,
   adaptive forgetting, indexing) mapped to what the app does. Positions the moat.
5. **Use cases / who it's for** — bench scientist, PI, incoming student; the pains each feels.

### B. Onboarding / setup
6. **Welcome / first-run** — one-line value, "everything stays on your machine," Begin.
7. **Local model check** ⭐DEMO-adjacent — detect Ollama + required models
   (`nomic-embed-text`, `llama3.1:8b`); status rows with fix hints; choose policy
   (Claude when allowed / Local only). Shows local-first is real.
8. **Create a study** — name the project, point at a folder; empty, inviting.
9. **Ingest sources — drop zone** ⭐DEMO — big warm dropzone for protocols/notebooks/notes;
   list of accepted types; "nothing uploaded anywhere — read locally" reassurance.
10. **Ingest — processing** ⭐DEMO — live progress: documents parsed, **decisions (episodes)
    extracted**, spans indexed. Make extraction visible and a little delightful.
11. **Ingest — review extracted decisions** — confirm the episodes found (dose change,
    exclusion, antibody swap); edit/merge; this is where the corpus becomes memory.

### C. Core workspace
12. **Home / dashboard** ⭐DEMO — study overview: counts (sources, decisions, current
    rationale), a prominent **Open Questions** callout, recent activity, jump-to-Ask.
13. **Ask** ⭐DEMO — the question box (Spectral placeholder: "Why did we…"), recent
    questions, example prompts. The front door to Beat 2.
14. **Answer detail** ⭐DEMO — a reconstructed *why* in Spectral prose, **every claim carrying
    a provenance chip**, expandable source spans, backend badge, "sources: 2" summary. The
    hero screen — polish this most.
15. **Open Questions inbox** ⭐DEMO — the gold-edged cards for rationale the agent found
    missing (e.g. the unexplained antibody swap). Count, filters, "answer now."
16. **Interview modal** ⭐DEMO — a single open question: the agent's question in Spectral, the
    referenced decision linked, an answer field; on submit it visibly files into Knowledge
    with provenance = the scientist's words. Beat 1's payoff.
17. **Decision timeline** — a study's decisions as strata over time (protocol v1→v2→v3,
    exclusions, swaps); current teal vs superseded ochre; filter by type.
18. **Decision detail** — one decision: what changed, its *why* (or a gold "no rationale —
    answer now"), source spans, and related precedents in the side panel.
19. **Precedent view** ⭐DEMO — "have we done this before?" results: the current case and the
    matched prior case side-by-side, the resemblance explained (indigo `link` accenting),
    both cited. Beat 3.
20. **Knowledge / rationale library** — the consolidated semantic layer: current stable
    rationale as cards, grouped by theme, each with supporting episodes and chips.
21. **Archive (the palimpsest)** — superseded rationale, dimmed to ~55% and set a layer
    behind, ochre `archived` tags, still fully readable and searchable. The metaphor made
    literal. "Nothing is deleted" stated plainly.
22. **Source document viewer** — a single ingested doc with grounding spans highlighted;
    provenance chips elsewhere deep-link here and pulse the span.
23. **Global search** — across sources, decisions, rationale, archive; results typed and
    provenance-first; ⌘K entry.
24. **Provenance / memory map** — a graph of decisions ↔ sources ↔ consolidated rationale
    (the hippocampal-index idea visualized). A strong, distinctive demo visual; keep it
    legible, not a hairball.
25. **Settings** — models & policy (with the live backend badge), data location, export the
    whole memory as one portable file, theme. Reinforce "one auditable local artifact."
26. **Project switcher / studies** — list of studies with quick stats; new study; the
    multi-project entry point.

---

## 7. Consistency & accessibility rules
- Every generated claim shows a provenance chip. No uncited assertions, anywhere.
- Semantic colors never drift: teal=current, gold=gap, indigo=precedent, ochre+dim=archived,
  yellow=cited span.
- Rationale/answer prose is always Spectral; source excerpts always IBM Plex Mono.
- The offline indicator and backend badge are always visible on any screen that reasons.
- WCAG AA contrast; don't encode meaning by color alone (pair with label/icon/state dot).
- Provide both light (primary) and dark themes from the same tokens.

## 8. Build priority for the hackathon
Design all 26 for the vision, but if time is short, produce these to a high polish first —
they are the entire demo: **9, 10, 12, 13, 14, 15, 16, 19** (ingest → dashboard → ask →
answer-with-provenance → open questions → interview → precedent). Everything else can be
lower-fidelity or landing-only.
