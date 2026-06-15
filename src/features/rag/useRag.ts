import { useState } from 'react'
import { askRag } from '../../api'
import type { RagResponse } from '../../api'

export function useRag(token: string) {
  const [ragResult, setRagResult] = useState<RagResponse | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')

  const askQuestion = async (question: string, limit: number, selectedDocumentIds: string[]) => {
    setIsStreaming(true)
    setError('')
    setRagResult({ query: question, answer: '', metrics: {}, sources: [] })

    try {
      for await (const event of askRag(token, question, limit, selectedDocumentIds)) {
        if (event.type === 'sources') {
          setRagResult(prev => prev ? { ...prev, sources: event.data } : null)
        } else if (event.type === 'token') {
          setRagResult(prev => prev ? { ...prev, answer: prev.answer + event.data } : null)
        } else if (event.type === 'metrics') {
          setRagResult(prev => prev ? { ...prev, metrics: event.data } : null)
        } else if (event.type === 'error') {
          throw new Error(event.data)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stream failed')
      throw err
    } finally {
      setIsStreaming(false)
    }
  }

  return { ragResult, isStreaming, error, askQuestion }
}
