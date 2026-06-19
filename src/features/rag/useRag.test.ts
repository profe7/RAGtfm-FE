import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRag } from './useRag'
import type { RagStreamEvent } from '../../api'

const { askRagMock } = vi.hoisted(() => ({ askRagMock: vi.fn() }))
vi.mock('../../api', () => ({
  askRag: (...args: unknown[]) => askRagMock(...args),
}))

async function* streamOf(events: RagStreamEvent[]) {
  for (const event of events) yield event
}

describe('useRag', () => {
  afterEach(() => {
    askRagMock.mockReset()
  })

  it('accumulates tokens, sources, and metrics into a single result', async () => {
    askRagMock.mockReturnValue(
      streamOf([
        { type: 'sources', data: [{ chunk_id: 'c1', text: 'ctx', metadata: {} }] },
        { type: 'token', data: 'Hello' },
        { type: 'token', data: ', world' },
        { type: 'metrics', data: { total_ms: 12 } },
      ]),
    )

    const { result } = renderHook(() => useRag('token'))

    await act(async () => {
      await result.current.askQuestion('hi', 5, [])
    })

    expect(result.current.ragResult).toMatchObject({
      query: 'hi',
      answer: 'Hello, world',
      metrics: { total_ms: 12 },
    })
    expect(result.current.ragResult?.sources).toHaveLength(1)
    expect(result.current.isStreaming).toBe(false)
  })

  it('passes the question, limit, and selected documents through to askRag', async () => {
    askRagMock.mockReturnValue(streamOf([]))

    const { result } = renderHook(() => useRag('my-token'))

    await act(async () => {
      await result.current.askQuestion('question?', 10, ['doc-1'])
    })

    expect(askRagMock).toHaveBeenCalledWith('my-token', 'question?', 10, ['doc-1'])
  })

  it('surfaces an error event and resets the streaming flag', async () => {
    askRagMock.mockReturnValue(
      streamOf([{ type: 'error', data: 'backend exploded' }]),
    )

    const { result } = renderHook(() => useRag('token'))

    await act(async () => {
      await expect(result.current.askQuestion('hi', 5, [])).rejects.toThrow(
        'backend exploded',
      )
    })

    await waitFor(() => expect(result.current.error).toBe('backend exploded'))
    expect(result.current.isStreaming).toBe(false)
  })
})
