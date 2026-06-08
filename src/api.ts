const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

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

type RequestOptions = RequestInit & {
  token?: string
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.detail ?? `Request failed with ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function register(email: string, password: string) {
  return request<UserResponse>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export function login(email: string, password: string) {
  const form = new URLSearchParams()
  form.set('username', email)
  form.set('password', password)

  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
}

export function logout(token: string) {
  return request<{ detail: string }>('/auth/logout', {
    method: 'POST',
    token,
  })
}

export function listDocuments(token: string) {
  return request<{ count: number; documents: DocumentItem[] }>('/documents', {
    token,
  })
}

export function uploadPdf(token: string, file: File) {
  const form = new FormData()
  form.append('file', file)

  return request<IngestPdfResponse>('/ingest/pdf', {
    method: 'POST',
    token,
    body: form,
  })
}

export function deleteDocument(token: string, documentId: string) {
  return request<DeleteDocumentResponse>(`/documents/${documentId}`, {
    method: 'DELETE',
    token,
  })
}

export function openDocumentEventSource(token: string): EventSource {
  return new EventSource(`${API_BASE_URL}/documents/events?token=${encodeURIComponent(token)}`)
}

export function askRag(token: string, query: string, limit: number, documentIds?: string[]) {
  return request<RagResponse>('/rag/query', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      limit,
      ...(documentIds && documentIds.length > 0 ? { document_ids: documentIds } : {}),
    }),
  })
}
