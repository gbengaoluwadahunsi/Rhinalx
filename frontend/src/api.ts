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
  Project,
  ProjectsResult,
  ProvenanceResult,
  Rationale,
  Stats,
  Study,
} from './types'

export const API = import.meta.env.VITE_RHINALX_API ?? 'http://127.0.0.1:8000'

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => '')
  if (!body) return `${res.status}: ${res.statusText}`
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; message?: unknown }
    const detail = parsed.detail ?? parsed.message
    if (typeof detail === 'string') return `${res.status}: ${detail}`
    if (Array.isArray(detail)) return `${res.status}: ${detail.map((d) => typeof d === 'string' ? d : JSON.stringify(d)).join('; ')}`
  } catch {
    // Use raw body below.
  }
  return `${res.status}: ${body}`
}

function backendOfflineError(): Error {
  return new Error(`Could not reach the Rhinalx backend at ${API}. Start the backend with 'uv run uvicorn backend.main:app --reload --port 8000', then try again.`)
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw backendOfflineError()
  }
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<T>
}

async function get<T>(path: string): Promise<T> {
  return requestJson<T>(`${API}${path}`)
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
export const getProjects = () => get<ProjectsResult>('/projects')
export const getDocuments = () => get<{ documents: DocumentRow[] }>('/documents').then((d) => d.documents)
export const getDocument = (id: number) => get<DocumentDetail>(`/documents/${id}`)
export const getEpisodes = () => get<{ episodes: Episode[] }>('/episodes').then((d) => d.episodes)
export const getEpisode = (id: number) => get<Episode>(`/episodes/${id}`)
export const getRationales = (status?: string) =>
  get<{ rationales: Rationale[] }>(`/rationales${status ? `?status=${status}` : ''}`).then((d) => d.rationales)
export const getOpenQuestions = () =>
  get<{ open_questions: OpenQuestion[] }>('/open-questions').then((d) => d.open_questions)

export async function answerQuestion(id: number, answer: string): Promise<Rationale> {
  const data = await requestJson<{ rationale: Rationale }>(`${API}/open-questions/${id}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  })
  return data.rationale
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
  return requestJson<IngestResult>(`${API}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function ingestFile(file: File): Promise<IngestResult> {
  const fd = new FormData()
  fd.append('file', file)
  return requestJson<IngestResult>(`${API}/ingest/file`, { method: 'POST', body: fd })
}

export async function resetStudy(): Promise<{ reset: boolean; documents: number }> {
  return requestJson<{ reset: boolean; documents: number }>(`${API}/reset`, { method: 'POST' })
}

export async function detectDeviations(input: { canonical_text?: string; doi?: string; version?: string; title?: string }): Promise<DeviationResult> {
  return requestJson<DeviationResult>(`${API}/deviation/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function deviationFromProtocolsio(ref: string): Promise<DeviationResult> {
  return requestJson<DeviationResult>(`${API}/deviation/from-protocolsio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref }),
  })
}

export async function createProject(input: { name: string; description?: string }): Promise<Project> {
  const data = await requestJson<{ project: Project; active_project_id: number }>(`${API}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return data.project
}

export async function activateProject(projectId: number): Promise<Project> {
  const data = await requestJson<{ project: Project; active_project_id: number }>(`${API}/projects/${projectId}/activate`, { method: 'POST' })
  return data.project
}

export async function setPolicy(policy: 'claude' | 'local'): Promise<{ policy: string; claude_available: boolean }> {
  return requestJson<{ policy: string; claude_available: boolean }>(`${API}/policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy }),
  })
}