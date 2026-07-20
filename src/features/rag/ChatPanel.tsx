import { useState, useRef, useEffect } from 'react'
import type { ChatMessage as ChatMessageType } from './useRag'
import { ChatMessage } from './ChatMessage'
import type { RetrievedChunk } from '../../api'

interface ChatPanelProps {
  messages: ChatMessageType[]
  isStreaming: boolean
  selectedCount: number
  onSend: (question: string, limit: number) => Promise<void>
  onStop: () => void
  onRetry: () => void
  onNewChat: () => void
  onOpenEvidence: (source: RetrievedChunk) => void
}

export function ChatPanel({
  messages,
  isStreaming,
  selectedCount,
  onSend,
  onStop,
  onRetry,
  onNewChat,
  onOpenEvidence,
}: ChatPanelProps) {
  const [question, setQuestion] = useState('')
  const [limit, setLimit] = useState(5)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isStreaming])

  const submit = async () => {
    const trimmed = question.trim()
    if (!trimmed || isStreaming) return
    setQuestion('')
    await onSend(trimmed, limit)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submit()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  const scope =
    selectedCount > 0
      ? `${selectedCount} document${selectedCount === 1 ? '' : 's'} selected`
      : 'all your documents'

  return (
    <section className="panel panel--chat">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Grounded assistant</p>
          <h2>Research chat</h2>
        </div>
        <div className="chat-head-actions">
          <div className="limit-control">
            <label htmlFor="limit-input">Sources</label>
            <input
              id="limit-input"
              type="number"
              min={1}
              max={20}
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
            />
          </div>
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={onNewChat}
            disabled={isStreaming || messages.length === 0}
          >
            New chat
          </button>
        </div>
      </div>

      <div className="chat-thread" ref={threadRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon" aria-hidden="true">✦</div>
            <p className="chat-empty-title">Ask your documents anything</p>
            <p className="chat-empty-copy">
              Answers are grounded in your uploaded PDFs and remember the conversation,
              so you can ask follow-up questions.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isStreaming={isStreaming}
              isLast={i === messages.length - 1}
              onRetry={onRetry}
              onOpenEvidence={onOpenEvidence}
            />
          ))
        )}
      </div>

      <form className="chat-composer" onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Ask a question"
          placeholder="Ask a follow-up…"
          rows={1}
          required
        />
        {isStreaming ? (
          <button className="btn btn--ghost chat-send" type="button" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button
            className="btn btn--primary chat-send"
            type="submit"
            disabled={!question.trim()}
          >
            Send
          </button>
        )}
        <span className="chat-scope">Searching {scope}</span>
      </form>
    </section>
  )
}
