import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { useBackendHealth } from '../features/health/useBackendHealth'
import { BackendGate } from '../features/health/BackendGate'
import { Sidebar } from '../components/layout/Sidebar'
import { DocumentList } from '../features/documents/DocumentList'
import { AskPanel } from '../features/rag/AskPanel'
import { useDocuments } from '../features/documents/useDocuments'
import { useRag } from '../features/rag/useRag'
import { useToast } from '../hooks/useToast'
import { Toast } from '../components/ui/Toast'

export function Dashboard() {
  const { token, logout } = useAuth()
  const { health, checked } = useBackendHealth()
  const { message, error, showToast } = useToast()

  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 5

  const {
    documents,
    totalDocs,
    totalPages,
    isLoading: isDocsLoading,
    refetch: refetchDocs,
    uploadDocument,
    isUploading,
    deleteDocument,
    isDeleting,
    deletingId,
  } = useDocuments(token, health.ready, currentPage, PAGE_SIZE)

  const { ragResult, isStreaming, askQuestion } = useRag(token)

  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])

  // Block the entire UI until the health check resolves
  if (!checked || !health.ready) {
    return <BackendGate health={health} checked={checked} />
  }

  // Redirect to login if unauthenticated
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // Derived state
  const readyDocuments = documents.filter(d => d.status.toUpperCase() === 'READY')
  const totalChunks = documents.reduce((t, d) => t + d.stored_chunk_count, 0)

  // Handlers
  const handleLogout = () => {
    logout()
  }

  const handleUpload = async (file: File) => {
    try {
      await uploadDocument(file)
      showToast('PDF uploaded — processing has started.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', true)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id)
      setSelectedDocumentIds(prev => prev.filter(docId => docId !== id))
      showToast('Document deleted.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', true)
    }
  }

  const handleToggleDoc = (id: string) => {
    setSelectedDocumentIds(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id],
    )
  }

  const handleAsk = async (question: string, limit: number) => {
    try {
      await askQuestion(question, limit, selectedDocumentIds)
      showToast('Done.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Stream failed', true)
    }
  }

  return (
    <div className="app-root">
      <Sidebar
        health={health}
        totalDocs={totalDocs}
        readyDocsCount={readyDocuments.length}
        totalChunks={totalChunks}
        onUpload={handleUpload}
        isUploading={isUploading}
        onLogout={handleLogout}
        isLogoutDisabled={isStreaming || isUploading}
      />

      <main className="main">
        <DocumentList
          documents={documents}
          selectedDocumentIds={selectedDocumentIds}
          onToggleDoc={handleToggleDoc}
          onDelete={handleDelete}
          onRefresh={refetchDocs}
          isLoading={isDocsLoading}
          isDeleting={isDeleting}
          deletingId={deletingId}
          currentPage={currentPage}
          totalPages={totalPages}
          totalDocs={totalDocs}
          onPageChange={setCurrentPage}
        />

        <AskPanel
          onAsk={handleAsk}
          ragResult={ragResult}
          isStreaming={isStreaming}
        />
      </main>

      <Toast message={message} error={error} />
    </div>
  )
}
