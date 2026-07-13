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

async function* throwingStream(error: Error): AsyncGenerator<RagStreamEvent> {
  if (error) throw error
  yield { type: 'error', data: 'unreachable' }
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

    expect(askRagMock).toHaveBeenNthCalledWith(
      1, 'my-token', 'first?', 5, ['doc-1'], null, expect.any(AbortSignal),
    )
    expect(askRagMock).toHaveBeenNthCalledWith(
      2, 'my-token', 'follow-up?', 10, ['doc-1'], 'conv-9', expect.any(AbortSignal),
    )
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

  it('records an inline error on the assistant turn when the stream fails', async () => {
    askRagMock.mockReturnValue(throwingStream(new Error('backend exploded')))

    const { result } = renderHook(() => useRag('token'))

    await act(async () => {
      await result.current.sendMessage('hi', 5, [])
    })

    await waitFor(() => expect(result.current.error).toBe('backend exploded'))
    expect(result.current.messages[1].error).toBe('backend exploded')
    expect(result.current.isStreaming).toBe(false)
  })

  it('retries the last request after a failure', async () => {
    askRagMock.mockReturnValueOnce(throwingStream(new Error('network down')))

    const { result } = renderHook(() => useRag('token'))

    await act(async () => {
      await result.current.sendMessage('hi', 5, [])
    })
    expect(result.current.messages[1].error).toBe('network down')

    askRagMock.mockReturnValueOnce(streamOf([{ type: 'token', data: 'recovered' }]))
    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].content).toBe('recovered')
    expect(result.current.messages[1].error).toBeUndefined()
  })
})
