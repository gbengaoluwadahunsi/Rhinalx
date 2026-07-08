import { useEffect, useState } from 'react'
import { getPrecedent } from '../api'
import type { PrecedentCase, PrecedentResult } from '../types'
import { BackendBadge, Dot, ProvenanceChip } from '../ui'

function questionFor(c?: PrecedentCase) {
  if (c?.kind === 'exclusion') return 'Have we excluded an animal for this reason before?'
  if (!c) return 'Have we made a decision like this before?'
  return `Have we made a decision like "${c.summary.slice(0, 40)}${c.summary.length > 40 ? '…' : ''}" before?`
}

function CaseCard({ c, tone }: { c: PrecedentCase; tone: 'current' | 'prior' }) {
  const cur = tone === 'current'
  return (
    <div className={`rounded-lg border bg-surface p-5 ${cur ? 'border-primary' : 'border-line'}`}>
      <div className={`mb-3 text-[12px] font-semibold uppercase tracking-[.06em] ${cur ? 'text-primary' : 'text-ink-faint'}`}>
        {cur ? 'This study · current' : 'Earlier · precedent'}
      </div>
      <p className="mb-3.5 font-serif text-[17px] leading-relaxed text-ink">{c.summary}</p>
      {c.reason && (
        <p className="mb-3 font-serif text-[15px] leading-relaxed text-ink-soft">
          {c.reason.replace(/^Reason[^:]*:\s*/i, '').replace(/\s+/g, ' ').trim()}
          <ProvenanceChip
            label={`${c.filename.replace(/\.md$/, '')} · §reason`}
            span={{ doc: c.filename, date: c.date, hl: c.reason }}
          />
        </p>
      )}
      <span className="inline-flex items-center gap-1.5 rounded border border-line bg-sunk px-2 py-1 font-mono text-[12px] text-ink-soft">
        {c.filename}{c.record_id ? ` · ${c.record_id}` : ''}
      </span>
    </div>
  )
}

export function PrecedentScreen() {
  const [res, setRes] = useState<PrecedentResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPrecedent()
      .then(setRes)
      .catch((e) => setError(e instanceof Error ? e.message : 'failed'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="pp-rise mx-auto max-w-[900px] px-8 py-9">
      <div className="mb-3 flex items-center gap-2.5">
        {res?.found ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-[#EAECFB] px-3 py-1.5 text-[12.5px] font-semibold text-link dark:bg-[#1E2450]">
            <Dot tone="link" />Precedent found
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-sunk px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft">
            Precedent
          </span>
        )}
        {res?.backend && <BackendBadge backend={res.backend} />}
        {res?.found && res.similarity != null && (
          <span className="font-mono text-[12px] text-ink-faint">match {(res.similarity * 100).toFixed(0)}%</span>
        )}
      </div>

      <h1 className="mb-6 font-serif text-[28px] leading-tight tracking-tight">{questionFor(res?.current)}</h1>

      {loading && <p className="text-[15px] text-ink-faint">Searching the record for a similar prior decision…</p>}
      {error && <div className="rounded-md border border-line bg-surface p-4 font-mono text-[13px] text-danger">{error}</div>}

      {res && !res.found && (
        <div className="rounded-lg border border-line bg-sunk p-6">
          <p className="mb-1 font-serif text-[17px] text-ink">No clear precedent in the record.</p>
          <p className="text-[14px] leading-relaxed text-ink-soft">
            {res.message ?? "Rhinalx didn't find a prior decision that genuinely resembles this one — so it won't force a match."}
          </p>
        </div>
      )}

      {res && res.found && res.current && res.precedent && (
        <>
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_44px_1fr]">
            <CaseCard c={res.current} tone="current" />
            <div className="flex items-center justify-center py-2 md:py-0">
              <div className="relative h-px w-full bg-link md:h-full md:w-px">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-link bg-paper px-1.5 py-1 text-[11px] font-semibold text-link">≈</span>
              </div>
            </div>
            <CaseCard c={res.precedent} tone="prior" />
          </div>

          <div className="mt-5 rounded-lg border border-[#C9CFF3] bg-[#F4F5FE] p-5 dark:border-[#2B3470] dark:bg-[#161B3A]">
            <div className="mb-2 text-[12.5px] font-semibold text-link">Why these match</div>
            <p className="font-serif text-[16px] leading-relaxed text-ink">{res.explanation}</p>
            <p className="mt-2 text-[12px] text-ink-faint">Resemblance explained by {res.backend === 'claude' ? 'Claude' : 'the local model'}, grounded in both records.</p>
          </div>
        </>
      )}
    </div>
  )
}
