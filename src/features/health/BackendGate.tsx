import type { HealthReadyResult } from '../../api'

function formatCheckName(name: string) {
  const labels: Record<string, string> = {
    postgres: 'Postgres',
    redis: 'Redis',
    chroma: 'ChromaDB',
    s3: 'S3',
    ollama: 'Ollama',
  }
  return labels[name] ?? name
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

export function BackendGate({
  health,
  checked,
}: {
  health: HealthReadyResult
  checked: boolean
}) {
  const checks = Object.entries(health.checks || {})
  const title = checked ? 'Backend is starting' : 'Checking backend'
  const detail = health.error || (
    checked
      ? 'One or more required services are unavailable. Retrying automatically.'
      : 'Verifying API readiness before loading the app.'
  )

  return (
    <div className="backend-gate">
      <div className="backend-gate-card">
        <div className="auth-logo">R</div>
        <p className="auth-tagline">RAGtfm</p>
        <h1 className="backend-gate-title">{title}</h1>
        <p className="backend-gate-copy">{detail}</p>

        {checks.length > 0 && (
          <div className="health-check-list">
            {checks.map(([name, check]) => (
              <div key={name} className="health-check-row">
                <span className={`health-dot${check.ok ? ' health-dot--ok' : ' health-dot--bad'}`} />
                <span>{formatCheckName(name)}</span>
                <span className="health-check-detail">
                  {check.ok
                    ? check.latency_ms != null ? fmtMs(check.latency_ms) : 'ok'
                    : check.error ?? 'unavailable'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="backend-retry">
          <span className="spinner" />
          <span>Retrying every 7s</span>
        </div>
      </div>
    </div>
  )
}
