import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from './client'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('request', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('prefixes the path with the API base URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await request('/auth/login')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/login', expect.any(Object))
  })

  it('attaches a Bearer Authorization header when a token is provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await request('/documents', { token: 'abc123' })

    const [, init] = fetchMock.mock.calls[0]
    const headers = init.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer abc123')
  })

  it('omits the Authorization header when no token is provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await request('/documents')

    const [, init] = fetchMock.mock.calls[0]
    const headers = init.headers as Headers
    expect(headers.has('Authorization')).toBe(false)
  })

  it('returns the parsed JSON body on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: '1', email: 'a@b.com' }))

    const result = await request<{ id: string; email: string }>('/me')

    expect(result).toEqual({ id: '1', email: 'a@b.com' })
  })

  it('returns undefined for a 204 No Content response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    const result = await request('/documents/1', { method: 'DELETE' })

    expect(result).toBeUndefined()
  })

  it('throws with a string `detail` from the error body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: 'Invalid credentials' }, { status: 401 }),
    )

    await expect(request('/auth/login')).rejects.toThrow('Invalid credentials')
  })

  it('throws with `detail.message` when detail is an object', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: { message: 'Field required' } }, { status: 422 }),
    )

    await expect(request('/auth/register')).rejects.toThrow('Field required')
  })

  it('falls back to the status code when the body has no usable detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }))

    await expect(request('/rag/query')).rejects.toThrow('Request failed with 500')
  })

  it('falls back to the status code when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('Bad Gateway', { status: 502 }),
    )

    await expect(request('/health')).rejects.toThrow('Request failed with 502')
  })

  it('throws a friendly rate-limit message on HTTP 429 using Retry-After', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 429, headers: { 'Retry-After': '12' } }),
    )

    await expect(request('/rag/query')).rejects.toThrow('try again in 12s')
  })
})
