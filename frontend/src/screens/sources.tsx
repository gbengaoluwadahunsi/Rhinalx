import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDocument, getDocuments } from '../api'
import type { DocumentDetail, DocumentRow } from '../types'
import { Icon, cx } from '../ui'

const TYPE_LABEL: Record<string, string> = {
  protocol: 'Protocol', lab_notebook: 'Lab notebook', meeting_note: 'Meeting note', decision_record: 'Decision record',
}

export function SourcesScreen() {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  useEffect(() => { getDocuments().then(setDocs).catch(() => {}) }, [])

  return (
    <div className="pp-rise mx-auto max-w-[820px] px-8 py-9">
      <h1 className="mb-1.5 font-serif text-[30px] leading-tight tracking-tight">Sources</h1>
      <p className="mb-7 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
        Every ingested document, read locally. Open one to see its grounding spans highlighted in place.
      </p>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {docs.map((d) => (
          <Link key={d.id} to={`/app/sources/${d.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0 hover:bg-paper">
            <Icon.doc className="h-[18px] w-[18px] flex-none text-ink-faint" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">{d.title ?? d.filename}</div>
              <div className="font-mono text-[11.5px] text-ink-faint">{d.filename}</div>
            </div>
            <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-medium text-ink-soft">{TYPE_LABEL[d.doc_type ?? ''] ?? d.doc_type}</span>
            <span className="w-20 text-right font-mono text-[12px] text-ink-faint">{d.date}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function SourceViewerScreen() {
  const { id } = useParams()
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  useEffect(() => { if (id) getDocument(Number(id)).then(setDoc).catch(() => {}) }, [id])

  // Render raw_text with indexed spans highlighted using their exact char offsets.
  const segments = useMemo(() => {
    if (!doc) return []
    const spans = [...doc.spans].sort((a, b) => a.start_char - b.start_char)
    const out: { text: string; hl: boolean }[] = []
    let cur = 0
    for (const s of spans) {
      if (s.start_char > cur) out.push({ text: doc.raw_text.slice(cur, s.start_char), hl: false })
      out.push({ text: doc.raw_text.slice(s.start_char, s.end_char), hl: true })
      cur = Math.max(cur, s.end_char)
    }
    if (cur < doc.raw_text.length) out.push({ text: doc.raw_text.slice(cur), hl: false })
    return out
  }, [doc])

  if (!doc) return <div className="mx-auto max-w-[820px] px-8 py-9 text-[15px] text-ink-faint">Loading...</div>

  return (
    <div className="pp-rise mx-auto max-w-[820px] px-8 py-8">
      <Link to="/app/sources" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-ink">Back to Sources</Link>
      <h1 className="mb-1 font-serif text-[24px] leading-tight tracking-tight">{doc.title ?? doc.filename}</h1>
      <div className="mb-5 font-mono text-[12.5px] text-ink-faint">{doc.filename} - {doc.author} - {doc.date}</div>
      <div className="mb-4 flex items-center gap-2 text-[12.5px] text-ink-faint">
        <span className="h-3.5 w-3.5 rounded-sm border border-[#E0D69B] bg-citation" />
        {doc.spans.length} grounding spans indexed and highlighted below.
      </div>
      <div className="rounded-lg border border-line bg-surface p-6">
        <pre className="whitespace-pre-wrap font-mono text-[13px] leading-[1.75] text-ink-soft">
          {segments.map((seg, i) => (
            <span key={i} className={cx(seg.hl && 'rounded-sm bg-citation text-ink')}>{seg.text}</span>
          ))}
        </pre>
      </div>
    </div>
  )
}



