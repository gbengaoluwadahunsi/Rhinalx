import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { activateProject, createProject, getConfig, getProjects, getStudy } from '../api'
import type { Config, Project, Study } from '../types'
import { Button, Dot } from '../ui'

export function SettingsScreen() {
  const [cfg, setCfg] = useState<Config | null>(null)
  useEffect(() => { getConfig().then(setCfg).catch(() => {}) }, [])

  return (
    <div className="pp-rise mx-auto max-w-[680px] px-8 py-9">
      <h1 className="mb-6 font-serif text-[30px] leading-tight tracking-tight">Settings</h1>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="border-b border-line p-5">
          <div className="mb-3 text-[14px] font-semibold">Models &amp; policy</div>
          <div className="flex flex-col gap-2.5">
            <Row dot="ok" mono={cfg?.embed_model ?? 'nomic-embed-text'} right="local, always" rightTone="ok" />
            <Row dot="ok" mono={cfg?.local_llm_model ?? 'llama3.1:8b'} right="local, fallback" rightTone="ok" />
            <Row dot={cfg?.claude_available ? 'primary' : 'faint'} mono={cfg?.model ?? 'claude-sonnet-5'}
              right={cfg?.claude_available ? (cfg.policy === 'claude' ? 'when allowed' : 'available') : 'no key'} rightTone="primary" pill />
          </div>
        </div>
        <div className="flex items-center justify-between border-b border-line p-5">
          <div>
            <div className="text-[14px] font-semibold">Data location</div>
            <div className="mt-1 font-mono text-[12.5px] text-ink-faint">data/{cfg?.db_file ?? 'rhinalx.db'} - on this machine</div>
          </div>
          <Button variant="outline" size="sm">Change</Button>
        </div>
        <div className="flex items-center justify-between p-5">
          <div>
            <div className="text-[14px] font-semibold">Export memory</div>
            <div className="mt-1 text-[12.5px] text-ink-faint">One portable, auditable file - sources, decisions, and rationale.</div>
          </div>
          <Button variant="outline" size="sm" className="border-primary text-primary">Export .rhinalx</Button>
        </div>
      </div>
      <p className="mt-4 text-[13px] text-ink-faint">The whole lab memory is one inspectable local artifact. Nothing leaves this machine unless you allow the Claude path.</p>
    </div>
  )
}

function Row({ dot, mono, right, rightTone, pill }: { dot: 'ok' | 'primary' | 'faint'; mono: string; right: string; rightTone: 'ok' | 'primary'; pill?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Dot tone={dot} />
      <span className="font-mono text-[13px] text-ink-soft">{mono}</span>
      <span className={`ml-auto text-[12px] font-medium ${rightTone === 'ok' ? 'text-ok' : 'text-primary'} ${pill ? 'rounded-full bg-primary-soft px-2 py-1' : ''}`}>{right}</span>
    </div>
  )
}

export function StudiesScreen() {
  const [study, setStudy] = useState<Study | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const [s, p] = await Promise.all([getStudy(), getProjects()])
    setStudy(s)
    setProjects(p.projects)
  }

  useEffect(() => { refresh().catch(() => {}) }, [])

  async function onCreate() {
    if (!name.trim()) return
    setBusy(true); setErr(null)
    try { await createProject({ name }); setName(''); await refresh() }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  async function onActivate(id: number) {
    setBusy(true); setErr(null)
    try { await activateProject(id); await refresh() }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const c = study?.counts

  return (
    <div className="pp-rise mx-auto max-w-[880px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <h1 className="mb-1.5 font-serif text-[30px] leading-tight tracking-tight">Studies</h1>
      <p className="mb-6 max-w-[600px] text-[15px] leading-relaxed text-ink-soft">Each study is a local project space for sources, decisions, open questions, and rationale. Start a new workspace or return to the active one.</p>
      {err && <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-[13px] text-danger">{err}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <button key={p.id} onClick={() => !p.active && void onActivate(p.id)} disabled={busy || p.active}
            className={`rounded-lg border bg-surface p-5 text-left transition-colors ${p.active ? 'border-primary' : 'border-line hover:border-primary hover:bg-primary-soft'}`}>
            <div className="mb-3 flex items-center gap-2"><Dot tone={p.active ? 'ok' : 'faint'} /><span className={`text-[12px] font-semibold ${p.active ? 'text-ok' : 'text-ink-faint'}`}>{p.active ? 'active' : 'local project'}</span></div>
            <div className="font-serif text-[19px]">{p.name}</div>
            <div className="mt-1 min-h-5 text-[13px] text-ink-faint">{p.description || 'Local Rhinalx workspace'}</div>
            <div className="mt-4 flex flex-wrap gap-4 text-[13px] text-ink-soft">
              <span><b className="font-semibold text-ink">{p.active ? (c?.documents ?? p.documents) : p.documents}</b> sources</span>
              {p.active && <span><b className="font-semibold text-ink">{c?.decisions ?? '-'}</b> decisions</span>}
              {p.active && <span><b className="font-semibold text-attention">{c?.open_questions ?? '-'}</b> open</span>}
            </div>
          </button>
        ))}
        <div className="rounded-lg border border-dashed border-line bg-paper p-5">
          <div className="font-serif text-[19px] text-ink">New study</div>
          <div className="mt-1 text-[13px] text-ink-faint">Create a separate local workspace for another project.</div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="study name"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-primary" />
            <Button size="sm" onClick={onCreate} disabled={busy || !name.trim()}>Create</Button>
          </div>
        </div>
      </div>
      <div className="mt-6"><Link to="/app"><Button variant="outline">Open active study</Button></Link></div>
    </div>
  )
}
