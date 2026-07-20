import { useState } from 'react'
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
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <div className="sidebar-logo">R</div>
          <div>
            <p className="sidebar-name">RAGtfm</p>
            <p className="sidebar-version">Internal knowledge</p>
          </div>
        </div>
        <button
          aria-controls="workspace-tools"
          aria-expanded={toolsOpen}
          className="mobile-tools-toggle"
          type="button"
          onClick={() => setToolsOpen(open => !open)}
        >
          <span className={`health-dot${health.ready ? ' health-dot--ok' : ' health-dot--bad'}`} />
          Tools
          <span className="mobile-tools-chevron" aria-hidden="true">⌄</span>
        </button>
      </div>

      <div
        className={`sidebar-tools${toolsOpen ? ' sidebar-tools--open' : ''}`}
        id="workspace-tools"
      >
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
      </div>
    </aside>
  )
}
