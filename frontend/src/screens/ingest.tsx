import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getEpisodes, getStats } from '../api'
import type { Episode, Stats } from '../types'
import { Button, Dot, Icon, KindTag } from '../ui'

export function IngestScreen() {
  const nav = useNavigate()
  return (
    <div className="pp-rise mx-auto max-w-[720px] px-8 pt-6">
      <h1 className="mb-2 font-serif text-[30px] leading-tight tracking-tight">Ingest sources</h1>
      <p className="mb-6 text-[15px] leading-relaxed text-ink-soft">Protocols, notebook entries, and meeting notes. Rhinalx reads them locally and extracts the decisions inside.</p>
      <button onClick={() => nav('/app/ingest/processing')}
        className="flex w-full flex-col items-center gap-3.5 rounded-xl border-2 border-dashed border-[#D9CFA8] bg-attention-soft px-6 py-12 text-center hover:brightness-[.99]">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-[#EBD9AF] bg-white text-attention"><Icon.ingest className="h-6 w-6" /></div>
        <div>
          <div className="font-serif text-[18px] leading-snug text-ink">Drop protocols, notebooks &amp; notes here</div>
          <div className="mt-1 text-[14px] text-ink-soft">or click to load the sample study</div>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {['.md', '.pdf', '.txt', '.docx'].map((t) => <span key={t} className="rounded border border-line bg-white px-1.5 py-1 font-mono text-[11.5px] text-ink-faint">{t}</span>)}
        </div>
      </button>
      <div className="mt-4 flex items-center justify-center gap-2 text-[13px] font-medium text-ok"><Dot tone="ok" />Nothing is uploaded anywhere - files are read locally, on this machine.</div>
    </div>
  )
}

export function ProcessingScreen() {
  const [pct, setPct] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  useEffect(() => { getStats().then(setStats).catch(() => {}) }, [])
  useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(100, p + 4)), 60)
    return () => clearInterval(t)
  }, [])
  const done = pct >= 100
  const docs = stats?.documents ?? 8, eps = stats?.episodes ?? 7, spans = stats?.spans ?? 40

  const step = (start: number, end: number) => pct >= end ? 'done' : pct >= start ? 'active' : 'idle'
  const dot = (s: string) => s === 'done' ? 'bg-primary' : s === 'active' ? 'border-2 border-primary bg-surface' : 'border-2 border-line bg-surface'

  return (
    <div className="pp-rise mx-auto max-w-[660px] px-8 pt-8">
      <h1 className="mb-1.5 font-serif text-[28px] leading-tight tracking-tight">Reading your sources</h1>
      <p className="mb-6 text-[14px] text-ink-faint">Local - nothing leaves this machine</p>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} /></div>
      <div className="flex flex-col gap-3">
        {[
          { label: 'Parsing documents', right: `${Math.min(docs, Math.round(pct / 100 * docs))}/${docs}`, s: step(0, 45) },
          { label: 'Extracting decisions (episodes)', right: `${Math.min(eps, Math.floor(pct / 30))} found`, s: step(45, 85), tone: 'text-primary' },
          { label: 'Indexing grounding spans', right: `${Math.round(pct / 100 * spans)}`, s: step(85, 100) },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-3.5 rounded-lg border border-line bg-surface px-4 py-4">
            <span className={`h-4 w-4 flex-none rounded-full ${dot(r.s)}`} />
            <div className="flex-1 text-[15px] font-medium">{r.label}</div>
            <span className={`font-mono text-[15px] font-semibold ${r.tone ?? 'text-ink-soft'}`}>{r.right}</span>
          </div>
        ))}
      </div>
      {done && (
        <div className="pp-rise mt-5 rounded-lg border border-primary-soft bg-primary-soft p-5">
          <div className="mb-2.5 text-[14px] font-semibold text-primary">{eps} decisions extracted from {docs} sources</div>
          <div className="flex items-center gap-3"><Link to="/app/ingest/review"><Button size="sm">Review extracted decisions</Button></Link><Link to="/app"><Button variant="ghost" size="sm">Skip to workspace</Button></Link></div>
        </div>
      )}
    </div>
  )
}

export function ReviewScreen() {
  const [eps, setEps] = useState<Episode[]>([])
  useEffect(() => { getEpisodes().then(setEps).catch(() => {}) }, [])
  return (
    <div className="pp-rise mx-auto max-w-[760px] px-8 py-8">
      <h1 className="mb-1.5 font-serif text-[28px] leading-tight tracking-tight">Review extracted decisions</h1>
      <p className="mb-6 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">This is where the corpus becomes memory. Confirm the decisions Rhinalx found - each is grounded in a source span.</p>
      <div className="flex flex-col gap-3">
        {eps.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
            <KindTag kind={e.kind} />
            <div className="min-w-0 flex-1"><div className="truncate font-serif text-[15px]">{e.summary}</div><div className="font-mono text-[11.5px] text-ink-faint">{e.filename} - {e.date}</div></div>
            <Icon.check className="h-4 w-4 text-primary" />
          </div>
        ))}
      </div>
      <div className="mt-6"><Link to="/app"><Button>Enter workspace</Button></Link></div>
    </div>
  )
}



