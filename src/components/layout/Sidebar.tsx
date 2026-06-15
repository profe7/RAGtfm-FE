import type { HealthReadyResult } from '../../api'
import { HealthStatusPanel } from '../../features/health/HealthStatusPanel'
import { StatCard } from '../ui/StatCard'
import { UploadForm } from '../../features/documents/UploadForm'

interface SidebarProps {
  health: HealthReadyResult
  totalDocs: number
  readyDocsCount: number
  totalChunks: number
  onUpload: (file: File) => Promise<void>
  isUploading: boolean
  onLogout: () => void
  isLogoutDisabled: boolean
}

export function Sidebar({
  health,
  totalDocs,
  readyDocsCount,
  totalChunks,
  onUpload,
  isUploading,
  onLogout,
  isLogoutDisabled,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">R</div>
        <div>
          <p className="sidebar-name">RAGtfm</p>
          <p className="sidebar-version">v0.1</p>
        </div>
      </div>

      <HealthStatusPanel health={health} />

      <div className="sidebar-stats">
        <StatCard label="Documents" value={totalDocs.toString()} />
        <StatCard label="Ready" value={readyDocsCount.toString()} />
        <StatCard label="Chunks" value={totalChunks.toLocaleString()} />
      </div>

      <UploadForm onUpload={onUpload} isUploading={isUploading} />

      <button
        className="btn btn--ghost btn--full sidebar-logout"
        type="button"
        onClick={onLogout}
        disabled={isLogoutDisabled}
      >
        Sign out
      </button>
    </aside>
  )
}
