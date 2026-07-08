import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getEpisodes, getOpenQuestions, getStudy } from '../api'
import type { Episode, OpenQuestion, Study } from '../types'
import { Card, Kicker } from '../ui'

function Stat({ n, label, tone }: { n: number | string; label: string; tone?: 'primary' | 'attention' }) {
  return (
    <div className="rounded-md border border-line bg-surface px-[18px] py-4">
      <div className={`font-serif text-[32px] leading-none ${tone === 'primary' ? 'text-primary' : tone === 'attention' ? 'text-attention' : ''}`}>{n}</div>
      <div className="mt-1.5 text-[13px] font-medium text-ink-faint">{label}</div>
    </div>
  )
}

export function HomeScreen() {
  const [study, setStudy] = useState<Study | null>(null)
  const [questions, setQuestions] = useState<OpenQuestion[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const [s, q, e] = await Promise.all([getStudy(), getOpenQuestions(), getEpisodes()])
        setStudy(s); setQuestions(q); setEpisodes(e)
      } catch { /* offline handled by shell */ }
    })()
  }, [])

  const recent = episodes.slice().reverse().slice(0, 5)
  const c = study?.counts
  const openN = c?.open_questions ?? 0

  return (
    <div className="pp-rise mx-auto max-w-[1080px] px-9 py-8">
      <Kicker>Study overview</Kicker>
      <h1 className="mb-6 font-serif text-[32px] leading-tight tracking-tight" title={study?.title ?? undefined}>{study?.name ?? 'Study'}</h1>

      {c && c.documents === 0 && (
        <Link to="/app/ingest" className="mb-6 flex w-full items-center gap-4 rounded-xl border border-primary bg-primary-soft px-5 py-5 text-left hover:brightness-[.99]">
          <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-lg border border-primary/30 bg-white font-serif text-2xl text-primary">+</div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-primary">Start your study — ingest your first source</div>
            <div className="mt-0.5 font-serif text-[14px] text-ink-soft">Drop protocols, notebooks, papers, or meeting notes. Rhinalx extracts the decisions and asks about any that arrive without a reason.</div>
          </div>
          <span className="whitespace-nowrap text-[13px] font-semibold text-primary">Ingest sources</span>
        </Link>
      )}

      <div className="mb-5 grid grid-cols-4 gap-3.5">
        <Stat n={c?.documents ?? '-'} label="Sources" />
        <Stat n={c?.decisions ?? '-'} label="Decisions" />
        <Stat n={c?.current_rationale ?? '-'} label="Current rationale" tone="primary" />
        <Stat n={openN} label="Open questions" tone="attention" />
      </div>

      {openN > 0 && (
        <Link to="/app/questions" className="mb-5 flex w-full items-center gap-4 rounded-lg border border-attention bg-attention-soft px-5 py-4 text-left hover:brightness-[.99]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-lg border border-[#EBD9AF] bg-white font-serif text-xl font-semibold text-attention">?</div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-[#7A5312]">{openN} decision{openN > 1 ? 's are' : ' is'} missing a rationale</div>
            <div className="mt-0.5 font-serif text-[14px] text-ink-soft">{questions[0]?.episode_summary?.slice(0, 90) ?? 'Rhinalx can interview you to fill the gap.'}</div>
          </div>
          <span className="whitespace-nowrap text-[13px] font-semibold text-attention">Answer now</span>
        </Link>
      )}

      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <div>
          <h2 className="mb-3 font-serif text-[18px]">Recent decisions</h2>
          <Card>
            {recent.length === 0 && <div className="p-4 text-[14px] text-ink-faint">No decisions yet - ingest sources to extract them.</div>}
            {recent.map((e) => (
              <Link key={e.id} to={`/app/timeline/${e.id}`} className="flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-0 hover:bg-paper">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                <div className="flex-1"><div className="text-[14px] leading-snug">{e.summary}</div></div>
                <span className="whitespace-nowrap font-mono text-[12px] text-ink-faint">{e.date}</span>
              </Link>
            ))}
          </Card>
        </div>
        <div>
          <h2 className="mb-3 font-serif text-[18px]">Ask the study</h2>
          <Link to="/app/ask" className="block rounded-lg border border-line bg-surface p-[18px] hover:border-ink-faint">
            <div className="font-serif text-[17px] italic leading-snug text-ink-faint">Why did we...</div>
            <div className="mt-3.5 inline-flex items-center gap-2 text-[13px] font-semibold text-primary">Open Ask</div>
          </Link>
          <p className="mx-0.5 mt-3 text-[13px] leading-relaxed text-ink-faint">Answers reconstruct reasoning with a provenance chip on every claim.</p>
        </div>
      </div>
    </div>
  )
}
