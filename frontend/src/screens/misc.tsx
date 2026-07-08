import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { getDocuments, getEpisodes, getRationales, provenance } from '../api'
import type { DocumentRow, Episode, ProvenanceResult, Rationale } from '../types'
import { Icon, ProvenanceChip } from '../ui'

export function SearchScreen() {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<ProvenanceResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(e: FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true)
    try { setRes(await provenance(q.trim(), 6)) } finally { setBusy(false) }
  }

  return (
    <div className="pp-rise mx-auto max-w-[760px] px-8 py-9">
      <h1 className="mb-1.5 font-serif text-[30px] leading-tight tracking-tight">Search</h1>
      <p className="mb-6 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
        Semantic search across every indexed source span - results are provenance-first, each traced to an exact span.
      </p>
      <form onSubmit={run} className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3.5 py-2.5">
        <Icon.search className="h-[17px] w-[17px] text-ink-faint" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sources, decisions, rationale..."
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint" />
      </form>

      {busy && <p className="mt-6 text-[15px] text-ink-faint">Searching...</p>}

      {res && !busy && (
        <div className="mt-6 flex flex-col gap-3">
          {res.results.map((h, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-4">
              <div className="mb-1.5 font-mono text-[11.5px] text-ink-faint">{h.filename} - {h.date} - dist {h.distance}</div>
              <p className="font-serif text-[15px] leading-relaxed text-ink">
                {h.text.replace(/\s+/g, ' ').trim()}
                <ProvenanceChip label={`${h.filename.replace(/\.md$/, '')}`} span={{ doc: h.filename, date: h.date, before: h.context_before, hl: h.text, after: h.context_after }} />
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const MAP = { srcX: 300, decX: 470, ratBus: 705, ratX: 800, top: 74, gap: 50 }

function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}
function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '...' : s
}

export function MemoryMapScreen() {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [eps, setEps] = useState<Episode[]>([])
  const [rats, setRats] = useState<Rationale[]>([])
  useEffect(() => {
    Promise.all([getDocuments(), getEpisodes(), getRationales()]).then(([d, e, r]) => { setDocs(d); setEps(e); setRats(r) }).catch(() => {})
  }, [])

  const { srcX, decX, ratBus, ratX, top, gap } = MAP
  const yOf = (i: number) => top + i * gap
  const docY = useMemo(() => new Map(docs.map((d, i) => [d.id, yOf(i)])), [docs])
  const epY = useMemo(() => new Map(eps.map((e, i) => [e.id, yOf(i)])), [eps])
  const ratY = useMemo(() => new Map(rats.map((r, i) => [r.id, yOf(i)])), [rats])
  const rows = Math.max(docs.length, eps.length, rats.length, 1)
  const W = 940
  const H = top + rows * gap + 16

  return (
    <div className="pp-rise mx-auto max-w-[1040px] px-8 py-9">
      <h1 className="mb-1.5 font-serif text-[30px] leading-tight tracking-tight">Memory map</h1>
      <p className="mb-6 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">
        Sources ground decisions; decisions carry rationale. The whole lab memory as one traceable graph - the hippocampal index, made visible.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
        <svg width={W} height={H} className="min-w-[820px] font-mono">
          {/* column headers */}
          <text x={srcX - 14} y={46} textAnchor="end" className="fill-ink-faint" fontSize={11} letterSpacing={2}>SOURCES</text>
          <text x={decX + 14} y={46} className="fill-ink-faint" fontSize={11} letterSpacing={2}>DECISIONS</text>
          <text x={ratX + 14} y={46} className="fill-ink-faint" fontSize={11} letterSpacing={2}>RATIONALE</text>

          {/* edges: source -> decision, colored by the decision's status */}
          {eps.map((e) => {
            const ys = docY.get(e.document_id); const yd = epY.get(e.id)
            if (ys == null || yd == null) return null
            return <path key={`sd${e.id}`} d={edgePath(srcX, ys, decX, yd)} fill="none"
              className={e.status === 'current' ? 'stroke-primary' : 'stroke-archive'} strokeWidth={1.4} strokeOpacity={0.5} />
          })}
          {/* edges: decision -> rationale (routed clear of the decision labels) */}
          {rats.map((r) => {
            if (r.episode_id == null) return null
            const yd = epY.get(r.episode_id); const yr = ratY.get(r.id)
            if (yd == null || yr == null) return null
            return <path key={`dr${r.id}`} d={edgePath(ratBus, yd, ratX, yr)} fill="none" className="stroke-link" strokeWidth={1.4} strokeOpacity={0.55} />
          })}

          {/* SOURCES: label right-aligned to the LEFT of the node, so edges never cross it */}
          {docs.map((d) => { const y = docY.get(d.id)!; return (
            <g key={`d${d.id}`}>
              <circle cx={srcX} cy={y} r={6.5} className="fill-ink-faint" fillOpacity={0.14} />
              <circle cx={srcX} cy={y} r={3.5} className="fill-ink-faint" />
              <text x={srcX - 14} y={y + 3.5} textAnchor="end" className="fill-ink-soft" fontSize={11.5}>
                {clip(d.filename.replace(/\.md$/, ''), 30)}<title>{d.filename}</title>
              </text>
            </g>
          )})}

          {/* DECISIONS */}
          {eps.map((e) => { const y = epY.get(e.id)!; const cur = e.status === 'current'; return (
            <g key={`e${e.id}`}>
              <circle cx={decX} cy={y} r={8} className={cur ? 'fill-primary' : 'fill-archive'} fillOpacity={0.15} />
              <circle cx={decX} cy={y} r={4.5} className={cur ? 'fill-primary' : 'fill-archive'} />
              <text x={decX + 14} y={y + 4} className="fill-ink" fontSize={12}>
                {clip(e.summary, 30)}<title>{e.summary}</title>
              </text>
            </g>
          )})}

          {/* RATIONALE */}
          {rats.map((r) => { const y = ratY.get(r.id)!; return (
            <g key={`ra${r.id}`}>
              <circle cx={ratX} cy={y} r={8} className="fill-link" fillOpacity={0.15} />
              <circle cx={ratX} cy={y} r={4.5} className="fill-link" />
              <text x={ratX + 14} y={y + 4} className="fill-ink-soft" fontSize={11.5}>
                {clip(r.statement, 16)}<title>{r.statement}</title>
              </text>
            </g>
          )})}

          {rats.length === 0 && (
            <text x={ratX + 14} y={top + 4} className="fill-ink-faint" fontSize={11} fillOpacity={0.8}>none yet - answer an open question</text>
          )}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-5 text-[12.5px] text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-faint" />source</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />current decision</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-archive" />superseded</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-link" />rationale</span>
      </div>
    </div>
  )
}


