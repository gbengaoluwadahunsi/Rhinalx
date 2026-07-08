import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEpisode, getEpisodes } from '../api'
import type { Episode } from '../types'
import { Dot, Icon, Kicker, KindTag, ProvenanceChip, cx } from '../ui'

export function TimelineScreen() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  useEffect(() => { getEpisodes().then(setEpisodes).catch(() => {}) }, [])

  return (
    <div className="pp-rise mx-auto max-w-[820px] px-8 py-9">
      <h1 className="mb-1.5 font-serif text-[30px] leading-tight tracking-tight">Decision timeline</h1>
      <p className="mb-7 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
        Every extracted decision as strata over time - current in teal, superseded in ochre. Each is grounded in an exact source span.
      </p>
      <div className="relative border-l border-line pl-6">
        {episodes.map((e) => {
          const superseded = e.status === 'superseded' || e.status === 'archived'
          return (
            <div key={e.id} className="relative mb-5">
              <span className={cx('absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-paper', superseded ? 'bg-archive' : 'bg-primary')} />
              <Link to={`/app/timeline/${e.id}`} className={cx('block rounded-lg border bg-surface p-4 hover:border-ink-faint', superseded ? 'opacity-70' : '')}>
                <div className="mb-2 flex items-center gap-2.5">
                  <KindTag kind={e.kind} />
                  {e.record_id && <span className="font-mono text-[11.5px] text-ink-faint">{e.record_id}</span>}
                  <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11.5px] text-ink-faint"><Dot tone={superseded ? 'archive' : 'primary'} />{e.date}</span>
                </div>
                <p className="font-serif text-[16px] leading-relaxed text-ink">{e.summary}</p>
                <div className="mt-1.5 font-mono text-[11.5px] text-ink-faint">{e.filename}</div>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DecisionDetailScreen() {
  const { id } = useParams()
  const [ep, setEp] = useState<Episode | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { if (id) getEpisode(Number(id)).then(setEp).catch((e) => setErr(String(e))) }, [id])

  if (err) return <div className="mx-auto max-w-[760px] px-8 py-9 font-mono text-[13px] text-danger">{err}</div>
  if (!ep) return <div className="mx-auto max-w-[760px] px-8 py-9 text-[15px] text-ink-faint">Loading...</div>

  const reason = ep.spans.find((s) => s.role === 'reason')

  return (
    <div className="pp-rise mx-auto max-w-[760px] px-8 py-8">
      <Link to="/app/timeline" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-ink">Back to Timeline</Link>
      <div className="mb-3 flex items-center gap-2.5"><KindTag kind={ep.kind} />{ep.record_id && <span className="font-mono text-[12px] text-ink-faint">{ep.record_id}</span>}</div>
      <h1 className="mb-2 font-serif text-[26px] leading-tight tracking-tight">{ep.summary}</h1>
      <div className="mb-6 font-mono text-[12.5px] text-ink-faint">{ep.actor} - {ep.date} - {ep.filename}</div>

      <Kicker>What changed</Kicker>
      <div className="mb-6 rounded-md border border-line bg-sunk p-4 font-mono text-[13px] leading-relaxed text-ink-soft">{ep.what_changed}</div>

      <Kicker>Why</Kicker>
      {reason ? (
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="font-serif text-[17px] leading-relaxed text-ink">
            {reason.text.replace(/\s+/g, ' ').replace(/^Reason[^:]*:\s*/i, '').trim()}
            <ProvenanceChip label={`${ep.filename.replace(/\.md$/, '')} - reason`} span={{ doc: ep.filename, date: ep.date, hl: reason.text }} />
          </p>
        </div>
      ) : (
        <Link to="/app/questions" className="flex items-center gap-3 rounded-lg border border-attention bg-attention-soft p-4">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-white font-serif font-semibold text-attention">?</span>
          <div className="flex-1 text-[14px] font-semibold text-[#7A5312]">No rationale recorded - answer now to fill this gap.</div>
          <Icon.arrow className="h-4 w-4 text-attention" />
        </Link>
      )}
    </div>
  )
}



