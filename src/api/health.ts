import { API_BASE_URL } from './client'

export type HealthCheck = {
  ok: boolean
  latency_ms?: number
  error?: string
}

export type HealthReadyResponse = {
  status: string
  checks: Record<string, HealthCheck>
}

export type HealthReadyResult = HealthReadyResponse & {
  ready: boolean
  error?: string
}

export async function checkBackendReady(): Promise<HealthReadyResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/health/ready`)
    const data = await response.json().catch(() => null) as Partial<HealthReadyResponse> | null

    const checks = data?.checks ?? {}
    const hasChecks = Object.keys(checks).length > 0
    const allChecksPass = hasChecks
      ? Object.values(checks).every(c => c.ok)
      : response.ok
    const ready = response.ok && allChecksPass

    return {
      ready,
      status: data?.status ?? (ready ? 'ok' : 'degraded'),
      checks,
    }
  } catch (err) {
    return {
      ready: false,
      status: 'unavailable',
      checks: {},
      error: err instanceof Error ? err.message : 'Could not reach backend',
    }
  }
}
