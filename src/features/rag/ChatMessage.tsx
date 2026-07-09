import type { ChatMessage as ChatMessageType } from './useRag'

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming: boolean
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const hasMetrics = Object.keys(message.metrics).length > 0
  const isPending = !isUser && !message.content && isStreaming

  return (
    <div className={`chat-msg chat-msg--${message.role}`}>
      <div className="chat-avatar" aria-hidden="true">
        {isUser ? 'You' : 'AI'}
      </div>

      <div className="chat-bubble-wrap">
        <div className="chat-bubble">
          {isPending ? (
            <span className="cursor-blink">▌</span>
          ) : (
            <>
              {message.content}
              {!isUser && isStreaming && <span className="cursor-blink">▌</span>}
            </>
          )}
        </div>

        {hasMetrics && (
          <div className="metrics-row">
            {Object.entries(message.metrics).map(([k, v]) => (
              <span key={k} className="metric-chip">
                <span className="metric-key">{k.replace(/_/g, ' ')}</span>
                <span className="metric-val">{fmtMs(v)}</span>
              </span>
            ))}
          </div>
        )}

        {message.sources.length > 0 && (
          <div className="sources-block">
            <p className="sources-title">Sources ({message.sources.length})</p>
            {message.sources.map((src, i) => (
              <details key={src.chunk_id}>
                <summary>
                  <span>Source {i + 1}</span>
                  {src.rerank_score != null && (
                    <span className="source-score">score {src.rerank_score.toFixed(3)}</span>
                  )}
                </summary>
                <p className="source-text">{src.text}</p>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
