import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  askRag,
  deleteDocument,
  listDocuments,
  login,
  logout,
  register,
  uploadPdf,
} from './api'
import './App.css'
import type { DocumentItem, RagResponse } from './api'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ragtfm_token') ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [question, setQuestion] = useState('')
  const [limit, setLimit] = useState(5)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [ragResult, setRagResult] = useState<RagResponse | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const readyDocuments = useMemo(
    () => documents.filter((document) => document.status.toUpperCase() === 'READY'),
    [documents],
  )

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string, isError = false) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (isError) {
      setError(msg)
      setMessage('')
    } else {
      setMessage(msg)
      setError('')
    }
    toastTimer.current = setTimeout(() => {
      setMessage('')
      setError('')
    }, 3500)
  }

  function toggleDocumentSelection(id: string) {
    setSelectedDocumentIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  async function run(action: string, task: () => Promise<void>) {
    setLoading(action)
    setError('')
    try {
      await task()
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'Something went wrong', true)
    } finally {
      setLoading(null)
    }
  }

  const refreshDocuments = useCallback(async (activeToken = token) => {
    if (!activeToken) return
    const data = await listDocuments(activeToken)
    setDocuments(data.documents)
  }, [token])

  useEffect(() => {
    if (!token) return

    let isCurrent = true

    async function loadInitialDocuments() {
      try {
        const data = await listDocuments(token)
        if (isCurrent) {
          setDocuments(data.documents)
        }
      } catch (caughtError) {
        if (isCurrent) {
          setError(caughtError instanceof Error ? caughtError.message : 'Could not load documents')
        }
      }
    }

    void loadInitialDocuments()

    return () => {
      isCurrent = false
    }
  }, [token])

  function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    void run(authMode, async () => {
      if (authMode === 'register') {
        await register(email, password)
        setAuthMode('login')
        showToast('Account created. Sign in with the same email and password.')
        return
      }

      const data = await login(email, password)
      localStorage.setItem('ragtfm_token', data.access_token)
      setToken(data.access_token)
      showToast('Signed in.')
      await refreshDocuments(data.access_token)
    })
  }

  function handleLogout() {
    void run('logout', async () => {
      if (token) {
        await logout(token)
      }
      localStorage.removeItem('ragtfm_token')
      setToken('')
      setDocuments([])
      setRagResult(null)
      showToast('Signed out.')
    })
  }

  function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedFile) return

    void run('upload', async () => {
      await uploadPdf(token, selectedFile)
      setSelectedFile(null)
      showToast('PDF uploaded. Processing has started.')
      await refreshDocuments()
    })
  }

  function handleDelete(documentId: string) {
    void run(`delete-${documentId}`, async () => {
      await deleteDocument(token, documentId)
      showToast('Document deleted.')
      await refreshDocuments()
    })
  }

  function handleAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    void run('ask', async () => {
      const result = await askRag(token, question.trim(), limit, selectedDocumentIds)
      setRagResult(result)
      showToast('Answer generated.')
    })
  }

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="brand-mark" aria-hidden="true">
            R
          </div>
          <p className="eyebrow">RAGtfm</p>
          <h1 id="auth-title">Too lazy to read the manual? RAGtfm!</h1>
          <p className="lead">
            Sign in, upload documents, and ask questions against our FastAPI RAG backend.
          </p>

          <div className="segmented" aria-label="Authentication mode">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => setAuthMode('register')}
            >
              Register
            </button>
          </div>

          <form className="stack" onSubmit={handleAuthSubmit}>
            <label>
              Email
              <input
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum one solid secret"
                required
              />
            </label>
            <button className="primary-action" type="submit" disabled={loading !== null}>
              {loading === authMode ? 'Working...' : authMode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>

        </section>
        <Toast message={message} error={error} />
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">RAGtfm V0.1</p>
          <h1>Dashboard</h1>
        </div>
        <button type="button" className="ghost-action" onClick={handleLogout} disabled={loading !== null}>
          Logout
        </button>
      </header>


      <section className="metrics-strip" aria-label="Workspace summary">
        <SummaryTile label="Documents" value={documents.length.toString()} />
        <SummaryTile label="Ready" value={readyDocuments.length.toString()} />
        <SummaryTile
          label="Chunks"
          value={documents.reduce((total, document) => total + document.stored_chunk_count, 0).toString()}
        />
      </section>

      <div className="workspace-grid">
        <section className="tool-panel" aria-labelledby="upload-title">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Ingestion</p>
              <h2 id="upload-title">Upload PDF</h2>
            </div>
            <button type="button" className="icon-action" onClick={() => void refreshDocuments()} title="Refresh documents">
              Refresh
            </button>
          </div>

          <form className="upload-zone" onSubmit={handleUpload}>
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <label htmlFor="pdf-upload">
              <span>{selectedFile ? selectedFile.name : 'Choose a PDF'}</span>
              <small>{selectedFile ? formatBytes(selectedFile.size) : 'The backend will process it asynchronously.'}</small>
            </label>
            <button className="primary-action" type="submit" disabled={!selectedFile || loading !== null}>
              {loading === 'upload' ? 'Uploading...' : 'Upload'}
            </button>
          </form>

          <div className="document-list" aria-label="Documents">
            {documents.length === 0 ? (
              <p className="empty-state">No documents yet.</p>
            ) : (
              documents.map((document) => {
                const isReady = document.status.toUpperCase() === 'READY'
                const isSelected = selectedDocumentIds.includes(document.document_id)
                return (
                  <article
                    className={`document-row${isSelected ? ' document-row--selected' : ''}`}
                    key={document.document_id}
                  >
                    <label className="document-select-label">
                      <input
                        type="checkbox"
                        disabled={!isReady}
                        checked={isSelected}
                        onChange={() => toggleDocumentSelection(document.document_id)}
                      />
                      <div>
                        <h3>{document.original_filename}</h3>
                        <p>
                          {document.status} · {document.stored_chunk_count}/{document.chunk_count} chunks ·{' '}
                          {formatBytes(document.size_bytes)}
                        </p>
                      </div>
                    </label>
                    <button
                      type="button"
                      className="danger-action"
                      onClick={() => handleDelete(document.document_id)}
                      disabled={loading !== null}
                    >
                      Delete
                    </button>
                  </article>
                )
              })
            )}
            {readyDocuments.length > 0 && (
              <p className="selection-hint">
                {selectedDocumentIds.length === 0
                  ? 'No filter — querying all documents'
                  : `Querying ${selectedDocumentIds.length} selected document${selectedDocumentIds.length > 1 ? 's' : ''}`}
              </p>
            )}
          </div>
        </section>

        <section className="tool-panel answer-panel" aria-labelledby="ask-title">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Retrieval augmented generation</p>
              <h2 id="ask-title">Ask your documents</h2>
            </div>
            <label className="limit-control">
              Sources
              <input
                type="number"
                min="1"
                max="20"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              />
            </label>
          </div>

          <form className="question-form" onSubmit={handleAsk}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a question about the uploaded PDFs..."
              rows={5}
              required
            />
            <button className="primary-action" type="submit" disabled={!question.trim() || loading !== null}>
              {loading === 'ask' ? 'Thinking...' : 'Ask'}
            </button>
          </form>

          {ragResult ? (
            <div className="answer-output">
              <h3>Answer</h3>
              <p>{ragResult.answer}</p>

              <div className="timing-grid">
                {Object.entries(ragResult.metrics).map(([key, value]) => (
                  <SummaryTile key={key} label={key.replace('_', ' ')} value={`${Math.round(value)} ms`} />
                ))}
              </div>

              <h3>Sources</h3>
              <div className="source-list">
                {ragResult.sources.map((source, index) => (
                  <details key={source.chunk_id} open={index === 0}>
                    <summary>
                      Source {index + 1}
                      {source.rerank_score != null ? ` · score ${source.rerank_score.toFixed(3)}` : ''}
                    </summary>
                    <p>{source.text}</p>
                  </details>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty-state">Upload a ready document, then ask away.</p>
          )}
        </section>
      </div>
      <Toast message={message} error={error} />
    </main>
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
      <span className="toast-icon">{error ? '✕' : '✓'}</span>
      <span>{error || message}</span>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default App
