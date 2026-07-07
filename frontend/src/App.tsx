import { useEffect, useState } from 'react'

const API = 'http://127.0.0.1:8000'

type Health = 'checking' | 'ok' | 'down'

function App() {
  const [health, setHealth] = useState<Health>('checking')

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then((d) => setHealth(d.status === 'ok' ? 'ok' : 'down'))
      .catch(() => setHealth('down'))
  }, [])

  const dot =
    health === 'ok'
      ? 'bg-ok'
      : health === 'down'
        ? 'bg-danger'
        : 'bg-ink-faint'
  const label =
    health === 'ok'
      ? 'Backend reachable · /health ok'
      : health === 'down'
        ? 'Backend not reachable — start the API'
        : 'Checking backend…'

  return (
    // If Tailwind is wired correctly, this whole page is warm paper, centered,
    // with a teal card — none of which is inline-styled.
    <div className="min-h-screen bg-paper text-ink font-sans flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-md border border-line bg-surface shadow-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
          <span className="text-[13px] text-ink-soft">{label}</span>
        </div>

        <h1 className="font-serif text-3xl leading-tight text-ink mb-2">
          Rhinalx
        </h1>
        <p className="text-ink-soft text-[15px] leading-relaxed mb-6">
          Your lab remembers <em className="text-ink-soft">what</em>. Rhinalx
          remembers <em className="text-primary not-italic font-medium">why</em>.
        </p>

        {/* Unmistakable Tailwind proof: a teal pill that only exists if utilities compiled. */}
        <div className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-white text-sm font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
          Phase 0 · scaffold online
        </div>

        <p className="mt-6 font-mono text-[12.5px] text-ink-faint">
          Tailwind v4 · Vite · FastAPI
        </p>
      </div>
    </div>
  )
}

export default App
