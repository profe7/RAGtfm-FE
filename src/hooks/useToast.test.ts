import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from './useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with no message or error', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.message).toBe('')
    expect(result.current.error).toBe('')
  })

  it('shows a success message', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Saved')
    })

    expect(result.current.message).toBe('Saved')
    expect(result.current.error).toBe('')
  })

  it('shows an error message and clears any success message', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Saved')
    })
    act(() => {
      result.current.showToast('Failed', true)
    })

    expect(result.current.error).toBe('Failed')
    expect(result.current.message).toBe('')
  })

  it('auto-dismisses after 3500ms', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Saved')
    })
    expect(result.current.message).toBe('Saved')

    act(() => {
      vi.advanceTimersByTime(3500)
    })

    expect(result.current.message).toBe('')
    expect(result.current.error).toBe('')
  })
})
