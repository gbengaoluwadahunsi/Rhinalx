export type Backend = 'claude' | 'local'

export interface Evidence {
  start_char: number
  end_char: number
  text: string
  role: string
  filename?: string
}

export interface OpenQuestion {
  id: number
  prompt: string
  status: string
  detected_backend: Backend | null
  episode_id: number
  episode_kind: string
  episode_summary: string
  what_changed: string
  episode_date: string | null
  actor: string | null
  filename: string
  evidence: Evidence | null
}

export interface Provenance {
  type: string
  author: string
  date: string
  note?: string
  open_question_id?: number
}

export interface Rationale {
  id: number
  statement: string
  status: string
  source: string
  weight?: number
  superseded_by?: number | null
  episode_id: number | null
  episode_summary?: string | null
  episode_kind?: string | null
  filename?: string | null
  provenance: Provenance
  created_at?: string
}

export interface Episode {
  id: number
  document_id: number
  kind: string
  summary: string
  what_changed: string
  actor: string | null
  date: string | null
  status: string
  record_id: string | null
  filename: string
  spans: Evidence[]
}

export interface DocumentRow {
  id: number
  filename: string
  doc_type: string | null
  title: string | null
  version: number | null
  status: string | null
  supersedes: number | null
  author: string | null
  date: string | null
  protocol_version: number | null
  record_id: string | null
}

export interface DocumentDetail extends DocumentRow {
  raw_text: string
  spans: { id: number; start_char: number; end_char: number; text: string; kind: string }[]
  episodes: { id: number; kind: string; summary: string; date: string | null; status: string; record_id: string | null }[]
}

export interface Stats {
  seeded: boolean
  documents: number
  episodes: number
  spans: number
  episode_spans: number
  open_questions: number
  rationales: number
}

export interface Study {
  name: string
  version: number | null
  title: string | null
  counts: {
    documents: number
    decisions: number
    current_rationale: number
    archived_rationale: number
    open_questions: number
  }
}

export interface Config {
  policy: string
  model: string
  embed_model: string
  local_llm_model: string
  ollama_host: string
  claude_available: boolean
  db_file: string
}

export interface ProvenanceHit {
  filename: string
  doc_type: string | null
  title: string | null
  date: string | null
  start_char: number
  end_char: number
  text: string
  context_before: string
  context_after: string
  distance: number
  exact: boolean
}

export interface ProvenanceResult {
  claim: string
  sufficient: boolean
  message?: string
  backend?: string
  model?: string
  results: ProvenanceHit[]
}

export interface AskSource {
  filename: string
  date: string | null
  start_char: number
  end_char: number
  text: string
  context_before: string
  context_after: string
}

export interface AskClaim {
  text: string
  sources: AskSource[]
}

export interface AskResult {
  claim: string
  sufficient: boolean
  message?: string
  backend?: Backend
  model?: string
  source_count?: number
  answer: AskClaim[]
}

export interface PrecedentCase {
  id: number
  kind: string
  summary: string
  filename: string
  date: string | null
  record_id: string | null
  reason: string | null
}

export interface PrecedentResult {
  found: boolean
  similarity?: number
  backend?: Backend
  model?: string
  current?: PrecedentCase
  precedent?: PrecedentCase | null
  explanation?: string | null
  message?: string | null
}
