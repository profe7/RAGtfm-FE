import { useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { ChatMessage as ChatMessageType } from './useRag'

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

function linkifyCitations(content: string, sourceCount: number, index: Map<string, number>): string {
  return content.replace(/\[source:\s*([^\]]+?)\]/g, (match, rawId: string) => {
    const id = rawId.trim()
    const ordinal = Number(id)
    const n =
      Number.isInteger(ordinal) && ordinal >= 1 && ordinal <= sourceCount
        ? ordinal
        : index.get(id)
    return n ? `[${n}](#cite-${n})` : match
  })
}

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming: boolean
  isLast: boolean
  onRetry: () => void
  onOpenEvidence?: (source: ChatMessageType['sources'][number]) => void
}

export function ChatMessage({
  message,
  isStreaming,
  isLast,
  onRetry,
  onOpenEvidence,
}: ChatMessageProps) {
  const isUser = message.role === 'user'
  const hasMetrics = Object.keys(message.metrics).length > 0
  const isActive = !isUser && isStreaming && isLast && !message.error
  const isPending = isActive && !message.content

  const sourceRefs = useRef<Record<number, HTMLDetailsElement | null>>({})

  const citationIndex = useMemo(() => {
    const map = new Map<string, number>()
    message.sources.forEach((src, i) => map.set(src.chunk_id, i + 1))
    return map
  }, [message.sources])

  const openSource = (n: number) => {
    const source = message.sources[n - 1]
    if (source?.citation?.document_id) {
      onOpenEvidence?.(source)
      return
    }
    const el = sourceRefs.current[n]
    if (el) {
      el.open = true
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  const components: Components = {
    a({ href, children }) {
      const match = href?.match(/^#cite-(\d+)$/)
      if (match) {
        const n = Number(match[1])
        return (
          <a
            className="citation"
            href={href}
            onClick={e => {
              e.preventDefault()
              openSource(n)
            }}
          >
            {children}
          </a>
        )
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    },
  }

  return (
    <div className={`chat-msg chat-msg--${message.role}`}>
      <div className="chat-avatar" aria-hidden="true">
        {isUser ? 'You' : 'AI'}
      </div>

      <div className="chat-bubble-wrap">
        <div className="chat-bubble">
          {isUser ? (
            message.content
          ) : isPending ? (
            <span className="cursor-blink">▌</span>
          ) : (
            <>
              {message.content && (
                <div className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                    {linkifyCitations(message.content, message.sources.length, citationIndex)}
                  </ReactMarkdown>
                </div>
              )}
              {isActive && <span className="cursor-blink">▌</span>}
            </>
          )}
        </div>

        {message.error && (
          <div className="chat-error">
            <span className="chat-error-text">⚠ {message.error}</span>
            {isLast && (
              <button className="btn btn--ghost btn--sm" type="button" onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )}

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
              <details
                key={src.chunk_id}
                ref={el => {
                  sourceRefs.current[i + 1] = el
                }}
              >
                <summary>
                  <span>
                    Source {i + 1}
                    {src.citation?.page_numbers[0] ? ` · page ${src.citation.page_numbers[0]}` : ''}
                  </span>
                  {src.rerank_score != null && (
                    <span className="source-score">score {src.rerank_score.toFixed(3)}</span>
                  )}
                </summary>
                <p className="source-text">{src.text}</p>
                {src.citation?.document_id && (
                  <button
                    className="source-view-original"
                    type="button"
                    onClick={() => onOpenEvidence?.(src)}
                  >
                    View in original PDF
                  </button>
                )}
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
