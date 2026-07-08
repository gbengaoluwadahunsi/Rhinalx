import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStudy } from '../api'
import type { Study } from '../types'
import { Icon, Logo, ThemeToggle } from '../ui'

export function LandingScreen() {
  const [study, setStudy] = useState<Study | null>(null)
  useEffect(() => { getStudy().then(setStudy).catch(() => {}) }, [])

  const acts = [
    {
      step: '01',
      tag: 'It asks',
      title: 'The unrecorded swap.',
      body: "On ingest, Rhinalx notices cohort 3's notebook logs a Gal-3 antibody swap with no recorded reason, then opens the question before the memory closes.",
      card: (
        <>
          <p className="font-serif text-[19px] italic leading-snug text-[#0E2A20] dark:text-[#F4F1E8]">"You switched the Gal-3 ELISA antibody (Abcam ab209344 to Novus NBP2-27373) for cohort 3, but there's no recorded reason. What happened?"</p>
          <div className="mt-4 rounded-lg border border-[#BFE0CE] bg-[#E3F1E9] p-3 font-mono text-[12px] leading-relaxed text-[#2B3A32] dark:border-[#2B5844] dark:bg-[#173D31] dark:text-[#D2CCBD]"><span className="mb-1 block text-[10px] uppercase tracking-[.14em] text-[#12805A] dark:text-[#62D0A8]">Your answer, captured</span>Abcam ab209344 gave inconsistent standard curves on cohort-2 plates; Novus NBP2-27373 is validated for rat Gal-3 with lower background.</div>
        </>
      ),
    },
    {
      step: '02',
      tag: 'It reconstructs',
      title: 'The reason, recovered.',
      body: 'The answer is assembled across two sources: the pilot mortality data and the meeting note citing the literature. Sources stay inline, never merged into an opaque paragraph.',
      card: (
        <>
          <p className="font-sans text-[18px] font-semibold leading-snug text-[#0E2A20] dark:text-[#F4F1E8]">Why did we drop the LPS dose in cohort 3?</p>
          <p className="mt-3 font-serif text-[16px] leading-relaxed text-[#2B3A32] dark:text-[#D2CCBD]">Reduced from <b>1 mg/kg to 250 ug/kg</b> after 2/8 pilot mortality at the higher dose; the meeting note records the decision and its literature basis.</p>
          <div className="mt-4 space-y-2 border-t border-dashed border-[#D8E4DA] pt-3 font-mono text-[12px] text-[#61756B] dark:border-[#2B3A32] dark:text-[#918A7B]"><p><span className="rounded-full border border-[#BFE0CE] bg-[#E3F1E9] px-2 py-0.5 text-[#12805A] dark:border-[#2B5844] dark:bg-[#173D31] dark:text-[#62D0A8]">notebook_pilot</span> 2/8 mortality, ~18% weight loss at 1 mg/kg</p><p><span className="rounded-full border border-[#BFE0CE] bg-[#E3F1E9] px-2 py-0.5 text-[#12805A] dark:border-[#2B5844] dark:bg-[#173D31] dark:text-[#62D0A8]">meeting_note</span> 250 ug/kg reported reliable, low mortality</p></div>
        </>
      ),
    },
    {
      step: '03',
      tag: 'It remembers precedent',
      title: 'Seen this before.',
      body: 'Rhinalx surfaces an earlier pilot exclusion with the same pattern and explains why the two cases resemble each other, prior reason attached.',
      card: (
        <>
          <p className="font-sans text-[18px] font-semibold leading-snug text-[#0E2A20] dark:text-[#F4F1E8]">Have we excluded an animal for this reason before?</p>
          <p className="mt-3 font-serif text-[16px] leading-relaxed text-[#2B3A32] dark:text-[#D2CCBD]">Yes: <b>pilot exclusion EXC-2024-01</b> (P-04, P-07). Same signature: fails the cued visible-platform trials, suspected visual or sensorimotor cause, retained for ELISA/histology.</p>
          <div className="mt-4 font-mono text-[12px] text-[#61756B] dark:text-[#918A7B]"><span className="rounded-full border border-[#BFE0CE] bg-[#E3F1E9] px-2 py-0.5 text-[#12805A] dark:border-[#2B5844] dark:bg-[#173D31] dark:text-[#62D0A8]">precedent_link</span> resemblance explained by Claude, ~90% match</div>
        </>
      ),
    },
  ]

  const mechanisms = [
    ['01 / episodic', 'Decision capture', 'Every decision event is extracted with evidence spans. Never an actor, date, or change that is not in the source.'],
    ['02 / interview', 'Gap detection', 'Decisions with no rationale anywhere in the corpus are flagged, turned into a question, and asked.'],
    ['03 / semantic', 'Consolidation', 'Related episodes cluster into stable rationale, tagged back to the episodes that support it.'],
    ['04 / forgetting', 'Adaptive forgetting', 'When a newer decision supersedes an older one, the old call loses retrieval weight, not existence.'],
    ['05 / indexing', 'Span-level index', 'The index points to exact source spans, so provenance is structural, not opaque chunks.'],
    ['-- / honesty', 'Cited, or silent', 'When the record cannot support an answer, Rhinalx says insufficient evidence rather than guessing.'],
  ]

  return (
    <main className="min-h-screen bg-[#FBFDFB] text-[#2B3A32] [font-family:Spectral,Georgia,serif] dark:bg-[#111A16] dark:text-[#D2CCBD]">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto grid max-w-[1460px] items-center gap-6 px-4 py-7 sm:px-8 lg:px-6 lg:py-9 2xl:grid-cols-[minmax(0,1fr)_minmax(620px,.96fr)]">
          <a href="#top" className="group flex items-center gap-3 font-sans text-[18px] font-bold tracking-[-.01em] text-[#0E2A20] dark:text-[#F4F1E8]">
            <Logo size={30} className="flex-none transition-transform group-hover:-translate-y-0.5" />
            <span>Rhinalx</span>
          </a>
          <nav aria-label="Landing page" className="hidden items-center justify-self-end rounded-full border border-[#D8E4DA]/90 bg-white/80 px-2 py-2 font-mono text-[11px] uppercase tracking-[.16em] text-[#61756B] shadow-[0_18px_40px_-34px_rgba(14,42,32,.38)] backdrop-blur md:flex dark:border-[#2B3A32] dark:bg-[#17231D]/80 dark:text-[#D2CCBD] dark:shadow-[0_18px_40px_-30px_rgba(0,0,0,.6)]">
            <a href="#gap" className="rounded-full px-4 py-2 transition-colors hover:bg-[#E3F1E9] hover:text-[#12805A] dark:hover:bg-[#173D31] dark:hover:text-[#62D0A8]">The gap</a>
            <a href="#room" className="rounded-full px-4 py-2 transition-colors hover:bg-[#E3F1E9] hover:text-[#12805A] dark:hover:bg-[#173D31] dark:hover:text-[#62D0A8]">How it works</a>
            <a href="#engine" className="rounded-full px-4 py-2 transition-colors hover:bg-[#E3F1E9] hover:text-[#12805A] dark:hover:bg-[#173D31] dark:hover:text-[#62D0A8]">The engine</a>
            <a href="#trust" className="rounded-full px-4 py-2 transition-colors hover:bg-[#E3F1E9] hover:text-[#12805A] dark:hover:bg-[#173D31] dark:hover:text-[#62D0A8]">Local-first</a>
            <ThemeToggle />
            <Link to="/app" className="ml-1 rounded-full bg-[#12805A] px-4 py-2 text-white transition-colors hover:bg-[#0C5C40] dark:bg-[#173D31] dark:text-[#62D0A8] dark:hover:bg-[#1E4C3D]">Open the app</Link>
          </nav>
        </div>
      </header>

      <section id="top" className="relative flex min-h-[100svh] items-start overflow-hidden px-6 pb-10 pt-[6.5rem] before:absolute before:inset-0 before:bg-[linear-gradient(#E6EFE7_1px,transparent_1px),linear-gradient(90deg,#E6EFE7_1px,transparent_1px)] before:bg-[size:100%_34px,34px_100%] before:opacity-60 sm:px-10 lg:pb-12 lg:pt-[7.5rem] dark:before:bg-[linear-gradient(#1B2A22_1px,transparent_1px),linear-gradient(90deg,#1B2A22_1px,transparent_1px)] dark:before:opacity-70">
        <div className="relative z-10 mx-auto grid w-full max-w-[1160px] items-start gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(480px,.82fr)] xl:gap-24">
          <div className="max-w-[760px] xl:pr-4">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[.2em] text-[#12805A] sm:text-[12px] dark:text-[#62D0A8]">Local-first memory <span className="text-[#B4862A] dark:text-[#E3B45F]">/</span> Built with Claude for life sciences</p>
            <h1 className="mt-5 font-sans text-[clamp(2.3rem,4vw,3.35rem)] font-bold leading-[1.06] tracking-[-.03em] text-[#0E2A20] xl:text-[clamp(2.4rem,3vw,2.95rem)] dark:text-[#F4F1E8]">
              <span className="block">Your notebook</span>
              <span className="block">remembers <span className="text-[#8A9A90] line-through decoration-[#12805A] decoration-[3px] dark:text-[#918A7B] dark:decoration-[#62D0A8]">what</span>.</span>
              <span className="block">Rhinalx remembers <span className="relative whitespace-nowrap text-[#12805A] after:absolute after:inset-x-0 after:bottom-[.06em] after:-z-10 after:h-[.16em] after:rounded-sm after:border-b-2 after:border-[#B4862A] after:bg-[#F3E9CE] dark:text-[#62D0A8] dark:after:border-[#E3B45F] dark:after:bg-[#3A2C16]">why</span>.</span>
            </h1>
            <p className="mt-5 max-w-[42em] text-[clamp(1rem,1.22vw,1.12rem)] leading-[1.62] text-[#61756B] dark:text-[#D2CCBD]">A memory for the <strong className="font-semibold text-[#21372F] dark:text-[#F4F1E8]">reasoning behind every research decision</strong>: the dose you dropped, the antibody you swapped, the animal you excluded. Every answer traced to its source. Superseded calls are archived, never deleted.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/app" className="inline-flex items-center gap-2 rounded-lg bg-[#12805A] px-5 py-3 font-mono text-[12px] uppercase tracking-[.1em] text-white shadow-[0_10px_26px_-12px_rgba(18,128,90,.7)] hover:bg-[#0C5C40] dark:bg-[#173D31] dark:text-[#62D0A8] dark:shadow-[0_10px_26px_-12px_rgba(0,0,0,.7)] dark:hover:bg-[#1E4C3D]">Open the app</Link>
              <a href="#room" className="inline-flex items-center rounded-lg border border-[#D8E4DA] px-5 py-3 font-mono text-[12px] uppercase tracking-[.1em] text-[#61756B] transition-colors hover:border-[#12805A] hover:text-[#12805A] dark:border-[#2B3A32] dark:text-[#918A7B] dark:hover:border-[#62D0A8] dark:hover:text-[#62D0A8]">See how it works</a>
              <span className="ml-1 font-mono text-[12px] tracking-[.06em] text-[#61756B] dark:text-[#918A7B]">Runs entirely offline</span>
            </div>
          </div>

          <div className="relative w-full max-w-[700px] justify-self-end overflow-hidden rounded-xl border border-[#D8E4DA] bg-white shadow-[0_44px_74px_-48px_rgba(14,42,32,.45),0_2px_0_#D8E4DA] before:absolute before:inset-0 before:bg-[linear-gradient(#E6EFE7_1px,transparent_1px)] before:bg-[size:100%_30px] before:opacity-70 after:absolute after:bottom-0 after:left-[52px] after:top-0 after:w-px after:bg-[#B4862A] after:opacity-50 xl:-mt-1 dark:border-[#2B3A32] dark:bg-[#17231D] dark:shadow-[0_44px_74px_-48px_rgba(0,0,0,.7),0_2px_0_#2B3A32] dark:before:bg-[linear-gradient(#1B2A22_1px,transparent_1px)] dark:after:bg-[#E3B45F] dark:after:opacity-40">
            <div className="relative max-h-[calc(100svh-10.75rem)] min-h-[500px] overflow-hidden p-6 pl-16 sm:max-h-[calc(100svh-9.75rem)] sm:min-h-[520px] sm:p-7 sm:pl-20">
              <div className="mb-4 flex items-center justify-between border-b border-[#D8E4DA] pb-3 font-mono text-[11px] uppercase tracking-[.14em] text-[#8A9A90] dark:border-[#2B3A32] dark:text-[#918A7B]"><span className="font-medium text-[#12805A] dark:text-[#62D0A8]">Protocol v{study?.version ?? 3} - LPS-AD</span><span>amended 2024-11-20</span></div>

              <div className="grid gap-4 lg:grid-cols-[1fr_150px]">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[.14em] text-[#8A9A90] dark:text-[#918A7B]">Protocol change - cohort 3</p>
                  <p className="mt-2 font-sans text-[clamp(1.45rem,2.2vw,1.9rem)] font-bold leading-tight tracking-[-.02em] text-[#0E2A20] dark:text-[#F4F1E8]"><span className="mr-2 text-[#61756B] line-through decoration-[#12805A] decoration-2 dark:text-[#918A7B] dark:decoration-[#62D0A8]">1 mg/kg</span>250 ug/kg LPS</p>
                  <p className="mt-2 font-mono text-[11px] tracking-[.02em] text-[#B4862A] dark:text-[#E3B45F]">corrected - single line, initialled ZA, dated. never erased.</p>
                </div>
                <div className="hidden border-l border-dashed border-[#D8E4DA] pl-4 font-mono text-[10px] uppercase tracking-[.12em] text-[#8A9A90] lg:block dark:border-[#2B3A32] dark:text-[#918A7B]">
                  <p>animal model</p>
                  <p className="mt-2 text-[#12805A] dark:text-[#62D0A8]">LPS-AD / PVO</p>
                  <p className="mt-5">status</p>
                  <p className="mt-2 text-[#B4862A] dark:text-[#E3B45F]">supersedes v{(study?.version ?? 3) - 1}</p>
                </div>
              </div>

              <div className="mt-5 border-t border-[#D8E4DA] pt-4 dark:border-[#2B3A32]">
                <p className="font-mono text-[11px] uppercase tracking-[.14em] text-[#8A9A90] dark:text-[#918A7B]">Observation log</p>
                <div className="mt-3 space-y-1.5 font-mono text-[12px] leading-[1.6] text-[#2B3A32] dark:text-[#D2CCBD]">
                  <p><span className="text-[#8A9A90] dark:text-[#918A7B]">09:10</span> pilot animals at 1.0 mg/kg show early weight-loss signal by day 4.</p>
                  <p><span className="text-[#8A9A90] dark:text-[#918A7B]">10:35</span> endpoints reached in 2 of 8; cohort contrast no longer clean.</p>
                  <p><span className="text-[#8A9A90] dark:text-[#918A7B]">14:20</span> supervisor recommends lower dose while retaining endotoxin effect.</p>
                </div>
              </div>

              <div className="mt-5 border-t border-[#D8E4DA] pt-4 dark:border-[#2B3A32]">
                <p className="inline-block font-mono text-[11px] uppercase tracking-[.14em] text-[#12805A] underline decoration-[#F3E9CE] decoration-[6px] underline-offset-[-2px] dark:text-[#62D0A8] dark:decoration-[#3A2C16]">Why - recovered by Rhinalx</p>
                <p className="mt-3 font-serif text-[15px] leading-[1.52] text-[#2B3A32] dark:text-[#D2CCBD]">Dose was reduced after pilot tolerability failed at the published level. The change preserves the inflammatory challenge but avoids repeating the mortality pattern already seen in the pilot.</p>
                <div className="mt-3 space-y-1.5 font-mono text-[12px] leading-[1.55] text-[#2B3A32] dark:text-[#D2CCBD]">
                  <p><span className="font-medium text-[#12805A] dark:text-[#62D0A8]">[notebook_pilot - 2024-10-30]</span> mortality at 1 mg/kg in 2 of 8; weight loss approx. 18%.</p>
                  <p><span className="font-medium text-[#B4862A] dark:text-[#E3B45F]">[meeting_note - 2024-11-12]</span> 250 ug/kg reported reliable with low mortality; retain endotoxin effect, re-baseline cohort 3.</p>
                  <p><span className="font-medium text-[#12805A] dark:text-[#62D0A8]">[protocol_v3 - change log]</span> cohort 3 amended to 250 ug/kg; earlier rationale retained in archive.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section id="gap" className="px-6 py-20 sm:px-10 lg:py-28"><div className="mx-auto max-w-[1160px]"><p className="mb-5 flex items-center gap-3 font-mono text-[12px] uppercase tracking-[.2em] text-[#12805A] before:h-[2px] before:w-6 before:bg-[#B4862A] dark:text-[#62D0A8] dark:before:bg-[#E3B45F]">The problem</p><h2 className="max-w-[16em] font-sans text-[clamp(1.9rem,3.8vw,3rem)] font-bold leading-[1.06] tracking-[-.025em] text-[#0E2A20] dark:text-[#F4F1E8]">The notebook keeps the record. It loses the <em className="not-italic text-[#12805A] dark:text-[#62D0A8]">reasons</em>.</h2><div className="mt-10 grid gap-10 lg:grid-cols-[1fr_.9fr]"><p className="text-[18px] leading-[1.78] text-[#61756B] dark:text-[#D2CCBD]">You logged the dose, the antibody, the cohort, the date. You didn't log why the dose dropped between cohorts, why two animals were excluded, why a reagent was swapped. <b className="font-semibold text-[#2B3A32] dark:text-[#F4F1E8]">That reasoning lives in your head, in a meeting note, in a Slack thread, and it evaporates.</b></p><div className="overflow-hidden rounded-xl border border-[#D8E4DA] bg-white font-mono text-[13px] dark:border-[#2B3A32] dark:bg-[#17231D]">{['Recorded|dose - antibody - cohort - date','Lost|why it changed','Lost|what you ruled out','Lost|what you would never repeat'].map((row, i) => { const [k, v] = row.split('|'); return <div key={row} className={`grid grid-cols-[auto_1fr] gap-4 border-b border-[#D8E4DA] px-5 py-4 last:border-b-0 dark:border-[#2B3A32] ${i === 0 ? 'bg-[#E3F1E9] dark:bg-[#173D31]' : ''}`}><span className={`text-[11px] uppercase tracking-[.12em] ${i === 0 ? 'text-[#12805A] dark:text-[#62D0A8]' : 'text-[#B4862A] dark:text-[#E3B45F]'}`}>{k}</span><span className={i === 0 ? 'text-[#0E2A20] dark:text-[#F4F1E8]' : 'font-serif italic text-[#8A9A90] dark:text-[#918A7B]'}>{v}</span></div> })}</div></div></div></section>

      <section className="border-y border-[#D8E4DA] bg-[#F1F6F1] px-6 py-20 sm:px-10 lg:py-28 dark:border-[#2B3A32] dark:bg-[#0D1511]"><div className="mx-auto max-w-[1160px]"><p className="mb-5 flex items-center gap-3 font-mono text-[12px] uppercase tracking-[.2em] text-[#12805A] before:h-[2px] before:w-6 before:bg-[#B4862A] dark:text-[#62D0A8] dark:before:bg-[#E3B45F]">What it answers</p><h2 className="font-sans text-[clamp(1.9rem,3.8vw,3rem)] font-bold leading-[1.06] tracking-[-.025em] text-[#0E2A20] dark:text-[#F4F1E8]">Two questions that actually bite a scientist.</h2><div className="mt-10 grid gap-6 md:grid-cols-2">{[['Q1','Why did we change this?','Rhinalx reconstructs the full reasoning chain behind a decision with every claim cited to its source entry. If it cannot cite it, it does not say it.'],['Q2','Have we ruled this out before?','It surfaces precedent so the lab does not repeat a dead end or re-litigate a settled call, and explains the resemblance with the prior reason shown.']].map(([num,q,b]) => <article key={num} className="rounded-xl border border-[#D8E4DA] bg-white p-8 shadow-[0_20px_40px_-34px_rgba(14,42,32,.35)] dark:border-[#2B3A32] dark:bg-[#17231D] dark:shadow-[0_20px_40px_-34px_rgba(0,0,0,.6)]"><p className="font-mono text-[11px] uppercase tracking-[.14em] text-[#8A9A90] dark:text-[#918A7B]">{num}</p><h3 className="mt-4 font-sans text-[clamp(1.35rem,2.3vw,1.75rem)] font-semibold tracking-[-.02em] text-[#0E2A20] dark:text-[#F4F1E8]">{q}</h3><p className="mt-4 text-[17px] leading-[1.72] text-[#61756B] dark:text-[#D2CCBD]">{b}</p></article>)}</div></div></section>

      <section id="room" className="px-6 py-20 sm:px-10 lg:py-28"><div className="mx-auto max-w-[1160px]"><p className="mb-5 flex items-center gap-3 font-mono text-[12px] uppercase tracking-[.2em] text-[#12805A] before:h-[2px] before:w-6 before:bg-[#B4862A] dark:text-[#62D0A8] dark:before:bg-[#E3B45F]">The demo - in three steps</p><h2 className="max-w-[17em] font-sans text-[clamp(1.9rem,3.8vw,3rem)] font-bold leading-[1.06] tracking-[-.025em] text-[#0E2A20] dark:text-[#F4F1E8]">An agent that notices the <em className="not-italic text-[#12805A] dark:text-[#62D0A8]">holes</em> in your lab's memory, and fills them before they close.</h2><p className="mt-6 max-w-[40em] text-[18px] leading-[1.78] text-[#61756B] dark:text-[#D2CCBD]">Pure retrieval only answers what you already thought to write down. Rhinalx reads the record, spots the decision with no reason attached, and <b className="font-semibold text-[#2B3A32] dark:text-[#F4F1E8]">asks you</b>.</p><div className="mt-12 space-y-5">{acts.map((act) => <article key={act.step} className="grid items-center gap-6 rounded-xl border border-[#D8E4DA] bg-white p-6 shadow-[0_20px_44px_-40px_rgba(14,42,32,.35)] lg:grid-cols-[auto_.92fr_1.08fr] lg:p-8 dark:border-[#2B3A32] dark:bg-[#17231D] dark:shadow-[0_20px_44px_-40px_rgba(0,0,0,.6)]"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#BFE0CE] bg-[#E3F1E9] font-mono font-semibold text-[#12805A] dark:border-[#2B5844] dark:bg-[#173D31] dark:text-[#62D0A8]">{act.step}</div><div className="max-w-[760px] xl:pr-4"><p className="font-mono text-[11px] uppercase tracking-[.16em] text-[#B4862A] dark:text-[#E3B45F]">{act.tag}</p><h3 className="mt-3 font-sans text-[clamp(1.3rem,2.3vw,1.7rem)] font-semibold tracking-[-.02em] text-[#0E2A20] dark:text-[#F4F1E8]">{act.title}</h3><p className="mt-3 text-[17px] leading-[1.72] text-[#61756B] dark:text-[#D2CCBD]">{act.body}</p></div><div className="rounded-xl border border-[#D8E4DA] bg-[#FBFDFB] p-5 dark:border-[#2B3A32] dark:bg-[#0D1511]">{act.card}</div></article>)}</div></div></section>

      <section id="engine" className="border-y border-[#D8E4DA] bg-[#F1F6F1] px-6 py-20 sm:px-10 lg:py-28 dark:border-[#2B3A32] dark:bg-[#0D1511]"><div className="mx-auto max-w-[1160px]"><p className="mb-5 flex items-center gap-3 font-mono text-[12px] uppercase tracking-[.2em] text-[#12805A] before:h-[2px] before:w-6 before:bg-[#B4862A] dark:text-[#62D0A8] dark:before:bg-[#E3B45F]">The engine</p><h2 className="font-sans text-[clamp(1.9rem,3.8vw,3rem)] font-bold leading-[1.06] tracking-[-.025em] text-[#0E2A20] dark:text-[#F4F1E8]">Memory, modeled on <em className="not-italic text-[#12805A] dark:text-[#62D0A8]">memory</em>.</h2><p className="mt-6 max-w-[38em] text-[18px] leading-[1.78] text-[#61756B] dark:text-[#D2CCBD]">Rhinalx borrows how brains keep the past and maps each mechanism to a real function over your lab's record.</p><div className="mt-12 grid overflow-hidden rounded-xl border border-[#D8E4DA] bg-white md:grid-cols-2 dark:border-[#2B3A32] dark:bg-[#17231D]">{mechanisms.map(([idx,title,body], i) => <article key={idx} className={`border-b border-[#D8E4DA] p-7 transition-colors duration-200 md:odd:border-r dark:border-[#2B3A32] ${i === mechanisms.length - 1 ? 'bg-[#E3F1E9] hover:bg-[#D6EADD] dark:bg-[#173D31] dark:hover:bg-[#1E4C3D]' : 'hover:bg-[#E3F1E9] dark:hover:bg-[#173D31]'}`}><p className={`font-mono text-[11px] uppercase tracking-[.12em] ${i === mechanisms.length - 1 ? 'text-[#B4862A] dark:text-[#E3B45F]' : 'text-[#12805A] dark:text-[#62D0A8]'}`}>{idx}</p><h3 className="mt-3 font-sans text-lg font-semibold text-[#0E2A20] dark:text-[#F4F1E8]">{title}</h3><p className="mt-2 text-[16px] leading-[1.66] text-[#61756B] dark:text-[#D2CCBD]">{body}</p></article>)}</div></div></section>

      <section id="trust" className="px-6 py-20 sm:px-10 lg:py-28"><div className="mx-auto max-w-[1160px]"><p className="mb-5 flex items-center gap-3 font-mono text-[12px] uppercase tracking-[.2em] text-[#12805A] before:h-[2px] before:w-6 before:bg-[#B4862A] dark:text-[#62D0A8] dark:before:bg-[#E3B45F]">Local-first by design</p><h2 className="max-w-[14em] font-sans text-[clamp(1.9rem,3.8vw,3rem)] font-bold leading-[1.06] tracking-[-.025em] text-[#0E2A20] dark:text-[#F4F1E8]">Your unpublished data never leaves the machine.</h2><div className="mt-10 grid gap-6 md:grid-cols-3">{[['Offline by default','Runs entirely against a local store and local models. Unblinded results and unpublished data stay put.'],['Never deletes','Superseding archives a decision and lowers its weight. The record stays fully recoverable.'],['One auditable file','The whole lab memory is a single portable artifact, every claim traceable to document and span.']].map(([h,b], i) => { const TrustIcon = [Icon.knowledge, Icon.archive, Icon.doc][i]; return <article key={h} className="rounded-xl border border-[#D8E4DA] bg-white p-7 dark:border-[#2B3A32] dark:bg-[#17231D]"><div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-[#BFE0CE] bg-[#E3F1E9] text-[#12805A] dark:border-[#2B5844] dark:bg-[#173D31] dark:text-[#62D0A8]"><TrustIcon className="h-5 w-5" /></div><h3 className="font-sans text-xl font-semibold text-[#0E2A20] dark:text-[#F4F1E8]">{h}</h3><p className="mt-3 text-[16px] leading-[1.7] text-[#61756B] dark:text-[#D2CCBD]">{b}</p></article> })}</div></div></section>

      <footer className="relative overflow-hidden border-t border-[#2B5844] bg-[#0A3A29] px-6 py-14 text-[#EAF4EE] sm:px-10 dark:border-[#2B3A32]">
        <div className="relative mx-auto grid max-w-[1160px] gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <a href="#top" className="inline-flex items-center gap-3 font-sans text-[20px] font-bold text-white">
              <Logo size={32} className="flex-none" />
              <span>Rhinalx</span>
            </a>
            <p className="mt-6 max-w-[13em] font-sans text-[clamp(2rem,4vw,3.35rem)] font-bold leading-[1.04] tracking-[-.025em] text-white">Agentic memory for scientific RAG.</p>
            <p className="mt-5 max-w-[36em] text-[16px] leading-[1.75] text-[#C4DDCF]">Keep every research decision tied to the evidence, rationale, and source that made it defensible.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/app" className="inline-flex items-center rounded-lg bg-[#F3E9CE] px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[.12em] text-[#0A3A29] hover:bg-white">Open the app</Link>
              <a href="#room" className="inline-flex items-center rounded-lg border border-[#5D8A73] px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[.12em] text-[#EAF4EE] hover:border-[#F3E9CE] hover:text-[#F3E9CE]">See workflow</a>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[.18em] text-[#E3B45F]">Explore</p>
              <nav className="grid gap-3 text-[15px] text-[#C4DDCF]">
                <a href="#gap" className="hover:text-white">The gap</a>
                <a href="#room" className="hover:text-white">How it works</a>
                <a href="#engine" className="hover:text-white">The engine</a>
                <a href="#trust" className="hover:text-white">Local-first</a>
              </nav>
            </div>
            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[.18em] text-[#E3B45F]">Built for</p>
              <div className="grid gap-3">
                {[['Local records', Icon.knowledge], ['Cited answers', Icon.check], ['Recoverable history', Icon.archive]].map(([label, FooterIcon]) => <div key={label as string} className="flex items-center gap-3 rounded-lg border border-[#2B5844] bg-[#0D4A35] px-3 py-3 text-[14px] text-[#D2CCBD]"><FooterIcon className="h-4 w-4 text-[#62D0A8]" /><span>{label as string}</span></div>)}
              </div>
            </div>
          </div>
        </div>
        <div className="relative mx-auto mt-12 flex max-w-[1160px] flex-wrap items-center justify-between gap-4 border-t border-[#2B5844] pt-6 font-mono text-[11px] uppercase tracking-[.14em] text-[#9FC4B2]">
          <span>Local-first memory layer</span>
          <span>RAG - agents - memory engineering</span>
        </div>
      </footer>
    </main>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
function ContentPage({ title, lead, blocks }: { title: string; lead: string; blocks: { h: string; b: string }[] }) {
  return (
    <div className="mx-auto max-w-[1160px] px-6 py-16 sm:px-10 lg:py-24">
      <p className="mb-5 flex items-center gap-3 font-mono text-[12px] uppercase tracking-[.2em] text-primary before:h-[2px] before:w-6 before:bg-attention">Rhinalx memory layer</p>
      <h1 className="max-w-[15em] font-sans text-[clamp(2.25rem,5vw,4.25rem)] font-bold leading-[1.04] tracking-[-.03em] text-ink">{title}</h1>
      <p className="mt-6 max-w-[42em] font-serif text-[19px] leading-[1.72] text-ink-soft">{lead}</p>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {blocks.map((bl) => (
          <article key={bl.h} className="rounded-xl border border-line bg-surface/90 p-7 shadow-[0_20px_44px_-40px_rgba(14,42,32,.35)] backdrop-blur">
            <div className="mb-5 h-1.5 w-14 rounded-full bg-attention" />
            <h2 className="mb-3 font-sans text-[22px] font-semibold tracking-[-.02em] text-ink">{bl.h}</h2>
            <p className="text-[16px] leading-[1.72] text-ink-soft">{bl.b}</p>
          </article>
        ))}
      </div>
      <div className="mt-10"><Link to="/app" className="inline-flex items-center rounded-lg bg-primary px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[.12em] text-white shadow-[0_10px_26px_-12px_rgba(18,128,90,.7)] hover:bg-[#0C5C40]">Open the app &gt;</Link></div>
    </div>
  )
}

export const HowItWorksScreen = () => (
  <ContentPage title="How it works" lead="A calm pipeline: ingest  detect gaps  interview  answer with sources  surface precedent."
    blocks={[
      { h: 'Ingest, span-preserving', b: 'Protocols, notebooks, and meeting notes are parsed locally. Every indexed span keeps its exact character offsets, so any later claim maps back to the source text - not an opaque chunk.' },
      { h: 'Detect gaps + interview', b: 'On ingest, Rhinalx flags decisions whose rationale is absent everywhere in the record and asks you for it. Your answer becomes cited memory.' },
      { h: 'Answer with provenance', b: "Ask any decision and Rhinalx reconstructs the reasoning across sources, with a provenance chip on every claim. If it can't cite it, it won't say it." },
      { h: 'Surface precedent', b: 'Rhinalx matches a new case to prior ones by meaning and explains the resemblance, both cases cited.' },
    ]} />
)

export const SecurityScreen = () => (
  <ContentPage title="Your data never leaves this machine" lead="The buyer's guarantee: unpublished and unblinded results stay local by construction."
    blocks={[
      { h: 'Local-first architecture', b: 'Ingestion, embeddings, the vector index, and search all run on your machine against a single local file. There is no server to send data to.' },
      { h: 'Claude only when you allow it', b: 'The cloud reasoning path is opt-in via a policy flag. Set it to Local and the core loop runs fully offline on Ollama models.' },
      { h: 'No telemetry', b: 'Rhinalx phones home to nothing. The whole memory is one portable, auditable artifact you can inspect or delete.' },
    ]} />
)

export const ScienceScreen = () => (
  <ContentPage title="The science" lead="A memory system modelled on how memory actually works - mapped to what the app does."
    blocks={[
      { h: 'Episodic capture', b: 'Each decision is stored as a discrete episode with evidence spans - the actor, date, and change, never fabricated beyond the source.' },
      { h: 'Consolidation', b: 'Repeated rationale is distilled into stable, semantic knowledge, tagged back to the episodes that support it.' },
      { h: 'Adaptive forgetting', b: 'When a decision is superseded, the old rationale is archived and weighted down - recoverable, never deleted. A palimpsest.' },
      { h: 'Indexing', b: 'The index points back to exact source spans, so provenance is structural rather than best-effort.' },
    ]} />
)

export const UseCasesScreen = () => (
  <ContentPage title="Who it's for" lead="One study, three people who feel the pain of a lost why."
    blocks={[
      { h: 'The bench scientist', b: "Running a multi-cohort study, making dozens of small calls a week. Rhinalx keeps the reasoning so cohort 5 doesn't re-litigate cohort 2." },
      { h: 'The supervisor / PI', b: 'Wants to trust that every decision in the thesis is defensible and cited - not reconstructed from memory months later.' },
      { h: 'The next student', b: 'Inherits the project and its reasoning intact, instead of a notebook of what without any why.' },
    ]} />
)






