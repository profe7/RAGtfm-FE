import { useState } from 'react'
import type { ConversationSummary } from '../../api'

interface ConversationHistoryProps {
  conversations: ConversationSummary[]
  activeId: string | null
  loadingId: string | null
  isLoading: boolean
  isMutating: boolean
  onOpen: (id: string) => Promise<void>
  onRename: (id: string, title: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function ConversationHistory({
  conversations,
  activeId,
  loadingId,
  isLoading,
  isMutating,
  onOpen,
  onRename,
  onDelete,
}: ConversationHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')

  const startRename = (conversation: ConversationSummary) => {
    setEditingId(conversation.id)
    setTitle(conversation.title ?? 'Untitled conversation')
  }

  const submitRename = async (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = title.trim()
    if (!editingId || !normalized) return
    await onRename(editingId, normalized)
    setEditingId(null)
  }

  return (
    <section className="panel panel--history" aria-label="Conversation history">
      <div className="panel-head">
        <h2>Recent research</h2>
        <span className="history-count">{conversations.length} conversations</span>
      </div>

      {isLoading ? (
        <p className="empty">Loading conversations…</p>
      ) : conversations.length === 0 ? (
        <p className="empty">Completed chats will appear here.</p>
      ) : (
        <div className="history-list">
          {conversations.map(conversation => (
            <div
              className={`history-item${activeId === conversation.id ? ' history-item--active' : ''}`}
              key={conversation.id}
            >
              {editingId === conversation.id ? (
                <form className="history-rename" onSubmit={submitRename}>
                  <input
                    aria-label="Conversation title"
                    autoFocus
                    maxLength={200}
                    value={title}
                    onChange={event => setTitle(event.target.value)}
                  />
                  <button className="btn btn--ghost btn--sm" type="submit" disabled={isMutating}>
                    Save
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    type="button"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <button
                    className="history-open"
                    type="button"
                    onClick={() => void onOpen(conversation.id)}
                    disabled={loadingId !== null}
                  >
                    <span className="history-title">
                      {conversation.title || 'Untitled conversation'}
                    </span>
                    <span className="history-meta">
                      {loadingId === conversation.id
                        ? 'Loading…'
                        : `${conversation.message_count} messages`}
                    </span>
                  </button>
                  <div className="history-actions">
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      onClick={() => startRename(conversation)}
                      disabled={isMutating}
                    >
                      Rename
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      type="button"
                      onClick={() => void onDelete(conversation.id)}
                      disabled={isMutating}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
