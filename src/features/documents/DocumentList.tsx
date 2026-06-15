import { StatusBadge } from '../../components/ui/StatusBadge'
import type { DocumentItem } from '../../api'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface DocumentListProps {
  documents: DocumentItem[]
  selectedDocumentIds: string[]
  onToggleDoc: (id: string) => void
  onDelete: (id: string) => void
  onRefresh: () => void
  isLoading: boolean
  isDeleting: boolean
  deletingId?: string
  currentPage: number
  totalPages: number
  totalDocs: number
  onPageChange: (page: number) => void
}

export function DocumentList({
  documents,
  selectedDocumentIds,
  onToggleDoc,
  onDelete,
  onRefresh,
  isLoading,
  isDeleting,
  deletingId,
  currentPage,
  totalPages,
  totalDocs,
  onPageChange,
}: DocumentListProps) {
  const readyDocuments = documents.filter(d => d.status.toUpperCase() === 'READY')

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Documents</h2>
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      {documents.length === 0 && !isLoading ? (
        <p className="empty">No documents yet. Upload a PDF to get started.</p>
      ) : (
        <div className="doc-list">
          {documents.map(doc => {
            const isReady = doc.status.toUpperCase() === 'READY'
            const isProcessing = doc.status.toUpperCase() === 'PROCESSING'
            const isSelected = selectedDocumentIds.includes(doc.document_id)
            const isCurrentlyDeleting = isDeleting && deletingId === doc.document_id

            return (
              <label
                key={doc.document_id}
                className={`doc-row${isSelected ? ' doc-row--selected' : ''}${!isReady ? ' doc-row--disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  disabled={!isReady}
                  checked={isSelected}
                  onChange={() => onToggleDoc(doc.document_id)}
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
                  onClick={e => { e.preventDefault(); onDelete(doc.document_id) }}
                  disabled={isLoading || isProcessing || isDeleting}
                >
                  {isCurrentlyDeleting ? '…' : 'Delete'}
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
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(currentPage - 1)}
          >
            ← Prev
          </button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages} ({totalDocs} total)
          </span>
          <button
            className="btn btn--ghost btn--sm"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(currentPage + 1)}
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
  )
}
