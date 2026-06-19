import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'ragtfm_token'

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('initializes empty when no token is stored', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.token).toBe('')
  })

  it('hydrates the token from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'persisted-token')

    const { result } = renderHook(() => useAuth())

    expect(result.current.token).toBe('persisted-token')
  })

  it('persists the token to localStorage when set', () => {
    const { result } = renderHook(() => useAuth())

    act(() => {
      result.current.setToken('new-token')
    })

    expect(result.current.token).toBe('new-token')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('new-token')
  })

  it('clears the token from localStorage on logout', () => {
    localStorage.setItem(STORAGE_KEY, 'existing')
    const { result } = renderHook(() => useAuth())

    act(() => {
      result.current.logout()
    })

    expect(result.current.token).toBe('')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
