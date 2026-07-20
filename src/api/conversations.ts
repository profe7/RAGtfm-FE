import { request } from './client'
import type { RetrievedChunk } from './rag'

export type ConversationMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: RetrievedChunk[] | null
  metrics: Record<string, number> | null
  status: 'complete' | 'interrupted' | string
  created_at: string
}

export type ConversationSummary = {
  id: string
  title: string | null
  message_count: number
  created_at: string
  updated_at: string
}

export type ConversationDetail = {
  id: string
  title: string | null
  created_at: string
  updated_at: string
  messages: ConversationMessage[]
}

export type ConversationListResponse = {
  total: number
  page: number
  page_size: number
  pages: number
  conversations: ConversationSummary[]
}

export function listConversations(token: string) {
  return request<ConversationListResponse>('/conversations?page=1&page_size=50', { token })
}

export function getConversation(token: string, conversationId: string) {
  return request<ConversationDetail>(`/conversations/${encodeURIComponent(conversationId)}`, {
    token,
  })
}

export function renameConversation(token: string, conversationId: string, title: string) {
  return request<ConversationSummary>(`/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'PATCH',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export function deleteConversation(token: string, conversationId: string) {
  return request<{ conversation_id: string; deleted: boolean }>(
    `/conversations/${encodeURIComponent(conversationId)}`,
    { method: 'DELETE', token },
  )
}
