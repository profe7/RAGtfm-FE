import { API_BASE_URL } from './client'

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
