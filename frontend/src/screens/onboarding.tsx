import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getConfig } from '../api'
import type { Config } from '../types'
import { Button, Dot } from '../ui'

export function WelcomeScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="max-w-[460px] text-center">
        <div className="relative mx-auto mb-6 h-12 w-12 rounded-lg bg-primary">
          <div className="absolute inset-x-3 top-3 h-[3px] bg-white/90" />
          <div className="absolute inset-x-3 top-[22px] h-[3px] bg-white/55" />
          <div className="absolute inset-x-3 top-[31px] h-[3px] bg-white/30" />
        </div>
        <h1 className="mb-3 font-serif text-[34px] leading-tight tracking-tight">Your lab remembers <em className="text-ink-soft">what</em>. Rhinalx remembers <em className="not-italic font-medium text-primary">why</em>.</h1>
        <p className="mb-6 text-[16px] leading-relaxed text-ink-soft">A local-first memory for the reasoning behind your research decisions. Everything stays on your machine.</p>
        <Link to="/setup/models"><Button size="md">Begin</Button></Link>
        <div className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-ok"><Dot tone="ok" />On this machine - no account needed</div>
      </div>
    </div>
  )
}

export function ModelCheckScreen() {
  const [cfg, setCfg] = useState<Config | null>(null)
  useEffect(() => { getConfig().then(setCfg).catch(() => {}) }, [])
  const rows = [
    { name: cfg?.embed_model ?? 'nomic-embed-text', role: 'embeddings', ok: true },
    { name: cfg?.local_llm_model ?? 'llama3.1:8b', role: 'local reasoning', ok: true },
    { name: cfg?.model ?? 'claude-sonnet-5', role: 'cloud reasoning (opt-in)', ok: cfg?.claude_available ?? false },
  ]
  return (
    <div className="mx-auto max-w-[560px] px-8 py-14">
      <h1 className="mb-2 font-serif text-[28px] leading-tight tracking-tight">Local model check</h1>
      <p className="mb-6 text-[15px] leading-relaxed text-ink-soft">Rhinalx runs on local models by default. The cloud path is used only when you allow it.</p>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-0">
            <Dot tone={r.ok ? 'ok' : 'faint'} />
            <div className="flex-1"><div className="font-mono text-[13px]">{r.name}</div><div className="text-[12px] text-ink-faint">{r.role}</div></div>
            <span className={`text-[12.5px] font-semibold ${r.ok ? 'text-ok' : 'text-ink-faint'}`}>{r.ok ? 'ready' : 'not configured'}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3"><Link to="/setup/study"><Button>Continue</Button></Link><Link to="/app"><Button variant="ghost">Skip to app</Button></Link></div>
    </div>
  )
}

export function CreateStudyScreen() {
  return (
    <div className="mx-auto max-w-[560px] px-8 py-14">
      <h1 className="mb-2 font-serif text-[28px] leading-tight tracking-tight">Create a study</h1>
      <p className="mb-6 text-[15px] leading-relaxed text-ink-soft">Name the project and point Rhinalx at a folder of sources.</p>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">Study name</label>
      <input defaultValue="LPS-AD / PVO study" className="mb-4 w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none focus:border-primary" />
      <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">Source folder</label>
      <input defaultValue="data/sample" className="mb-6 w-full rounded-md border border-line bg-surface px-3.5 py-2.5 font-mono text-[13px] outline-none focus:border-primary" />
      <Link to="/app/ingest"><Button>Create &amp; ingest</Button></Link>
    </div>
  )
}



