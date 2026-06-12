const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

// ─── Types ────────────────────────────────────────────────────────────────────

export type TokenResponse = {
  access_token: string
  token_type: string
}

export type UserResponse = {
  id: string
  email: string
}

export type DocumentItem = {
  document_id: string
  original_filename: string
  content_type: string
  size_bytes: number
  sha256: string
  storage_backend: string
  storage_uri: string
  storage_path: string
  status: string
  chunk_count: number
  stored_chunk_count: number
  created_at: string
}

export type StoredDocument = {
  document_id: string
  original_filename: string
  content_type: string
  size_bytes: number
  sha256: string
  storage_backend: string
  storage_uri: string
  storage_path: string
}

export type DeleteDocumentResponse = {
  document_id: string
  deleted: boolean
  chunks_deleted: boolean
  object_deleted: boolean
}

export type IngestPdfResponse = {
  document_id: string
  document: StoredDocument
  filename: string | null
  status: string
  chunk_count: number
  stored_chunk_count: number
  stored_chunk_ids: string[]
}

export type RetrievedChunk = {
  chunk_id: string
  text: string
  metadata: Record<string, unknown>
  distance?: number | null
  rrf_score?: number | null
  retrieval_sources?: string[] | null
  dense_rank?: number | null
  bm25_rank?: number | null
  rerank_score?: number | null
  rerank_rank?: number | null
}

export type RagResponse = {
  query: string
  answer: string
  metrics: Record<string, number>
  sources: RetrievedChunk[]
}

export type RagStreamEvent =
  | { type: 'sources'; data: RetrievedChunk[] }
  | { type: 'token'; data: string }
  | { type: 'metrics'; data: Record<string, number> }
  | { type: 'error'; data: string }

export type HealthCheck = {
  ok: boolean
  latency_ms?: number
  error?: string
}

export type HealthReadyResponse = {
  status: string
  checks: Record<string, HealthCheck>
}

export type HealthReadyResult = HealthReadyResponse & {
  ready: boolean
  error?: string
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

type RequestOptions = RequestInit & { token?: string }

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const detail = error?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : typeof detail === 'object' && detail !== null
          ? (detail.message ?? JSON.stringify(detail))
          : `Request failed with ${response.status}`
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function checkBackendReady(): Promise<HealthReadyResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/health/ready`)
    const data = await response.json().catch(() => null) as Partial<HealthReadyResponse> | null

    const checks = data?.checks ?? {}
    const hasChecks = Object.keys(checks).length > 0
    const allChecksPass = hasChecks
      ? Object.values(checks).every(c => c.ok)
      : response.ok
    const ready = response.ok && allChecksPass

    return {
      ready,
      status: data?.status ?? (ready ? 'ok' : 'degraded'),
      checks,
    }
  } catch (err) {
    return {
      ready: false,
      status: 'unavailable',
      checks: {},
      error: err instanceof Error ? err.message : 'Could not reach backend',
    }
  }
}
export function register(email: string, password: string) {
  return request<UserResponse>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export function login(email: string, password: string) {
  const form = new URLSearchParams({ username: email, password })
  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
}

export function logout(token: string) {
  return request<{ detail: string }>('/auth/logout', { method: 'POST', token })
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocumentListResponse = {
  total: number
  page: number
  page_size: number
  pages: number
  documents: DocumentItem[]
}

export function listDocuments(token: string, page = 1, pageSize = 10) {
  return request<DocumentListResponse>(
    `/documents?page=${page}&page_size=${pageSize}`,
    { token },
  )
}

export function uploadPdf(token: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<IngestPdfResponse>('/ingest/pdf', { method: 'POST', token, body: form })
}

export function deleteDocument(token: string, documentId: string) {
  return request<DeleteDocumentResponse>(`/documents/${documentId}`, { method: 'DELETE', token })
}

export function openDocumentEventSource(token: string): EventSource {
  return new EventSource(`${API_BASE_URL}/documents/events?token=${encodeURIComponent(token)}`)
}

// ─── RAG streaming ────────────────────────────────────────────────────────────

export async function* askRag(
  token: string,
  query: string,
  limit: number,
  documentIds?: string[],
): AsyncGenerator<RagStreamEvent, void, unknown> {
  const response = await fetch(`${API_BASE_URL}/rag/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      limit,
      ...(documentIds?.length ? { document_ids: documentIds } : {}),
    }),
  })

  if (!response.ok || !response.body) {
    const errorText = await response.text()
    throw new Error(`Stream request failed: ${response.status} – ${errorText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let lineBuffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()

      if (done) {
        // Flush any remaining partial line
        const remaining = lineBuffer.trim()
        if (remaining) {
          const event = tryParseLine(remaining)
          if (event) yield event
        }
        break
      }

      lineBuffer += decoder.decode(value, { stream: true })
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const event = tryParseLine(trimmed)
        if (event) yield event
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function tryParseLine(line: string): RagStreamEvent | null {
  try {
    return JSON.parse(line) as RagStreamEvent
  } catch {
    return null
  }
}
