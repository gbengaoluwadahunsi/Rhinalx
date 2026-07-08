import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { getConfig, getHealth, getOpenQuestions, getStudy, setPolicy } from './api'
import type { Config, Study } from './types'
import { Dot, Icon, Logo, ProvenanceProvider, ThemeToggle, cx } from './ui'

type NavItem = { to: string; label: string; icon: (p: { className?: string }) => ReactNode; end?: boolean; badge?: boolean }
const NAV: NavItem[] = [
  { to: '/app', label: 'Home', icon: Icon.home, end: true },
  { to: '/app/ask', label: 'Ask', icon: Icon.ask },
  { to: '/app/questions', label: 'Open Questions', icon: Icon.questions, badge: true },
  { to: '/app/timeline', label: 'Timeline', icon: Icon.timeline },
  { to: '/app/precedent', label: 'Precedent', icon: Icon.precedent },
  { to: '/app/deviations', label: 'Deviations', icon: Icon.deviation },
  { to: '/app/knowledge', label: 'Knowledge', icon: Icon.knowledge },
  { to: '/app/archive', label: 'Archive', icon: Icon.archive },
  { to: '/app/sources', label: 'Sources', icon: Icon.sources },
  { to: '/app/search', label: 'Search', icon: Icon.search },
  { to: '/app/map', label: 'Memory map', icon: Icon.map },
]

export function AppShell() {
  const loc = useLocation()
  const [openCount, setOpenCount] = useState<number>(0)
  const [online, setOnline] = useState(true)
  const [cfg, setCfg] = useState<Config | null>(null)
  const [study, setStudy] = useState<Study | null>(null)

  async function refresh() {
    const up = await getHealth()
    setOnline(up)
    if (!up) return
    try {
      setOpenCount((await getOpenQuestions()).length)
      setCfg(await getConfig())
      setStudy(await getStudy())
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    void refresh()
  }, [loc.pathname])

  async function changePolicy(p: 'claude' | 'local') {
    if (p === 'claude' && !cfg?.claude_available) return
    try {
      const res = await setPolicy(p)
      setCfg((c) => (c ? { ...c, policy: res.policy } : c))
    } catch {
      /* ignore */
    }
  }

  const localOnly = cfg?.policy === 'local' || !cfg?.claude_available

  return (
    <div className="flex h-screen overflow-hidden bg-paper bg-grid-paper font-sans text-ink">
      {/* LEFT RAIL */}
      <aside className="flex w-[236px] flex-none flex-col border-r border-line bg-surface/95 shadow-[20px_0_50px_-44px_rgba(14,42,32,.45)] backdrop-blur">
        <Link to="/" className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <Logo size={24} className="flex-none" />
          <span className="text-[15px] font-semibold tracking-tight">Rhinalx</span>
        </Link>

        <Link to="/app/studies"
          className="mx-3 mb-3.5 mt-1.5 flex items-center justify-between rounded-lg border border-line bg-paper/85 px-3 py-2.5 hover:border-primary">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{study?.name ?? 'Study'}</div>
            <div className="font-mono text-[11.5px] text-ink-faint">study{study?.version != null ? ` - v${study.version}` : ''}</div>
          </div>
          <span className="text-[11px] text-ink-faint"></span>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end ?? false}
              className={({ isActive }) => cx(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] font-medium',
                isActive ? 'bg-primary-soft text-primary shadow-[inset_3px_0_0_var(--color-primary)]' : 'text-ink-soft hover:bg-paper/90 hover:text-ink',
              )}>
              <n.icon className="h-[18px] w-[18px]" />
              {n.label}
              {n.badge && openCount > 0 && (
                <span className="ml-auto min-w-[18px] rounded-[9px] bg-attention px-1.5 text-center text-[11px] font-semibold leading-[18px] text-white">
                  {openCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <NavLink to="/app/ingest"
            className={({ isActive }) => cx('flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] font-medium',
              isActive ? 'bg-primary-soft text-primary shadow-[inset_3px_0_0_var(--color-primary)]' : 'text-ink-soft hover:bg-paper/90 hover:text-ink')}>
            <Icon.ingest className="h-[18px] w-[18px]" />Ingest sources
          </NavLink>
          <NavLink to="/app/settings"
            className={({ isActive }) => cx('flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] font-medium',
              isActive ? 'bg-primary-soft text-primary shadow-[inset_3px_0_0_var(--color-primary)]' : 'text-ink-soft hover:bg-paper/90 hover:text-ink')}>
            <Icon.settings className="h-[18px] w-[18px]" />Settings
          </NavLink>
        </div>
      </aside>

      {/* MAIN */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center gap-4 border-b border-line bg-surface/92 px-5 shadow-[0_18px_45px_-42px_rgba(14,42,32,.55)] backdrop-blur">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="truncate text-[14px] font-semibold" title={study?.title ?? undefined}>{study?.name ?? 'Study'}</span>
            {study?.version != null && (
              <span className="rounded border border-primary-soft bg-primary-soft px-1.5 py-0.5 font-mono text-[11.5px] text-primary">v{study.version}</span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3.5">
            <ThemeToggle />
            <div className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ink-soft">
              <Dot tone={online ? 'ok' : 'danger'} ring={online} />
              {online ? 'On this machine' : 'Backend offline'}
            </div>
            <div className="inline-flex items-center overflow-hidden rounded-full border border-line text-[11.5px] font-semibold" role="group" aria-label="Reasoning backend">
              <button type="button" onClick={() => changePolicy('claude')} disabled={!cfg?.claude_available}
                title={cfg?.claude_available ? 'Reason with Claude when possible' : 'Add ANTHROPIC_API_KEY to enable Claude'}
                className={cx('px-2.5 py-1.5 transition-colors', !localOnly ? 'bg-primary text-white' : 'text-ink-faint hover:text-ink', !cfg?.claude_available && 'cursor-not-allowed opacity-40')}>
                Claude
              </button>
              <button type="button" onClick={() => changePolicy('local')}
                className={cx('px-2.5 py-1.5 transition-colors', localOnly ? 'bg-ink text-paper' : 'text-ink-faint hover:text-ink')}>
                Local
              </button>
            </div>
          </div>
        </header>

        <ProvenanceProvider>
          <main className="pp-scroll relative flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </ProvenanceProvider>
      </div>
    </div>
  )
}

/* Public / marketing chrome */
export function LandingLayout() {
  const location = useLocation()
  const isRootLanding = location.pathname === '/'

  if (isRootLanding) {
    return <Outlet />
  }

  return (
    <div className="min-h-screen bg-paper bg-grid-paper font-sans text-ink">
      <header className="mx-auto flex max-w-[1160px] items-center justify-between px-6 py-6 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo size={26} className="flex-none" />
          <span className="text-[17px] font-semibold tracking-tight">Rhinalx</span>
        </Link>
        <nav className="flex items-center gap-2 rounded-full border border-line bg-surface/85 px-2 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-ink-soft shadow-[0_18px_40px_-34px_rgba(14,42,32,.38)] backdrop-blur">
          <ThemeToggle />
          <Link to="/how-it-works" className="rounded-full px-3 py-2 hover:bg-primary-soft hover:text-primary">How it works</Link>
          <Link to="/science" className="rounded-full px-3 py-2 hover:bg-primary-soft hover:text-primary">The science</Link>
          <Link to="/security" className="rounded-full px-3 py-2 hover:bg-primary-soft hover:text-primary">Security</Link>
          <Link to="/app" className="rounded-full bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-white hover:bg-[#0C5C40]">Open the app</Link>
        </nav>
      </header>
      <Outlet />
      <footer className="mx-auto grid max-w-[1160px] gap-6 border-t border-line px-6 py-10 sm:px-10 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex items-center gap-2.5 font-semibold text-ink"><Logo size={22} />Rhinalx</div>
          <p className="mt-2 text-[13px] text-ink-faint">Agentic memory for scientific RAG.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-[.14em] text-ink-soft">
          <Link to="/how-it-works" className="hover:text-primary">How it works</Link>
          <Link to="/science" className="hover:text-primary">Science</Link>
          <Link to="/security" className="hover:text-primary">Security</Link>
          <Link to="/app" className="rounded-full bg-primary px-4 py-2 text-white hover:bg-[#0C5C40]">Open app</Link>
        </div>
      </footer>
    </div>
  )
}




