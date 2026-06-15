import { request, API_BASE_URL } from './client'

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
