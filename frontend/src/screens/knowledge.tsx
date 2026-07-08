import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRationales } from '../api'
import type { Rationale } from '../types'
import { EmptyState, Icon, KindTag } from '../ui'

export function KnowledgeScreen() {
  const [rows, setRows] = useState<Rationale[]>([])
  const [supersedes, setSupersedes] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getRationales('current'), getRationales('archived')])
      .then(([cur, arch]) => {
        setRows(cur)
        // a current rationale "supersedes" an earlier one if an archived card points to it
        setSupersedes(new Set(arch.map((a) => a.superseded_by).filter((n): n is number => n != null)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="pp-rise mx-auto max-w-[820px] px-8 py-9">
      <h1 className="mb-1.5 font-serif text-[30px] leading-tight tracking-tight">Knowledge</h1>
      <p className="mb-7 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
        Your consolidated, current rationale - the semantic layer distilled from decisions and your own answers. Each card is cited.
      </p>

      {loading && <p className="text-[15px] text-ink-faint">Loading...</p>}

      {!loading && rows.length === 0 && (
        <EmptyState icon={<Icon.knowledge className="h-5 w-5" />} title="No consolidated rationale yet"
          body="Answer an open question, or ask the study and save the reconstruction, to build your knowledge library." />
      )}

      <div className="flex flex-col gap-3.5">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-line bg-surface p-5">
            <div className="mb-3 flex items-center gap-2.5">
              {r.episode_kind && <KindTag kind={r.episode_kind} />}
              <span className="text-[12.5px] font-medium text-ink-faint">from {r.source === 'interview' ? 'your interview answer' : 'consolidation'}</span>
              {supersedes.has(r.id) && (
                <Link to="/app/archive" className="inline-flex items-center gap-1.5 rounded-full border border-[#E4D6B6] bg-[#FBF6EA] px-2.5 py-1 text-[11.5px] font-semibold text-archive hover:brightness-95 dark:border-[#5A4B1D] dark:bg-[#2A2413]">
                  supersedes an earlier version →
                </Link>
              )}
              <span className="ml-auto rounded-full bg-primary-soft px-2.5 py-1 text-[11.5px] font-semibold text-primary">current</span>
            </div>
            <p className="mb-3 font-serif text-[17px] leading-relaxed text-ink">"{r.statement}"</p>
            <div className="inline-flex items-center gap-2 rounded border border-line bg-sunk px-2.5 py-1 font-mono text-[12px] text-ink-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              provenance: {r.provenance.author === 'scientist' ? 'you' : r.provenance.author ?? 'record'} - {r.provenance.date ?? 'consolidated'}{r.filename ? ` - ${r.filename}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ArchiveScreen() {
  const [rows, setRows] = useState<Rationale[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { getRationales('archived').then(setRows).catch(() => {}).finally(() => setLoading(false)) }, [])

  return (
    <div className="pp-rise mx-auto max-w-[760px] px-8 py-9">
      <h1 className="mb-1.5 font-serif text-[30px] leading-tight tracking-tight">Archive</h1>
      <p className="mb-2 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
        Superseded rationale, dimmed and set a layer behind - still fully readable and searchable. The palimpsest made literal.
      </p>
      <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-[#E4D6B6] bg-[#FBF6EA] px-3 py-2 text-[13px] font-medium text-archive dark:border-[#5A4B1D] dark:bg-[#2A2413]">Nothing is ever deleted.</div>

      {loading && <p className="text-[15px] text-ink-faint">Loading...</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-8 text-center opacity-90">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[10px] border border-line bg-sunk text-ink-faint"><Icon.archive className="h-5 w-5" /></div>
          <h2 className="mb-1 font-serif text-[20px]">Nothing archived yet</h2>
          <p className="mx-auto max-w-[440px] text-[14px] leading-relaxed text-ink-soft">
            When a newer decision supersedes an older one, its rationale is archived here - dimmed and weighted down, never removed.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.id} className="relative rounded-lg border border-line bg-surface p-6" style={{ opacity: 0.66, filter: 'saturate(.85)' }}>
            <div className="absolute right-4 top-3.5 inline-flex items-center gap-1.5 rounded border border-[#E4D6B6] bg-[#FBF6EA] px-2 py-1 font-mono text-[11.5px] text-archive dark:border-[#5A4B1D] dark:bg-[#2A2413]">
              archived{r.weight != null ? ` · weight ${r.weight}` : ''}
            </div>
            <div className="mb-2 text-[12.5px] font-semibold text-archive">Superseded rationale</div>
            <p className="mb-3 font-serif text-[17px] leading-relaxed text-ink line-through decoration-archive/40">"{r.statement}"</p>
            <div className="flex flex-wrap items-center gap-2">
              {r.filename && <span className="inline-flex items-center gap-1.5 rounded border border-line bg-sunk px-2 py-1 font-mono text-[12px] text-ink-soft">{r.filename}</span>}
              {r.superseded_by != null && (
                <Link to="/app/knowledge" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-link hover:text-primary">
                  replaced by current knowledge →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
