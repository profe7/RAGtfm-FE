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

  it('appends a user turn and streams tokens, sources, and metrics into the assistant turn', async () => {
    askRagMock.mockReturnValue(
      streamOf([
        { type: 'conversation', data: { conversation_id: 'conv-1' } },
        { type: 'sources', data: [{ chunk_id: 'c1', text: 'ctx', metadata: {} }] },
        { type: 'token', data: 'Hello' },
        { type: 'token', data: ', world' },
        { type: 'metrics', data: { total_ms: 12 } },
      ]),
    )

    const { result } = renderHook(() => useRag('token'))

    await act(async () => {
      await result.current.sendMessage('hi', 5, [])
    })

    expect(result.current.messages).toHaveLength(2)
    const [user, assistant] = result.current.messages
    expect(user).toMatchObject({ role: 'user', content: 'hi' })
    expect(assistant).toMatchObject({
      role: 'assistant',
      content: 'Hello, world',
      metrics: { total_ms: 12 },
    })
    expect(assistant.sources).toHaveLength(1)
    expect(result.current.conversationId).toBe('conv-1')
    expect(result.current.isStreaming).toBe(false)
  })

  it('threads the conversation id back on the next turn', async () => {
    askRagMock.mockReturnValueOnce(
      streamOf([{ type: 'conversation', data: { conversation_id: 'conv-9' } }]),
    )
    askRagMock.mockReturnValueOnce(streamOf([]))

    const { result } = renderHook(() => useRag('my-token'))

    await act(async () => {
      await result.current.sendMessage('first?', 5, ['doc-1'])
    })
    await act(async () => {
      await result.current.sendMessage('follow-up?', 10, ['doc-1'])
    })

    expect(askRagMock).toHaveBeenNthCalledWith(1, 'my-token', 'first?', 5, ['doc-1'], null)
    expect(askRagMock).toHaveBeenNthCalledWith(2, 'my-token', 'follow-up?', 10, ['doc-1'], 'conv-9')
    expect(result.current.messages).toHaveLength(4)
  })

  it('resets the thread and conversation on newChat', async () => {
    askRagMock.mockReturnValue(
      streamOf([{ type: 'conversation', data: { conversation_id: 'conv-1' } }]),
    )

    const { result } = renderHook(() => useRag('token'))

    await act(async () => {
      await result.current.sendMessage('hi', 5, [])
    })
    act(() => {
      result.current.newChat()
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.conversationId).toBeNull()
  })

  it('surfaces an error event and resets the streaming flag', async () => {
    askRagMock.mockReturnValue(streamOf([{ type: 'error', data: 'backend exploded' }]))

    const { result } = renderHook(() => useRag('token'))

    await act(async () => {
      await expect(result.current.sendMessage('hi', 5, [])).rejects.toThrow('backend exploded')
    })

    await waitFor(() => expect(result.current.error).toBe('backend exploded'))
    expect(result.current.isStreaming).toBe(false)
  })
})
