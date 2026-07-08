import type {
  AskResult,
  Config,
  DeviationResult,
  DocumentDetail,
  DocumentRow,
  Episode,
  IngestResult,
  OpenQuestion,
  PrecedentResult,
  ProvenanceResult,
  Rationale,
  Stats,
  Study,
} from './types'

export const API = 'http://127.0.0.1:8000'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`)
  return res.json() as Promise<T>
}

export async function getHealth(): Promise<boolean> {
  try {
    return (await fetch(`${API}/health`)).ok
  } catch {
    return false
  }
}

export const getStats = () => get<Stats>('/stats')
export const getStudy = () => get<Study>('/study')
export const getConfig = () => get<Config>('/config')
export const getDocuments = () => get<{ documents: DocumentRow[] }>('/documents').then((d) => d.documents)
export const getDocument = (id: number) => get<DocumentDetail>(`/documents/${id}`)
export const getEpisodes = () => get<{ episodes: Episode[] }>('/episodes').then((d) => d.episodes)
export const getEpisode = (id: number) => get<Episode>(`/episodes/${id}`)
export const getRationales = (status?: string) =>
  get<{ rationales: Rationale[] }>(`/rationales${status ? `?status=${status}` : ''}`).then((d) => d.rationales)
export const getOpenQuestions = () =>
  get<{ open_questions: OpenQuestion[] }>('/open-questions').then((d) => d.open_questions)

export async function answerQuestion(id: number, answer: string): Promise<Rationale> {
  const res = await fetch(`${API}/open-questions/${id}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`)
  return (await res.json()).rationale as Rationale
}

export async function provenance(claim: string, k = 4): Promise<ProvenanceResult> {
  return get<ProvenanceResult>(`/provenance?claim=${encodeURIComponent(claim)}&k=${k}`)
}

export async function ask(q: string, k = 8): Promise<AskResult> {
  return get<AskResult>(`/ask?q=${encodeURIComponent(q)}&k=${k}`)
}

export async function getPrecedent(episodeId?: number): Promise<PrecedentResult> {
  return get<PrecedentResult>(`/precedent${episodeId != null ? `?episode_id=${episodeId}` : ''}`)
}

export interface IngestInput {
  filename: string
  content: string
  doc_type?: string
  title?: string
  date?: string
  author?: string
}

export async function ingestText(input: IngestInput): Promise<IngestResult> {
  let res: Response
  try {
    res = await fetch(`${API}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error('Could not reach the Rhinalx backend at 127.0.0.1:8000. Make sure the backend server is running, then try again.')
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`)
  return res.json() as Promise<IngestResult>
}

export async function ingestFile(file: File): Promise<IngestResult> {
  const fd = new FormData()
  fd.append('file', file)
  let res: Response
  try {
    res = await fetch(`${API}/ingest/file`, { method: 'POST', body: fd })
  } catch {
    throw new Error('Could not reach the Rhinalx backend at 127.0.0.1:8000. Make sure the backend server is running, then try again.')
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`)
  return res.json() as Promise<IngestResult>
}

export async function resetStudy(): Promise<{ reset: boolean; documents: number }> {
  const res = await fetch(`${API}/reset`, { method: 'POST' })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`)
  return res.json()
}

export async function detectDeviations(input: { canonical_text?: string; doi?: string; version?: string; title?: string }): Promise<DeviationResult> {
  const res = await fetch(`${API}/deviation/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`)
  return res.json() as Promise<DeviationResult>
}

export async function deviationFromProtocolsio(ref: string): Promise<DeviationResult> {
  const res = await fetch(`${API}/deviation/from-protocolsio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref }),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`)
  return res.json() as Promise<DeviationResult>
}

export async function setPolicy(policy: 'claude' | 'local'): Promise<{ policy: string; claude_available: boolean }> {
  const res = await fetch(`${API}/policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy }),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`)
  return res.json()
}

