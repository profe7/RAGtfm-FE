import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askRag } from './rag'
import type { RagStreamEvent } from './rag'

function streamResponse(chunks: string[], init: ResponseInit = {}) {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, { status: 200, ...init })
}

async function collect(query = 'q', limit = 5, docs?: string[]) {
  const events: RagStreamEvent[] = []
  for await (const event of askRag('token', query, limit, docs)) {
    events.push(event)
  }
  return events
}

describe('askRag', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('parses newline-delimited JSON events in order', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        '{"type":"sources","data":[]}\n',
        '{"type":"token","data":"Hello"}\n',
        '{"type":"token","data":" world"}\n',
        '{"type":"metrics","data":{"total_ms":42}}\n',
      ]),
    )

    const events = await collect()

    expect(events.map(e => e.type)).toEqual(['sources', 'token', 'token', 'metrics'])
    expect(events[1]).toEqual({ type: 'token', data: 'Hello' })
    expect(events[3]).toEqual({ type: 'metrics', data: { total_ms: 42 } })
  })

  it('reassembles JSON lines split across stream chunks', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        '{"type":"to',
        'ken","data":"Hi"}\n{"type":"tok',
        'en","data":"!"}\n',
      ]),
    )

    const events = await collect()

    expect(events).toEqual([
      { type: 'token', data: 'Hi' },
      { type: 'token', data: '!' },
    ])
  })

  it('flushes a trailing line that has no final newline', async () => {
    fetchMock.mockResolvedValue(
      streamResponse(['{"type":"token","data":"end"}']),
    )

    const events = await collect()

    expect(events).toEqual([{ type: 'token', data: 'end' }])
  })

  it('skips blank lines and unparseable garbage', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        '\n',
        'not-json\n',
        '{"type":"token","data":"ok"}\n',
      ]),
    )

    const events = await collect()

    expect(events).toEqual([{ type: 'token', data: 'ok' }])
  })

  it('only includes document_ids in the body when some are selected', async () => {
    fetchMock.mockResolvedValue(streamResponse([]))
    await collect('q', 3, ['doc-1', 'doc-2'])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/rag/query')
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'q',
      limit: 3,
      document_ids: ['doc-1', 'doc-2'],
    })
  })

  it('omits document_ids when none are selected', async () => {
    fetchMock.mockResolvedValue(streamResponse([]))
    await collect('q', 3, [])

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body as string)).toEqual({ query: 'q', limit: 3 })
  })

  it('includes conversation_id when continuing a conversation', async () => {
    fetchMock.mockResolvedValue(streamResponse([]))
    const events: RagStreamEvent[] = []
    for await (const event of askRag('token', 'q', 3, [], 'conv-1')) events.push(event)

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'q',
      limit: 3,
      conversation_id: 'conv-1',
    })
  })

  it('parses the leading conversation frame', async () => {
    fetchMock.mockResolvedValue(
      streamResponse(['{"type":"conversation","data":{"conversation_id":"conv-7"}}\n']),
    )

    const events = await collect()

    expect(events).toEqual([{ type: 'conversation', data: { conversation_id: 'conv-7' } }])
  })

  it('throws when the response status is not ok', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }))

    await expect(collect()).rejects.toThrow('Stream request failed: 500')
  })

  it('throws a friendly rate-limit error on HTTP 429', async () => {
    fetchMock.mockResolvedValue(
      new Response('slow down', { status: 429, headers: { 'Retry-After': '30' } }),
    )

    await expect(collect()).rejects.toThrow('try again in 30s')
  })
})
