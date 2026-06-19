import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login, register, logout } from './auth'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('auth API', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 't', token_type: 'bearer' }))
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('register POSTs JSON credentials', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: '1', email: 'a@b.com' }))

    await register('a@b.com', 'secret')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/auth/register')
    expect(init.method).toBe('POST')
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.com', password: 'secret' })
  })

  it('login sends a urlencoded OAuth2 password form', async () => {
    await login('a@b.com', 'secret')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/auth/login')
    expect((init.headers as Headers).get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    )

    const params = new URLSearchParams(init.body as string)
    expect(params.get('username')).toBe('a@b.com')
    expect(params.get('password')).toBe('secret')
  })

  it('logout authenticates the request with the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'logged out' }))

    await logout('my-token')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/auth/logout')
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer my-token')
  })
})
