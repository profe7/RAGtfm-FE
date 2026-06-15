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

export function HealthStatusPanel({ health }: { health: HealthReadyResult }) {
  const checks = Object.entries(health.checks || {})

  return (
    <div className={`health-panel${health.ready ? ' health-panel--ready' : ' health-panel--bad'}`}>
      <div className="health-panel-head">
        <span className={`health-dot${health.ready ? ' health-dot--ok' : ' health-dot--bad'}`} />
        <span>API {health.ready ? 'Ready' : health.status}</span>
      </div>
      {checks.length > 0 && (
        <div className="health-mini-list">
          {checks.map(([name, check]) => (
            <span key={name} className="health-mini-item" title={check.error}>
              <span className={`health-dot${check.ok ? ' health-dot--ok' : ' health-dot--bad'}`} />
              {formatCheckName(name)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
