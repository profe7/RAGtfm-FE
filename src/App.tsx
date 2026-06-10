import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  askRag,
  deleteDocument,
  listDocuments,
  login,
  logout,
  openDocumentEventSource,
  register,
  uploadPdf,
} from './api'
import './App.css'
import type { DocumentItem, RagResponse } from './api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  const color =
    s === 'READY' ? 'var(--badge-ready)' :
    s === 'FAILED' ? 'var(--badge-fail)' :
    'var(--badge-pending)'
  return (
    <span className="status-badge" style={{ '--badge-color': color } as React.CSSProperties}>
      {s === 'READY' ? '✓' : s === 'FAILED' ? '✕' : '⟳'} {status}
    </span>
  )
}

function Toast({ message, error }: { message: string; error: string }) {
  const visible = Boolean(message || error)
  return (
    <div
      className={`toast${error ? ' toast--error' : ''}${visible ? ' toast--visible' : ''}`}
      role="status"
      aria-live="polite"
    >
      {error || message}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

// ─── Auth screen ─────────────────────────────────────────────────────────────

interface AuthScreenProps {
  onAuth: (token: string) => void
}

function AuthScreen({ onAuth }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'register') {
        await register(email, password)
        setMode('login')
        setMessage('Account created — sign in now.')
        return
      }
      const data = await login(email, password)
      onAuth(data.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">R</div>
          <p className="auth-tagline">Too lazy to read the manual?</p>
          <h1 className="auth-title">RAGtfm</h1>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => setMode('login')}
          >Login</button>
          <button
            type="button"
            className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => setMode('register')}
          >Register</button>
        </div>

        {message && <p className="auth-message">{message}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn--primary btn--full" type="submit" disabled={loading}>
            {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Main app ─────────────────────────────────────────────────────────────────

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ragtfm_token') ?? '')

  // ── Documents state ──
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])

  // ── RAG state ──
  const [question, setQuestion] = useState('')
  const [limit, setLimit] = useState(5)
  const [ragResult, setRagResult] = useState<RagResponse | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  // ── UI state ──
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Pagination ── 
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const PAGE_SIZE = 5
  const currentPageRef = useRef(1)

  const readyDocuments = useMemo(
    () => documents.filter(d => d.status.toUpperCase() === 'READY'),
    [documents],
  )

  // ── Toast ──
  function showToast(msg: string, isError = false) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (isError) { setError(msg); setMessage('') }
    else { setMessage(msg); setError('') }
    toastTimer.current = setTimeout(() => { setMessage(''); setError('') }, 3500)
  }

  // ── EventSource for live doc status ──
  function connectEventSource(activeToken: string) {
    eventSourceRef.current?.close()
    const es = openDocumentEventSource(activeToken)
    es.addEventListener('document_status', e => {
      const data = JSON.parse((e as MessageEvent).data) as {
        document_id: string
        status: string
        chunk_count: number
        stored_chunk_count: number
      }
      setDocuments(prev =>
        prev.map(doc =>
          doc.document_id === data.document_id
            ? { ...doc, status: data.status, chunk_count: data.chunk_count, stored_chunk_count: data.stored_chunk_count }
            : doc,
        ),
      )
    })
    es.onerror = () => es.close()
    eventSourceRef.current = es
  }

  // ── Generic loading wrapper ──
  async function run(action: string, task: () => Promise<void>) {
    setLoading(action)
    setError('')
    try {
      await task()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong', true)
    } finally {
      setLoading(null)
    }
  }

  const refreshDocuments = useCallback(
    async (activeToken = token, page = currentPageRef.current) => {
      if (!activeToken) return
      const data = await listDocuments(activeToken, page, PAGE_SIZE)
      setDocuments(data.documents)
      setTotalPages(data.pages)
      setTotalDocs(data.total)
    },
    [token],
  )

  useEffect(() => {
    if (!token) return
    let active = true
    listDocuments(token, 1, PAGE_SIZE)
      .then(data => {
        if (!active) return
        setDocuments(data.documents)
        setTotalPages(data.pages)
        setTotalDocs(data.total)
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load documents') })
    connectEventSource(token)
    return () => {
      active = false
      eventSourceRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Auto-scroll answer as tokens arrive
  useEffect(() => {
    if (isStreaming && answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight
    }
  }, [ragResult?.answer, isStreaming])

  // ── Auth ──
  function handleAuth(newToken: string) {
    localStorage.setItem('ragtfm_token', newToken)
    setToken(newToken)
    connectEventSource(newToken)
    void refreshDocuments(newToken)
  }

  function handleLogout() {
    void run('logout', async () => {
      if (token) await logout(token)
      localStorage.removeItem('ragtfm_token')
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      setToken('')
      setDocuments([])
      setRagResult(null)
    })
  }

  // ── Upload ──
  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile) return
    void run('upload', async () => {
      await uploadPdf(token, selectedFile)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      showToast('PDF uploaded — processing has started.')
      await refreshDocuments()
    })
  }

  // ── Delete ──
  function handleDelete(documentId: string) {
    void run(`delete-${documentId}`, async () => {
      await deleteDocument(token, documentId)
      setSelectedDocumentIds(prev => prev.filter(id => id !== documentId))
      showToast('Document deleted.')
      await refreshDocuments()
    })
  }

  // ── Document selection ──
  function toggleDoc(id: string) {
    setSelectedDocumentIds(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id],
    )
  }

  // ── RAG stream ──
  function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    void (async () => {
      setIsStreaming(true)
      setLoading('ask')
      setError('')
      setRagResult({ query: question.trim(), answer: '', metrics: {}, sources: [] })

      try {
        for await (const event of askRag(token, question.trim(), limit, selectedDocumentIds)) {
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
        showToast('Done.')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Stream failed', true)
      } finally {
        setIsStreaming(false)
        setLoading(null)
      }
    })()
  }

  // ── Not logged in ──
  if (!token) return <AuthScreen onAuth={handleAuth} />

  const totalChunks = documents.reduce((t, d) => t + d.stored_chunk_count, 0)

  return (
    <div className="app-root">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">R</div>
          <div>
            <p className="sidebar-name">RAGtfm</p>
            <p className="sidebar-version">v0.1</p>
          </div>
        </div>

        <div className="sidebar-stats">
          <StatCard label="Documents" value={totalDocs.toString()} />
          <StatCard label="Ready" value={readyDocuments.length.toString()} />
          <StatCard label="Chunks" value={totalChunks.toLocaleString()} />
        </div>

        {/* ── Upload ── */}
        <div className="sidebar-section">
          <p className="section-label">Ingest</p>
          <form onSubmit={handleUpload}>
            <label className="file-drop">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                style={{ display: 'none' }}
              />
              <span className="file-drop-icon">↑</span>
              <span className="file-drop-name">
                {selectedFile ? selectedFile.name : 'Choose PDF'}
              </span>
              {selectedFile && (
                <span className="file-drop-size">{formatBytes(selectedFile.size)}</span>
              )}
            </label>
            <button
              className="btn btn--primary btn--full"
              type="submit"
              disabled={!selectedFile || loading !== null}
            >
              {loading === 'upload' ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        </div>

        <button
          className="btn btn--ghost btn--full sidebar-logout"
          type="button"
          onClick={handleLogout}
          disabled={loading !== null || isStreaming}
        >
          Sign out
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        {/* ── Document list ── */}
        <section className="panel">
          <div className="panel-head">
            <h2>Documents</h2>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => void refreshDocuments()}
              disabled={loading !== null}
            >
              Refresh
            </button>
          </div>

          {documents.length === 0 ? (
            <p className="empty">No documents yet. Upload a PDF to get started.</p>
          ) : (
            <div className="doc-list">
              {documents.map(doc => {
                const isReady = doc.status.toUpperCase() === 'READY'
                const isSelected = selectedDocumentIds.includes(doc.document_id)
                const isDeleting = loading === `delete-${doc.document_id}`
                return (
                  <label
                    key={doc.document_id}
                    className={`doc-row${isSelected ? ' doc-row--selected' : ''}${!isReady ? ' doc-row--disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      disabled={!isReady}
                      checked={isSelected}
                      onChange={() => toggleDoc(doc.document_id)}
                    />
                    <div className="doc-info">
                      <span className="doc-name" title={doc.original_filename}>
                        {doc.original_filename}
                      </span>
                      <span className="doc-meta">
                        {formatBytes(doc.size_bytes)} · {doc.stored_chunk_count}/{doc.chunk_count} chunks
                      </span>
                    </div>
                    <StatusBadge status={doc.status} />
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={e => { e.preventDefault(); handleDelete(doc.document_id) }}
                      disabled={loading !== null}
                    >
                      {isDeleting ? '…' : 'Delete'}
                    </button>
                  </label>
                )
              })}
            </div>
          )}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn--ghost btn--sm"
                disabled={currentPage <= 1 || loading !== null}
                onClick={() => {
                  const p = currentPage - 1
                  currentPageRef.current = p
                  setCurrentPage(p)
                  void refreshDocuments(token, p)
                }}
              >
                ← Prev
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages} ({totalDocs} total)
              </span>
              <button
                className="btn btn--ghost btn--sm"
                disabled={currentPage >= totalPages || loading !== null}
                onClick={() => {
                  const p = currentPage + 1
                  currentPageRef.current = p
                  setCurrentPage(p)
                  void refreshDocuments(token, p)
                }}
              >
                Next →
              </button>
            </div>
          )}
          {readyDocuments.length > 0 && (
            <p className="doc-filter-hint">
              {selectedDocumentIds.length === 0
                ? 'Querying all documents'
                : `Filtering to ${selectedDocumentIds.length} selected document${selectedDocumentIds.length !== 1 ? 's' : ''}`}
            </p>
          )}
        </section>

        {/* ── Ask ── */}
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
              disabled={!question.trim() || loading !== null || isStreaming}
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
      </main>

      <Toast message={message} error={error} />
    </div>
  )
}

export default App