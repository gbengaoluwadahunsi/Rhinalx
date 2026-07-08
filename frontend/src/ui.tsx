import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Backend } from './types'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ icons */
type IconProps = { className?: string }
const S = (p: { children: ReactNode; className?: string }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
  >
    {p.children}
  </svg>
)
export const Icon = {
  home: (p: IconProps) => (<S {...p}><path d="M4 10 L12 3 L20 10 V20 H4 Z" /></S>),
  ask: (p: IconProps) => (<S {...p}><path d="M4 5 H20 V16 H9 L5 20 V16 H4 Z" /></S>),
  questions: (p: IconProps) => (<S {...p}><path d="M6 3 V21 M6 4 H17 L15 8 L17 12 H6" /></S>),
  timeline: (p: IconProps) => (<S {...p}><path d="M4 7h16M4 12h16M4 17h16" /></S>),
  knowledge: (p: IconProps) => (<S {...p}><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z M5 4v14" /></S>),
  archive: (p: IconProps) => (<S {...p}><path d="M4 7h16v3H4z M5 10h14v10H5z M10 14h4" /></S>),
  sources: (p: IconProps) => (<S {...p}><path d="M7 3h7l4 4v14H7z M14 3v4h4" /></S>),
  search: (p: IconProps) => (<S {...p}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></S>),
  map: (p: IconProps) => (<S {...p}><circle cx="6" cy="6" r="2" /><circle cx="18" cy="9" r="2" /><circle cx="9" cy="18" r="2" /><path d="M8 7l8 1M8 8l0 8M16 11l-6 6" /></S>),
  ingest: (p: IconProps) => (<S {...p}><path d="M12 4v10 M8 10l4 4 4-4 M5 19h14" /></S>),
  settings: (p: IconProps) => (<S {...p}><path d="M4 8h9M18 8h2M4 16h6M15 16h5" /><circle cx="15" cy="8" r="2" /><circle cx="12" cy="16" r="2" /></S>),
  precedent: (p: IconProps) => (<S {...p}><path d="M4 12h6M14 12h6" /><circle cx="12" cy="12" r="2" /></S>),
  close: (p: IconProps) => (<S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>),
  chevron: (p: IconProps) => (<S {...p}><path d="M9 6l6 6-6 6" /></S>),
  arrow: (p: IconProps) => (<S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>),
  check: (p: IconProps) => (<S {...p}><path d="M5 13l4 4L19 7" /></S>),
  doc: (p: IconProps) => (<S {...p}><path d="M7 3h7l4 4v14H7z M14 3v4h4" /></S>),
  sun: (p: IconProps) => (<S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></S>),
  moon: (p: IconProps) => (<S {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6 6 0 1 0 10.5 10.5z" /></S>),
}

/* ------------------------------------------------------------------- logo */
/**
 * Rhinalx mark: a palimpsest monogram. A confident geometric "R" written over
 * an older gold "R" that is still legible beneath it -- superseded reasoning
 * fades but persists. Green tile = the living index; gold echo = the archival
 * layer underneath.
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  const r = 'M11.5 23.5V8.5H17a4.1 4.1 0 0 1 0 8.2h-5.5M16.7 16.7l4.5 6.8'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="Rhinalx"
    >
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#12805A" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="7.5" stroke="#0B5C42" strokeWidth="1" />
      <g transform="translate(-1.4 -1.1)" strokeLinecap="round" strokeLinejoin="round">
        {/* the older R, ghosted in archival gold, still readable underneath */}
        <path
          d={r}
          transform="translate(2.2 2.2)"
          stroke="#E3B45F"
          strokeOpacity="0.55"
          strokeWidth="3.2"
        />
        {/* the current R, written over it */}
        <path d={r} stroke="#FFFFFF" strokeWidth="3.6" />
      </g>
    </svg>
  )
}

/* ----------------------------------------------------------- theme toggle */
const THEME_KEY = 'rhinalx-theme'

function initialDark(): boolean {
  if (typeof document === 'undefined') return true
  if (document.documentElement.classList.contains('dark')) return true
  try {
    const s = localStorage.getItem(THEME_KEY)
    if (s === 'light') return false
    if (s === 'dark') return true
  } catch { /* ignore */ }
  return true // default: dark
}

/** Segmented sun/moon theme switch. Shared by the landing and the app shell;
 *  token-based, so it themes correctly in both light and dark. Defaults to dark
 *  (the initial class is set by the inline script in index.html to avoid a flash). */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean>(initialDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
    } catch { /* ignore */ }
  }, [dark])

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cx('inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5', className)}
    >
      <button
        type="button"
        onClick={() => setDark(false)}
        aria-label="Light mode"
        aria-pressed={!dark}
        className={cx('flex h-6 w-6 items-center justify-center rounded-full transition-colors',
          !dark ? 'bg-attention-soft text-attention' : 'text-ink-faint hover:text-ink')}
      >
        <Icon.sun className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setDark(true)}
        aria-label="Dark mode"
        aria-pressed={dark}
        className={cx('flex h-6 w-6 items-center justify-center rounded-full transition-colors',
          dark ? 'bg-primary-soft text-primary' : 'text-ink-faint hover:text-ink')}
      >
        <Icon.moon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------- primitives */
export function Dot({ tone = 'primary', ring = false }: { tone?: 'primary' | 'ok' | 'attention' | 'archive' | 'link' | 'faint' | 'danger'; ring?: boolean }) {
  const c: Record<string, string> = {
    primary: 'bg-primary', ok: 'bg-ok', attention: 'bg-attention',
    archive: 'bg-archive', link: 'bg-link', faint: 'bg-ink-faint', danger: 'bg-danger',
  }
  return (
    <span
      className={cx('inline-block h-2 w-2 rounded-full', c[tone])}
      style={ring ? { boxShadow: '0 0 0 3px rgba(62,155,110,.16)' } : undefined}
    />
  )
}

export function BackendBadge({ backend }: { backend: Backend | null | undefined }) {
  if (backend === 'claude')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[12.5px] font-semibold text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />Claude
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sunk px-2.5 py-1 text-[12.5px] font-semibold text-ink-soft">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />Local
    </span>
  )
}

export function Button({
  children, onClick, variant = 'primary', size = 'md', disabled, className, type,
}: {
  children: ReactNode; onClick?: () => void
  variant?: 'primary' | 'attention' | 'ghost' | 'outline' | 'link'
  size?: 'sm' | 'md'; disabled?: boolean; className?: string; type?: 'button' | 'submit'
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:opacity-50'
  const sizes = { sm: 'px-3 py-1.5 text-[13px]', md: 'px-[18px] py-2.5 text-sm' }
  const variants: Record<string, string> = {
    primary: 'bg-primary text-white hover:bg-[#0c5f59]',
    attention: 'bg-attention text-white hover:bg-[#a56d1a]',
    outline: 'border border-line bg-surface text-ink hover:bg-paper',
    ghost: 'text-ink-soft hover:text-ink',
    link: 'text-link hover:text-primary',
  }
  return (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}
      className={cx(base, sizes[size], variants[variant], className)}>
      {children}
    </button>
  )
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick}
      className={cx('rounded-lg border border-line bg-surface', onClick && 'cursor-pointer hover:border-ink-faint', className)}>
      {children}
    </div>
  )
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[13px] font-medium text-ink-faint">{children}</p>
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2.5 text-[12px] font-medium uppercase tracking-[.06em] text-ink-faint">{children}</p>
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-8 text-center">
      {icon && <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[10px] border border-line bg-sunk text-ink-faint">{icon}</div>}
      <h2 className="mb-1 font-serif text-[20px]">{title}</h2>
      <p className="mx-auto max-w-[420px] text-[14px] leading-relaxed text-ink-soft">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* map decision kinds  readable label + tone */
export const KIND: Record<string, { label: string; tone: 'primary' | 'attention' | 'link' | 'archive' }> = {
  dose_change: { label: 'Dose change', tone: 'primary' },
  reagent_swap: { label: 'Reagent swap', tone: 'attention' },
  protocol_change: { label: 'Protocol change', tone: 'primary' },
  decision: { label: 'Decision', tone: 'primary' },
  exclusion: { label: 'Exclusion', tone: 'link' },
}
export function KindTag({ kind }: { kind: string }) {
  const k = KIND[kind] ?? { label: kind, tone: 'primary' as const }
  const toneCls: Record<string, string> = {
    primary: 'text-primary bg-primary-soft', attention: 'text-attention bg-attention-soft',
    link: 'text-link bg-[#EAECFB]', archive: 'text-archive bg-[#FBF6EA]',
  }
  return <span className={cx('rounded-full px-2.5 py-1 text-[12px] font-semibold', toneCls[k.tone])}>{k.label}</span>
}

/* --------------------------------------------------- provenance chip + panel */
export interface SpanRef {
  doc: string
  section?: string
  date?: string | null
  before?: string
  hl: string
  after?: string
}
type PanelCtx = { open: (s: SpanRef) => void }
const ProvenanceContext = createContext<PanelCtx>({ open: () => {} })
export const useProvenance = () => useContext(ProvenanceContext)

export function ProvenanceChip({ label, span }: { label: string; span: SpanRef }) {
  const { open } = useProvenance()
  return (
    <button
      onClick={() => open(span)}
      className="mx-0.5 inline-flex items-baseline gap-1.5 whitespace-nowrap rounded border border-line bg-sunk px-[7px] py-px align-baseline font-mono text-[12.5px] leading-[1.3] text-ink-soft hover:border-primary hover:text-primary"
    >
      {label}
    </button>
  )
}

export function ProvenanceProvider({ children }: { children: ReactNode }) {
  const [span, setSpan] = useState<SpanRef | null>(null)
  return (
    <ProvenanceContext.Provider value={{ open: setSpan }}>
      {children}
      {span && (
        <div className="absolute right-0 top-[57px] bottom-0 z-20 flex w-[396px] flex-col border-l border-line bg-surface"
          style={{ boxShadow: '-16px 0 40px -30px rgba(26,26,23,.4)', animation: 'pp-slide-in .18s ease-out' }}>
          <div className="flex h-[52px] flex-none items-center justify-between border-b border-line px-[18px]">
            <span className="text-[13px] font-semibold">Source span</span>
            <button onClick={() => setSpan(null)} className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-ink-faint hover:text-ink">
              <Icon.close className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-[18px]">
            <div className="mb-1.5 flex items-center gap-2">
              <Icon.doc className="h-[15px] w-[15px] text-ink-faint" />
              <span className="font-mono text-[13px] font-semibold text-ink">{span.doc}</span>
            </div>
            {(span.section || span.date) && (
              <div className="mb-4 font-mono text-[12px] text-ink-faint">
                {span.section}{span.section && span.date ? ' - ' : ''}{span.date}
              </div>
            )}
            <div className="rounded-md border border-line bg-sunk p-4 font-mono text-[13px] leading-[1.7] text-ink-soft">
              {span.before}
              <mark className="rounded-sm bg-citation px-0.5 text-ink" style={{ animation: 'pp-pulse 1.2s ease-in-out 1' }}>{span.hl}</mark>
              {span.after}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="h-3.5 w-3.5 flex-none rounded-sm border border-[#E0D69B] bg-citation" />
              <span className="text-[12.5px] leading-snug text-ink-faint">Highlighted text is the exact span grounding this claim.</span>
            </div>
          </div>
        </div>
      )}
    </ProvenanceContext.Provider>
  )
}


