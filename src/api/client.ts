export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

type RequestOptions = RequestInit & { token?: string }

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (!response.ok) {
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
