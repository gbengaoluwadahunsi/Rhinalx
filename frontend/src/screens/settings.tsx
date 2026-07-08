import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getConfig, getStudy } from '../api'
import type { Config, Study } from '../types'
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
  useEffect(() => { getStudy().then(setStudy).catch(() => {}) }, [])
  const c = study?.counts

  return (
    <div className="pp-rise mx-auto max-w-[820px] px-8 py-9">
      <h1 className="mb-1.5 font-serif text-[30px] leading-tight tracking-tight">Studies</h1>
      <p className="mb-6 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">Each study is a portable, self-contained memory. Switch between them, or start a new one.</p>
      <div className="grid grid-cols-2 gap-4">
        <Link to="/app" className="rounded-lg border border-primary bg-surface p-5 hover:brightness-[.99]">
          <div className="mb-3 flex items-center gap-2"><Dot tone="ok" /><span className="text-[12px] font-semibold text-ok">active</span></div>
          <div className="font-serif text-[19px]">{study?.name ?? 'Study'}</div>
          <div className="mt-1 truncate font-mono text-[12px] text-ink-faint" title={study?.title ?? undefined}>
            {study?.title ? `${study.title.slice(0, 44)}${study.title.length > 44 ? '...' : ''}` : `study${study?.version != null ? ` - v${study.version}` : ''}`}
          </div>
          <div className="mt-4 flex gap-4 text-[13px] text-ink-soft">
            <span><b className="font-semibold text-ink">{c?.documents ?? '-'}</b> sources</span>
            <span><b className="font-semibold text-ink">{c?.decisions ?? '-'}</b> decisions</span>
            <span><b className="font-semibold text-attention">{c?.open_questions ?? '-'}</b> open</span>
          </div>
        </Link>
        <button className="rounded-lg border border-dashed border-line bg-paper p-5 text-left hover:border-ink-faint">
          <div className="font-serif text-[19px] text-ink-faint">+ New study</div>
          <div className="mt-1 text-[13px] text-ink-faint">Point Rhinalx at a folder of protocols, notebooks, and notes.</div>
        </button>
      </div>
    </div>
  )
}
