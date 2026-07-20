import { useEffect, useRef, useState } from 'react'
import { askRag } from '../../api'
import type { RetrievedChunk } from '../../api'
import type { ConversationDetail } from '../../api'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: RetrievedChunk[]
  metrics: Record<string, number>
  error?: string
}

type PendingRequest = { question: string; limit: number; documentIds: string[] }

let messageCounter = 0
const nextId = () => `m${++messageCounter}`

function makeMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: nextId(), role, content, sources: [], metrics: {} }
}

export function useRag(token: string, onConversationUpdated?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const lastRequestRef = useRef<PendingRequest | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

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

  const runStream = async (question: string, limit: number, documentIds: string[]) => {
    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)
    setError('')

    try {
      for await (const event of askRag(
        token,
        question,
        limit,
        documentIds,
        conversationId,
        controller.signal,
      )) {
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
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message : 'Stream failed'
        setError(message)
        updateLastAssistant(msg => ({ ...msg, error: message }))
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsStreaming(false)
      onConversationUpdated?.()
    }
  }

  const sendMessage = async (question: string, limit: number, selectedDocumentIds: string[]) => {
    lastRequestRef.current = { question, limit, documentIds: selectedDocumentIds }
    setMessages(prev => [...prev, makeMessage('user', question), makeMessage('assistant', '')])
    await runStream(question, limit, selectedDocumentIds)
  }

  const retry = async () => {
    const pending = lastRequestRef.current
    if (!pending || isStreaming) return
    updateLastAssistant(() => makeMessage('assistant', ''))
    await runStream(pending.question, pending.limit, pending.documentIds)
  }

  const stop = () => {
    abortRef.current?.abort()
  }

  const newChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setConversationId(null)
    setError('')
    lastRequestRef.current = null
  }

  const openConversation = (conversation: ConversationDetail) => {
    abortRef.current?.abort()
    setConversationId(conversation.id)
    setMessages(
      conversation.messages.map(message => ({
        id: message.id,
        role: message.role,
        content: message.content,
        sources: message.sources ?? [],
        metrics: message.metrics ?? {},
        ...(message.status === 'interrupted'
          ? { error: 'This response was interrupted before completion.' }
          : {}),
      })),
    )
    setError('')
    lastRequestRef.current = null
  }

  return {
    messages,
    conversationId,
    isStreaming,
    error,
    sendMessage,
    retry,
    stop,
    newChat,
    openConversation,
  }
}
