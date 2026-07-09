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
  const [mode, setMode] = useState<'readable' | 'exact'>('readable')
  useEffect(() => { if (id) getDocument(Number(id)).then(setDoc).catch(() => {}) }, [id])

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

  const readableLines = useMemo(() => {
    if (!doc) return []
    return doc.raw_text
      .split(/\r?\n/)
      .map((line) => line.replace(/[\t ]+/g, ' ').trim())
      .filter(Boolean)
  }, [doc])

  if (!doc) return <div className="mx-auto max-w-[1100px] px-4 py-8 text-[15px] text-ink-faint sm:px-6 lg:px-8">Loading source...</div>

  const title = doc.title || doc.filename
  const details = [doc.doc_type, doc.author, doc.date].filter(Boolean)

  return (
    <div className="pp-rise mx-auto max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link to="/app/sources" className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-primary">Back to sources</Link>

      <header className="mb-6 border-b border-line pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase text-primary">
              <Icon.doc className="h-4 w-4" /> Source document
            </div>
            <h1 className="break-words font-serif text-[30px] leading-tight tracking-tight sm:text-[34px]">{title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-faint">
              <span className="font-mono">{doc.filename}</span>
              {details.map((detail, index) => <span key={`${detail}-${index}`} className="before:mr-2 before:text-line before:content-['/']">{detail}</span>)}
            </div>
          </div>
          <div className="inline-flex w-fit items-center rounded-md border border-line bg-surface p-1" role="group" aria-label="Source display mode">
            <button type="button" onClick={() => setMode('readable')} className={cx('rounded px-3 py-1.5 text-[12.5px] font-semibold', mode === 'readable' ? 'bg-primary text-white' : 'text-ink-soft hover:bg-paper')}>Readable</button>
            <button type="button" onClick={() => setMode('exact')} className={cx('rounded px-3 py-1.5 text-[12.5px] font-semibold', mode === 'exact' ? 'bg-primary text-white' : 'text-ink-soft hover:bg-paper')}>Exact source</button>
          </div>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:w-fit sm:grid-cols-[150px_150px]">
        <div className="bg-surface px-4 py-3">
          <div className="font-serif text-[22px] leading-none">{readableLines.length}</div>
          <div className="mt-1 text-[11px] uppercase text-ink-faint">Text lines</div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="font-serif text-[22px] leading-none text-primary">{doc.spans.length}</div>
          <div className="mt-1 text-[11px] uppercase text-ink-faint">Grounding spans</div>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-lg border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div>
              <h2 className="text-[14px] font-semibold">{mode === 'readable' ? 'Extracted text' : 'Exact extracted source'}</h2>
              <p className="mt-0.5 text-[12px] text-ink-faint">{mode === 'readable' ? 'Spacing normalized for reading.' : 'Original spacing retained for provenance review.'}</p>
            </div>
          </div>

          {mode === 'readable' ? (
            <div className="px-5 py-5 sm:px-7 sm:py-6">
              {readableLines.length > 0 ? (
                <div className="space-y-3 font-serif text-[16px] leading-[1.75] text-ink-soft sm:text-[17px]">
                  {readableLines.map((line, index) => (
                    <p key={index} className={cx(line.length < 55 && index > 0 && 'pt-2 font-sans text-[14px] font-semibold text-ink')}>{line}</p>
                  ))}
                </div>
              ) : <p className="text-[14px] text-ink-faint">No readable text was extracted from this source.</p>}
            </div>
          ) : (
            <pre className="max-h-[68vh] overflow-auto whitespace-pre-wrap break-words px-5 py-5 font-mono text-[12.5px] leading-[1.8] text-ink-soft sm:px-6">
              {segments.map((segment, index) => (
                <span key={index} className={cx(segment.hl && 'rounded-sm bg-citation text-ink')}>{segment.text}</span>
              ))}
            </pre>
          )}
        </section>

        <aside className="rounded-lg border border-line bg-surface lg:sticky lg:top-5">
          <div className="border-b border-line px-4 py-3.5">
            <h2 className="text-[14px] font-semibold">Grounding spans</h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-faint">Exact evidence indexed for retrieval and citations.</p>
          </div>
          <div className="max-h-[62vh] space-y-2 overflow-y-auto p-3">
            {doc.spans.length > 0 ? doc.spans.map((span, index) => (
              <button key={span.id} type="button" onClick={() => setMode('exact')}
                className="group w-full border-l-2 border-citation-strong bg-paper px-3 py-2.5 text-left hover:border-primary hover:bg-primary-soft">
                <div className="mb-1 flex items-center justify-between font-mono text-[10.5px] uppercase text-ink-faint">
                  <span>Span {String(index + 1).padStart(2, '0')}</span>
                  <span>{span.start_char}-{span.end_char}</span>
                </div>
                <p className="line-clamp-4 text-[12.5px] leading-relaxed text-ink-soft group-hover:text-ink">{span.text.replace(/\s+/g, ' ').trim()}</p>
              </button>
            )) : <p className="px-2 py-3 text-[13px] text-ink-faint">No grounding spans were indexed.</p>}
          </div>
        </aside>
      </div>
    </div>
  )
}
