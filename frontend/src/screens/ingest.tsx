import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getEpisodes, getProjects, getStats, ingestFile, ingestText } from '../api'
import type { Episode, IngestResult, Project, Stats } from '../types'
import { Button, Dot, Icon, KindTag } from '../ui'

export function IngestScreen() {
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [results, setResults] = useState<IngestResult[]>([])
  const [note, setNote] = useState('')
  const [noteName, setNoteName] = useState('')
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const creepRef = useRef<number | null>(null)

  useEffect(() => {
    getProjects().then((result) => setActiveProject(result.projects.find((project) => project.active) ?? null)).catch(() => {})
  }, [])
  useEffect(() => () => { if (creepRef.current != null) clearInterval(creepRef.current) }, [])

  const totals = results.reduce(
    (a, r) => ({ eps: a.eps + r.episodes, gaps: a.gaps + r.new_open_questions.length }),
    { eps: 0, gaps: 0 },
  )

  // Each file is a slice [from, to] of the bar. The real duration of a Claude
  // extraction is unknown, so within a slice we "creep" smoothly toward its end
  // (never reaching it) and snap forward when the file actually finishes.
  function stopCreep() { if (creepRef.current != null) { clearInterval(creepRef.current); creepRef.current = null } }
  function startCreep(from: number, to: number) {
    stopCreep()
    let p = from
    setProgress(from)
    creepRef.current = window.setInterval(() => {
      p += Math.max(0.5, (to - p) * 0.06)
      if (p > to - 0.6) p = to - 0.6
      setProgress(p)
    }, 130)
  }

  async function run(filename: string, content: string) {
    const r = await ingestText({ filename, content })
    setResults((prev) => [r, ...prev])
  }
  async function runFile(file: File) {
    const r = await ingestFile(file)
    setResults((prev) => [r, ...prev])
  }

  async function processTasks(tasks: { label: string; run: () => Promise<void> }[]): Promise<boolean> {
    const total = tasks.length
    setBusy(true); setErr(null); setProgress(0)
    let ok = true
    try {
      for (let i = 0; i < total; i++) {
        setStatus(total > 1 ? `${tasks[i].label} (${i + 1} of ${total})` : tasks[i].label)
        startCreep((i / total) * 100, ((i + 1) / total) * 100)
        await tasks[i].run()
        stopCreep()
        setProgress(((i + 1) / total) * 100)
      }
      setStatus('Done')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      ok = false
    } finally {
      stopCreep()
      window.setTimeout(() => { setBusy(false); setProgress(0); setStatus('') }, 500)
    }
    return ok
  }

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return
    await processTasks(Array.from(files).map((f) => ({ label: `Reading ${f.name}`, run: () => runFile(f) })))
  }
  async function onNote() {
    if (!note.trim()) return
    const filename = (noteName.trim() || 'note') + '.txt'
    const ok = await processTasks([{ label: `Reading ${filename}`, run: () => run(filename, note) }])
    if (ok) { setNote(''); setNoteName('') }
  }
  return (
    <div className="pp-rise mx-auto max-w-[760px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
      <h1 className="mb-2 font-serif text-[30px] leading-tight tracking-tight">Ingest sources</h1>
      <p className="mb-6 text-[15px] leading-relaxed text-ink-soft sm:text-[16px]">
        Drop any source file - protocols, notebooks, papers, exports, or meeting notes - or paste a quick note. Rhinalx reads them
        locally, extracts the decisions inside, grounds each in a source span, and asks about any decision that
        arrives without a reason.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px]">
        <span className="text-ink-faint">Ingest into</span>
        <span className="font-semibold text-primary">{activeProject?.name ?? 'active project'}</span>
        <Link to="/app/studies" className="ml-auto text-[12px] font-medium text-primary hover:underline">Change project</Link>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void onFiles(e.dataTransfer.files) }}
        className={`flex w-full cursor-pointer flex-col items-center gap-3.5 rounded-xl border-2 border-dashed px-6 py-11 text-center transition-colors ${drag ? 'border-primary bg-primary-soft' : 'border-[#D9CFA8] bg-attention-soft hover:brightness-[.99]'}`}>
        <input type="file" multiple className="hidden"
          onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} disabled={busy} />
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-[#EBD9AF] bg-white text-attention"><Icon.ingest className="h-6 w-6" /></div>
        {busy ? (
          <div className="w-full max-w-[440px]">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-serif text-[16px] leading-snug text-ink">{status || 'Reading and extracting...'}</span>
              <span className="font-mono text-[13px] font-semibold text-primary">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sunk">
              <div className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-[12.5px] text-ink-soft">Extracting decisions and checking for missing reasons - this uses Claude, so give it a moment.</div>
          </div>
        ) : (
          <div>
            <div className="font-serif text-[18px] leading-snug text-ink">Drop files here, or click to choose</div>
            <div className="mt-1 text-[14px] text-ink-soft">PDF, DOCX, XLSX, PPTX, CSV, TXT, MD, and other text-readable files are extracted locally. Images and scanned PDFs need OCR first.</div>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-1.5">
          {["PDF", "DOCX", "XLSX", "PPTX", "CSV", "TXT", "MD"].map((t) => <span key={t} className="rounded border border-line bg-white px-1.5 py-1 font-mono text-[11.5px] text-ink-faint">{t}</span>)}
        </div>
      </label>

      <div className="mt-3 rounded-xl border border-line bg-surface p-3 sm:p-4">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input value={noteName} onChange={(e) => setNoteName(e.target.value)} placeholder="note name (optional)"
            className="w-full rounded-md sm:w-48 border border-line bg-paper px-2.5 py-1.5 font-mono text-[12.5px] outline-none focus:border-primary" />
          <span className="text-[13px] text-ink-faint">or just paste what happened -</span>
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="e.g. 2025-05-02: switched to the ketamine/xylazine mix for the PVO cohort; excluded animal M12 from behaviour."
          className="w-full resize-y rounded-md border border-line bg-paper px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:border-primary" />
        <div className="mt-2.5 flex justify-end"><Button size="sm" onClick={onNote} disabled={busy || !note.trim()}>Ingest note</Button></div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ok"><Dot tone="ok" />Read locally, on this machine - nothing is uploaded anywhere.</div>
      </div>

      {err && <div className="mt-4 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-[13px] text-danger">{err}</div>}

      {results.length > 0 && (
        <div className="pp-rise mt-6">
          <div className="mb-3 flex flex-col gap-2 text-[14px] sm:flex-row sm:items-center sm:gap-3">
            <span className="font-semibold text-primary">{totals.eps} decision{totals.eps === 1 ? '' : 's'} extracted</span>
            {totals.gaps > 0 && <Link to="/app/questions" className="font-semibold text-attention hover:underline">{totals.gaps} open question{totals.gaps === 1 ? '' : 's'} raised -&gt;</Link>}
            <Link to="/app" className="sm:ml-auto"><Button size="sm" variant="outline">Enter workspace</Button></Link>
          </div>
          <div className="flex flex-col gap-3">
            {results.map((r, i) => (
              <div key={`${r.document_id}-${i}`} className="rounded-lg border border-line bg-surface p-4">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Icon.sources className="h-4 w-4 text-ink-faint" />
                  <span className="font-mono text-[12.5px] text-ink-soft">{r.filename}</span>
                  <span className="ml-auto text-[12px] text-ink-faint">{r.episodes} decision{r.episodes === 1 ? '' : 's'} - {r.spans} span{r.spans === 1 ? '' : 's'}</span>
                </div>
                {r.episodes === 0 && <div className="rounded-md border border-line bg-paper p-3">
                    <div className="text-[13px] text-ink-faint">No concrete decision found. The document is stored and searchable.</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[12.5px] font-medium">
                      <Link to={`/app/sources/${r.document_id}`} className="text-primary hover:underline">Review extracted text</Link>
                      <button type="button" onClick={() => setNoteName(`${r.filename} decision`)} className="text-primary hover:underline">Add a decision manually</button>
                      <Link to="/app/search" className="text-primary hover:underline">Search this workspace</Link>
                    </div>
                  </div>}
                <div className="flex flex-col gap-2">
                  {r.episodes_detail.map((e: Episode) => {
                    const gap = r.new_open_questions.find((g) => g.episode === e.summary)
                    return (
                      <div key={e.id} className="rounded-md border border-line bg-paper px-3 py-2.5">
                        <div className="flex items-start gap-2.5">
                          <KindTag kind={e.kind} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] leading-snug">{e.summary}</div>
                            {e.spans[0] && <div className="mt-1 truncate font-mono text-[11.5px] text-ink-faint" title={e.spans[0].text}>&ldquo;{e.spans[0].text}&rdquo;</div>}
                          </div>
                        </div>
                        {gap && (
                          <div className="mt-2 flex items-start gap-2 rounded border border-attention/40 bg-attention-soft px-2.5 py-2">
                            <span className="mt-0.5 font-serif text-[13px] font-semibold text-attention">?</span>
                            <div className="text-[12.5px] leading-snug text-[#7A5312]">{gap.prompt}</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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





