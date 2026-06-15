import { useState, useRef, useEffect } from 'react'
import type { RagResponse } from '../../api'

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

interface AskPanelProps {
  onAsk: (question: string, limit: number) => Promise<void>
  ragResult: RagResponse | null
  isStreaming: boolean
}

export function AskPanel({ onAsk, ragResult, isStreaming }: AskPanelProps) {
  const [question, setQuestion] = useState('')
  const [limit, setLimit] = useState(5)
  const answerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll answer as tokens arrive
  useEffect(() => {
    if (isStreaming && answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight
    }
  }, [ragResult?.answer, isStreaming])

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || isStreaming) return
    await onAsk(question.trim(), limit)
  }

  return (
    <section className="panel panel--ask">
      <div className="panel-head">
        <h2>Ask your documents</h2>
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
      </div>

      <form className="ask-form" onSubmit={handleAsk}>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a question about the uploaded documents…"
          rows={4}
          required
        />
        <button
          className="btn btn--primary"
          type="submit"
          disabled={!question.trim() || isStreaming}
        >
          {isStreaming ? (
            <><span className="spinner" /> Thinking…</>
          ) : 'Ask'}
        </button>
      </form>

      {ragResult ? (
        <div className="answer-block">
          <div className="answer-text" ref={answerRef}>
            {ragResult.answer
              ? ragResult.answer
              : isStreaming
                ? <span className="cursor-blink">▌</span>
                : null}
          </div>

          {Object.keys(ragResult.metrics).length > 0 && (
            <div className="metrics-row">
              {Object.entries(ragResult.metrics).map(([k, v]) => (
                <span key={k} className="metric-chip">
                  <span className="metric-key">{k.replace(/_/g, ' ')}</span>
                  <span className="metric-val">{fmtMs(v)}</span>
                </span>
              ))}
            </div>
          )}

          {ragResult.sources.length > 0 && (
            <div className="sources-block">
              <p className="sources-title">Sources ({ragResult.sources.length})</p>
              {ragResult.sources.map((src, i) => (
                <details key={src.chunk_id} open={i === 0}>
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
      ) : (
        <p className="empty">Select documents and ask a question.</p>
      )}
    </section>
  )
}
