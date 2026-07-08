import { useEffect, useState } from 'react'
import { answerQuestion, getOpenQuestions } from '../api'
import type { OpenQuestion, Rationale } from '../types'
import { BackendBadge, Button, Icon } from '../ui'

function InterviewModal({ q, onClose, onFiled }: { q: OpenQuestion; onClose: () => void; onFiled: () => void }) {
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [filed, setFiled] = useState<Rationale | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!answer.trim()) return
    setBusy(true); setErr(null)
    try {
      const r = await answerQuestion(q.id, answer.trim())
      setFiled(r); onFiled()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to file') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(26,26,23,.34)' }} onClick={onClose}>
      <div className="pp-rise w-full max-w-[560px] overflow-hidden rounded-lg border border-line bg-surface" style={{ boxShadow: '0 30px 80px -30px rgba(26,26,23,.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="h-1.5 bg-attention" />
        <div className="p-7">
          {!filed ? (
            <>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-attention-soft font-serif text-base font-semibold text-attention">?</span>
                <span className="text-[13px] font-semibold text-attention">Rhinalx is asking</span>
                <BackendBadge backend={q.detected_backend} />
                <button onClick={onClose} className="ml-auto text-ink-faint hover:text-ink"><Icon.close className="h-4 w-4" /></button>
              </div>
              <p className="mb-4 font-serif text-[21px] leading-snug text-ink">{q.prompt}</p>
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-archive" />
                <span className="font-mono text-[12.5px] text-ink-soft">Decision - {q.episode_summary.slice(0, 48)}{q.episode_summary.length > 48 ? '...' : ''} - {q.filename}</span>
              </div>
              <textarea autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)}
                placeholder="e.g. Novus NBP2-27373 is validated for rat Gal-3 with lower background; the Abcam lot gave inconsistent standard curves on cohort-2 plates..."
                className="min-h-[104px] w-full resize-y rounded-md border border-line bg-paper px-3.5 py-3 font-serif text-[15px] leading-relaxed text-ink outline-none focus:border-attention" />
              {err && <p className="mt-2 text-[13px] text-danger">{err}</p>}
              <div className="mt-4 flex items-center gap-3">
                <Button variant="attention" onClick={submit} disabled={busy || !answer.trim()}>{busy ? 'Filing...' : 'File this rationale'}</Button>
                <Button variant="ghost" onClick={onClose}>Skip for now</Button>
                <span className="ml-auto max-w-[170px] text-right text-[12px] text-ink-faint">Filed as memory, attributed to your words.</span>
              </div>
            </>
          ) : (
            <div className="px-2 py-3.5 text-center">
              <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary-soft text-2xl text-primary"></div>
              <h3 className="mb-2 font-serif text-[22px] leading-snug">Filed into Knowledge</h3>
              <p className="mx-auto mb-1 max-w-[400px] text-[15px] text-ink-soft">The decision now carries your rationale - queryable, and cited to you.</p>
              <div className="mx-auto mt-3 max-w-[440px] rounded-md border border-line bg-paper p-3 text-left">
                <p className="font-serif text-[15px] leading-relaxed text-ink">"{filed.statement}"</p>
                <div className="mt-2.5 inline-flex items-center gap-2 font-mono text-[12px] text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  provenance: {filed.provenance.author === 'scientist' ? 'you' : filed.provenance.author} - {filed.provenance.date}
                </div>
              </div>
              <div className="mt-5"><Button onClick={onClose}>Done</Button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function QuestionsScreen() {
  const [questions, setQuestions] = useState<OpenQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<OpenQuestion | null>(null)
  const [filed, setFiled] = useState(0)

  async function load() {
    setLoading(true); setError(null)
    try { setQuestions(await getOpenQuestions()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  return (
    <div className="pp-rise mx-auto max-w-[820px] px-8 py-9">
      <div className="mb-1.5 flex items-end justify-between">
        <h1 className="font-serif text-[30px] leading-tight tracking-tight">Open Questions</h1>
        <span className="whitespace-nowrap rounded-full border border-[#EBD9AF] bg-attention-soft px-3 py-1.5 text-[13px] font-semibold text-attention">
          {questions.length} {questions.length === 1 ? 'gap' : 'gaps'}
        </span>
      </div>
      <p className="mb-6 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
        Rationale Rhinalx noticed is missing from the record. Answering fills your memory - attributed to your own words, and queryable afterward.
      </p>

      {loading && <p className="text-[15px] text-ink-faint">Checking the record...</p>}
      {error && <div className="rounded-md border border-line bg-surface p-4 font-mono text-[13px] text-danger">{error}</div>}

      {!loading && !error && questions.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-xl text-primary"></div>
          <h2 className="mb-1 font-serif text-[20px]">The record is complete</h2>
          <p className="text-[14px] text-ink-soft">{filed > 0 ? `You just filed ${filed} rationale${filed > 1 ? 's' : ''}. No decisions are missing their "why".` : 'Every extracted decision has a recorded rationale.'}</p>
        </div>
      )}

      {!loading && questions.length > 0 && (
        <div className="flex flex-col gap-3.5">
          {questions.map((q) => (
            <div key={q.id} className="rounded-lg border border-l-4 border-attention bg-surface p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-attention-soft font-serif text-sm font-semibold text-attention">?</span>
                <span className="text-[12.5px] font-semibold text-attention">Missing rationale</span>
                <BackendBadge backend={q.detected_backend} />
                <span className="ml-auto inline-flex items-center gap-1.5 rounded border border-line px-2 py-1 font-mono text-[11.5px] text-ink-faint">{q.filename} - {q.episode_date}</span>
              </div>
              <p className="mb-4 font-serif text-[18px] leading-relaxed text-ink">{q.prompt}</p>
              <Button variant="attention" size="sm" onClick={() => setActive(q)}>Answer now</Button>
            </div>
          ))}
        </div>
      )}

      {active && (
        <InterviewModal q={active} onClose={() => setActive(null)}
          onFiled={() => { setQuestions((qs) => qs.filter((x) => x.id !== active.id)); setFiled((n) => n + 1) }} />
      )}
    </div>
  )
}



