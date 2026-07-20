import { lazy, Suspense, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { useBackendHealth } from '../features/health/useBackendHealth'
import { BackendGate } from '../features/health/BackendGate'
import { Sidebar } from '../components/layout/Sidebar'
import { DocumentList } from '../features/documents/DocumentList'
import { ChatPanel } from '../features/rag/ChatPanel'
import { useDocuments } from '../features/documents/useDocuments'
import { useRag } from '../features/rag/useRag'
import { useToast } from '../hooks/useToast'
import { Toast } from '../components/ui/Toast'
import { ConversationHistory } from '../features/conversations/ConversationHistory'
import { useConversations } from '../features/conversations/useConversations'
import type { RetrievedChunk } from '../api'

const EvidenceViewer = lazy(() =>
  import('../features/evidence/EvidenceViewer').then(module => ({
    default: module.EvidenceViewer,
  })),
)

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

  const conversationHistory = useConversations(token)
  const {
    messages,
    conversationId,
    isStreaming,
    sendMessage,
    retry,
    stop,
    newChat,
    openConversation,
  } = useRag(token, conversationHistory.refresh)

  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [evidenceSource, setEvidenceSource] = useState<RetrievedChunk | null>(null)

  if (!checked || !health.ready) {
    return <BackendGate health={health} checked={checked} />
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const readyDocuments = documents.filter(d => d.status.toUpperCase() === 'READY')
  const totalChunks = documents.reduce((t, d) => t + d.stored_chunk_count, 0)

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

  const handleSend = async (question: string, limit: number) => {
    await sendMessage(question, limit, selectedDocumentIds)
  }

  const handleOpenConversation = async (id: string) => {
    try {
      openConversation(await conversationHistory.load(id))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not open conversation', true)
    }
  }

  const handleRenameConversation = async (id: string, title: string) => {
    try {
      await conversationHistory.rename({ id, title })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not rename conversation', true)
    }
  }

  const handleDeleteConversation = async (id: string) => {
    if (!window.confirm('Delete this conversation and its saved evidence?')) return
    try {
      await conversationHistory.remove(id)
      if (conversationId === id) newChat()
      showToast('Conversation deleted.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete conversation', true)
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
        <header className="dashboard-intro">
          <div>
            <p className="dashboard-eyebrow">Knowledge workspace</p>
            <h1>Research with confidence</h1>
            <p>Search your internal PDFs, preserve the conversation, and inspect every citation.</p>
          </div>
          <div className="scope-summary" aria-live="polite">
            <span className="scope-summary-dot" />
            {selectedDocumentIds.length > 0
              ? `${selectedDocumentIds.length} document${selectedDocumentIds.length === 1 ? '' : 's'} in scope`
              : 'All ready documents in scope'}
          </div>
        </header>

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

        <ConversationHistory
          conversations={conversationHistory.conversations}
          activeId={conversationId}
          loadingId={conversationHistory.loadingId}
          isLoading={conversationHistory.isLoading}
          isMutating={conversationHistory.isMutating}
          onOpen={handleOpenConversation}
          onRename={handleRenameConversation}
          onDelete={handleDeleteConversation}
        />

        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          selectedCount={selectedDocumentIds.length}
          onSend={handleSend}
          onStop={stop}
          onRetry={retry}
          onNewChat={newChat}
          onOpenEvidence={setEvidenceSource}
        />
      </main>

      <Toast message={message} error={error} />
      {evidenceSource && (
        <Suspense fallback={null}>
          <EvidenceViewer
            key={evidenceSource.chunk_id}
            token={token}
            source={evidenceSource}
            onClose={() => setEvidenceSource(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
