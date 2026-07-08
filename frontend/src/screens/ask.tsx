import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ask } from '../api'
import type { AskResult } from '../types'
import { BackendBadge, Button, Icon, Kicker, ProvenanceChip, SectionLabel, cx } from '../ui'

const EXAMPLES = [
  'Why did we drop the LPS dose in cohort 3?',
  'Why did we exclude an animal from the cohort-3 MWM?',
  'Why did we increase the sample size to n = 10?',
]

export function AskScreen() {
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const go = (question: string) => nav(`/app/answer?q=${encodeURIComponent(question)}`)

  return (
    <div className="pp-rise mx-auto max-w-[720px] px-8 pt-8">
      <h1 className="mb-5 text-center font-serif text-[30px] leading-tight tracking-tight">Ask the study</h1>
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q.trim()) }}
        className="flex items-center gap-3 rounded-[10px] border border-line bg-surface py-1.5 pl-[18px] pr-1.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Why did we..."
          className="flex-1 bg-transparent font-serif text-[18px] italic text-ink outline-none placeholder:text-ink-faint" />
        <Button type="submit" disabled={!q.trim()}>Reconstruct</Button>
      </form>

      <div className="mt-7">
        <SectionLabel>Try</SectionLabel>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => go(ex)}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 text-left font-serif text-[16px] leading-snug hover:border-ink-faint">
              {ex}<span className="text-ink-faint"><Icon.arrow className="h-4 w-4" /></span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-6 text-[13px] leading-relaxed text-ink-faint">
        Answers reconstruct reasoning across the record - every claim carries a provenance chip to the exact source span.
      </p>
    </div>
  )
}

function shortRef(filename: string) {
  return filename.replace(/\.md$/, '')
}

export function AnswerScreen() {
  const [sp] = useSearchParams()
  const claim = sp.get('q') ?? ''
  const [res, setRes] = useState<AskResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!claim) return
    setLoading(true); setError(null); setRes(null)
    ask(claim, 8).then(setRes).catch((e) => setError(e instanceof Error ? e.message : 'failed')).finally(() => setLoading(false))
  }, [claim])

  return (
    <div className="pp-rise mx-auto max-w-[760px] px-8 py-8">
      <Link to="/app/ask" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-ink">Back to Ask</Link>
      <Kicker>You asked</Kicker>
      <h1 className="mb-4 font-serif text-[27px] leading-tight tracking-tight">{claim}</h1>

      {loading && (
        <p className="text-[15px] text-ink-faint">Reconstructing the reasoning across the record...</p>
      )}
      {error && <div className="rounded-md border border-line bg-surface p-4 font-mono text-[13px] text-danger">{error}</div>}

      {res && !res.sufficient && (
        <div className="rounded-lg border border-line bg-sunk p-6">
          <p className="mb-1 font-serif text-[17px] text-ink">Insufficient evidence in the record.</p>
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Rhinalx can't find sources that explain this, so it won't guess. Try ingesting the relevant note, or ask a different decision.
          </p>
        </div>
      )}

      {res && res.sufficient && (
        <>
          <div className="mb-5 flex items-center gap-2.5">
            <BackendBadge backend={res.backend} />
            <span className="text-[12.5px] font-medium text-ink-faint">
              {res.source_count} source{res.source_count === 1 ? '' : 's'} - reconstructed just now
            </span>
          </div>

          {/* Woven narrative - Spectral prose, every claim carrying its provenance chip(s). */}
          <div className="rounded-lg border border-line bg-surface p-7">
            <p className="font-serif text-[19px] leading-[1.62] text-ink">
              {res.answer.map((c, i) => (
                <span key={i}>
                  {c.text.replace(/\s+/g, ' ').trim()}{' '}
                  {c.sources.map((s, j) => (
                    <ProvenanceChip
                      key={j}
                      label={`${shortRef(s.filename)}${s.date ? ` - ${s.date}` : ''}`}
                      span={{ doc: s.filename, date: s.date, before: s.context_before, hl: s.text, after: s.context_after }}
                    />
                  ))}{' '}
                </span>
              ))}
            </p>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Link to="/app/precedent"><Button variant="outline" size="sm" className={cx('text-link')}>Find precedent</Button></Link>
            <span className="ml-auto text-[13px] text-ink-faint">
              Every claim is grounded - click any <span className="font-mono text-[12px] text-ink-soft">chip</span> to see its exact source span.
            </span>
          </div>
        </>
      )}
    </div>
  )
}



