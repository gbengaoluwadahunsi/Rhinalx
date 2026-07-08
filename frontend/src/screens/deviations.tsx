import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { detectDeviations, deviationFromProtocolsio, getConfig } from '../api'
import type { Config, Deviation, DeviationResult } from '../types'
import { Button, Card, Dot } from '../ui'

const DEMO_CANONICAL = `{
  "doi": "10.17504/protocols.io.demo-lps-neuro",
  "version": "v2",
  "title": "LPS-induced neuroinflammation model (mouse)",
  "steps": [
    {"step": "2.2", "text": "Use adult male C57BL/6J mice, 10-12 weeks of age."},
    {"step": "3.4", "text": "Administer LPS at 5 mg/kg i.p., once daily for 7 days."},
    {"step": "4.1", "text": "Vortex brain homogenate for 10 s before centrifugation."},
    {"step": "5.3", "text": "Include a saline vehicle control group."}
  ]
}`

function Badge({ tone, children }: { tone: 'high' | 'med' | 'low' | 'ok' | 'warn' | 'muted'; children: ReactNode }) {
  const map: Record<string, string> = {
    high: 'bg-danger/10 text-danger border-danger/30',
    med: 'bg-attention-soft text-[#8A6414] border-[#EBD9AF]',
    low: 'bg-sunk text-ink-faint border-line',
    ok: 'bg-primary-soft text-primary border-primary/30',
    warn: 'bg-attention-soft text-[#8A6414] border-[#EBD9AF]',
    muted: 'bg-sunk text-ink-faint border-line',
  }
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map[tone]}`}>{children}</span>
}

function matTone(m: string) { return m === 'high' ? 'high' : m === 'medium' ? 'med' : 'low' }
function ratTone(s: string) { return s === 'explained' ? 'ok' : s === 'partial' ? 'warn' : 'high' }

export function DeviationsScreen() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [mode, setMode] = useState<'paste' | 'live'>('paste')
  const [text, setText] = useState('')
  const [doi, setDoi] = useState('')
  const [version, setVersion] = useState('')
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [res, setRes] = useState<DeviationResult | null>(null)

  useEffect(() => { getConfig().then(setCfg).catch(() => {}) }, [])

  async function run() {
    setBusy(true); setErr(null); setRes(null)
    try {
      const r = mode === 'live'
        ? await deviationFromProtocolsio(ref.trim())
        : await detectDeviations({ canonical_text: text, doi: doi.trim() || undefined, version: version.trim() || undefined })
      setRes(r)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const fired = res?.deviations.filter((d) => d.interview_needed) ?? []
  const silent = res?.deviations.filter((d) => !d.interview_needed) ?? []

  return (
    <div className="pp-rise mx-auto max-w-[860px] px-8 py-8">
      <h1 className="mb-2 font-serif text-[30px] leading-tight tracking-tight">Deviation check</h1>
      <p className="mb-6 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">
        A second reference frame. Anchor a run to a <strong>canonical protocol</strong> (the field-standard
        method) and Rhinalx diffs it against what your lab actually did - surfacing <em>material</em> departures
        that have <em>no recorded reason</em>, even when a note merely describes the change without explaining it.
      </p>

      {/* mode toggle */}
      <div className="mb-4 inline-flex rounded-lg border border-line bg-surface p-1 text-[13px] font-semibold">
        <button onClick={() => setMode('paste')}
          className={`rounded-md px-3 py-1.5 ${mode === 'paste' ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'}`}>Paste canonical</button>
        <button onClick={() => cfg?.protocolsio_available && setMode('live')} disabled={!cfg?.protocolsio_available}
          title={cfg?.protocolsio_available ? 'Fetch live from protocols.io' : 'Set PROTOCOLS_IO_TOKEN in .env to enable'}
          className={`rounded-md px-3 py-1.5 ${mode === 'live' ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'} ${!cfg?.protocolsio_available && 'cursor-not-allowed opacity-40'}`}>
          From protocols.io
        </button>
      </div>

      {mode === 'paste' ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="DOI (optional)"
              className="w-64 rounded-md border border-line bg-paper px-2.5 py-1.5 font-mono text-[12.5px] outline-none focus:border-primary" />
            <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="version (optional)"
              className="w-32 rounded-md border border-line bg-paper px-2.5 py-1.5 font-mono text-[12.5px] outline-none focus:border-primary" />
            <button onClick={() => { setText(DEMO_CANONICAL); setDoi('10.17504/protocols.io.demo-lps-neuro'); setVersion('v2') }}
              className="ml-auto text-[12px] font-medium text-primary hover:underline">Load demo (LPS)</button>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
            placeholder="Paste the canonical method - JSON steps, or one step per line."
            className="w-full resize-y rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-[12.5px] leading-relaxed outline-none focus:border-primary" />
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface p-4">
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="protocols.io id, DOI, or URL"
            className="w-full rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-[13px] outline-none focus:border-primary" />
          <div className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-faint"><Dot tone="ok" />Fetched read-only over the protocols.io API; your corpus never leaves the machine.</div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <Button onClick={run} disabled={busy || (mode === 'paste' ? !text.trim() : !ref.trim())}>
          {busy ? 'Diffing...' : 'Check deviations'}
        </Button>
        <span className="text-[12.5px] text-ink-faint">Diffs against your ingested execution record.</span>
      </div>

      {err && <div className="mt-4 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-[13px] text-danger">{err}</div>}

      {res && (
        <div className="pp-rise mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px]">
            {res.canonical_source?.doi && <span className="font-mono text-ink-faint">canonical: {res.canonical_source.doi} {res.canonical_source.version}</span>}
            {fired.length > 0
              ? <Link to="/app/questions" className="font-semibold text-attention hover:underline">{fired.length} interview question{fired.length === 1 ? '' : 's'} raised -&gt;</Link>
              : <span className="font-semibold text-primary">No material, unexplained deviations.</span>}
          </div>
          {res.message && <div className="mb-3 rounded-lg border border-line bg-paper px-4 py-3 text-[13px] text-ink-soft">{res.message}</div>}

          <div className="flex flex-col gap-3">
            {fired.map((d, i) => <DeviationCard key={`f${i}`} d={d} fired />)}
            {silent.map((d, i) => <DeviationCard key={`s${i}`} d={d} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function DeviationCard({ d, fired }: { d: Deviation; fired?: boolean }) {
  const silentReason = d.materiality === 'low' ? 'immaterial - stays silent'
    : d.rationale_status === 'explained' ? 'a recorded reason exists - stays silent'
    : 'below threshold'
  return (
    <Card className={fired ? 'border-attention' : 'opacity-80'}>
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-serif text-[16px]">{d.field}</span>
          <Badge tone="muted">{d.type.replace('_', ' ').toLowerCase()}</Badge>
          <Badge tone={matTone(d.materiality)}>{d.materiality}</Badge>
          <Badge tone={ratTone(d.rationale_status)}>{d.rationale_status}</Badge>
          <span className="ml-auto text-[12px] font-semibold">
            {fired ? <span className="text-attention">interview raised</span> : <span className="text-ink-faint">silent</span>}
          </span>
        </div>
        <div className="mb-2 flex items-center gap-2 font-mono text-[13px]">
          <span className="rounded bg-sunk px-2 py-1 text-ink-soft">canonical: {d.canonical?.value ?? d.canonical?.text}</span>
          <span className="text-ink-faint">-&gt;</span>
          <span className="rounded bg-primary-soft px-2 py-1 text-primary">observed: {d.observed?.value}</span>
        </div>
        {d.observed?.span?.text && (
          <div className="mb-2 truncate font-mono text-[11.5px] text-ink-faint" title={d.observed.span.text}>
            &ldquo;{d.observed.span.text}&rdquo; - {d.observed.span.filename}
          </div>
        )}
        {fired
          ? <div className="mt-2 flex items-start gap-2 rounded border border-attention/40 bg-attention-soft px-3 py-2">
              <span className="mt-0.5 font-serif text-[13px] font-semibold text-attention">?</span>
              <div className="text-[13px] leading-snug text-[#7A5312]">{d.interview_question}</div>
            </div>
          : <div className="text-[12.5px] text-ink-faint">{silentReason}</div>}
      </div>
    </Card>
  )
}
