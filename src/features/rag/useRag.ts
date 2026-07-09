import { useState } from 'react'
import { askRag } from '../../api'
import type { RetrievedChunk } from '../../api'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: RetrievedChunk[]
  metrics: Record<string, number>
}

let messageCounter = 0
const nextId = () => `m${++messageCounter}`

function makeMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: nextId(), role, content, sources: [], metrics: {} }
}

export function useRag(token: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')

  const updateLastAssistant = (patch: (msg: ChatMessage) => ChatMessage) => {
    setMessages(prev => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'assistant') {
          next[i] = patch(next[i])
          break
        }
      }
      return next
    })
  }

  const sendMessage = async (
    question: string,
    limit: number,
    selectedDocumentIds: string[],
  ) => {
    setIsStreaming(true)
    setError('')
    setMessages(prev => [...prev, makeMessage('user', question), makeMessage('assistant', '')])

    try {
      for await (const event of askRag(token, question, limit, selectedDocumentIds, conversationId)) {
        if (event.type === 'conversation') {
          setConversationId(event.data.conversation_id)
        } else if (event.type === 'sources') {
          updateLastAssistant(msg => ({ ...msg, sources: event.data }))
        } else if (event.type === 'token') {
          updateLastAssistant(msg => ({ ...msg, content: msg.content + event.data }))
        } else if (event.type === 'metrics') {
          updateLastAssistant(msg => ({ ...msg, metrics: event.data }))
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

  const newChat = () => {
    setMessages([])
    setConversationId(null)
    setError('')
  }

  return { messages, conversationId, isStreaming, error, sendMessage, newChat }
}
