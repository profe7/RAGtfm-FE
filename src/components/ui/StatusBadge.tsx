import type { CSSProperties } from 'react'

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  const color =
    s === 'READY' ? 'var(--badge-ready)' :
    s === 'FAILED' ? 'var(--badge-fail)' :
    'var(--badge-pending)'
  return (
    <span className="status-badge" style={{ '--badge-color': color } as CSSProperties}>
      {s === 'READY' ? '✓' : s === 'FAILED' ? '✕' : '⟳'} {status}
    </span>
  )
}
