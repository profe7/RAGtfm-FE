export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

type RequestOptions = RequestInit & { token?: string }

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

export function notifyUnauthorized(): void {
  onUnauthorized?.()
}

export function rateLimitMessage(retryAfter?: string | null): string {
  const seconds = retryAfter ? Number(retryAfter) : NaN
  return Number.isFinite(seconds) && seconds > 0
    ? `Too many requests — try again in ${seconds}s.`
    : 'Too many requests — please slow down and try again shortly.'
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (!response.ok) {
    if (response.status === 401 && options.token) notifyUnauthorized()
    if (response.status === 429) {
      throw new Error(rateLimitMessage(response.headers.get('Retry-After')))
    }

    const error = await response.json().catch(() => null)
    const detail = error?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : typeof detail === 'object' && detail !== null
          ? (detail.message ?? JSON.stringify(detail))
          : `Request failed with ${response.status}`
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
