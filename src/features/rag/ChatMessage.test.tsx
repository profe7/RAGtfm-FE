import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ChatMessage } from './ChatMessage'
import type { ChatMessage as ChatMessageType } from './useRag'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

function assistant(overrides: Partial<ChatMessageType> = {}): ChatMessageType {
  return { id: 'a1', role: 'assistant', content: '', sources: [], metrics: {}, ...overrides }
}

describe('ChatMessage', () => {
  it('renders assistant content as markdown', () => {
    render(
      <ChatMessage
        message={assistant({ content: 'Here is **bold** and a list:\n\n- one\n- two' })}
        isStreaming={false}
        isLast
        onRetry={() => {}}
      />,
    )

    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('turns [source: id] into a citation that expands the matching source', async () => {
    const user = userEvent.setup()
    render(
      <ChatMessage
        message={assistant({
          content: 'The answer is 42 [source: c1].',
          sources: [{ chunk_id: 'c1', text: 'the source text', metadata: {} }],
        })}
        isStreaming={false}
        isLast
        onRetry={() => {}}
      />,
    )

    const citation = screen.getByRole('link', { name: '1' })
    const details = screen.getByText('Source 1').closest('details') as HTMLDetailsElement
    expect(details.open).toBe(false)

    await user.click(citation)
    expect(details.open).toBe(true)
  })

  it('links a numeric [source: N] to the Nth source (ordinal citations)', async () => {
    const user = userEvent.setup()
    render(
      <ChatMessage
        message={assistant({
          content: 'Charge it on the base [source: 1] or via the cable [source: 2].',
          sources: [
            { chunk_id: 'doc-c1', text: 'base charging', metadata: {} },
            { chunk_id: 'doc-c2', text: 'cable charging', metadata: {} },
          ],
        })}
        isStreaming={false}
        isLast
        onRetry={() => {}}
      />,
    )

    const details2 = screen.getByText('Source 2').closest('details') as HTMLDetailsElement
    expect(details2.open).toBe(false)

    await user.click(screen.getByRole('link', { name: '2' }))
    expect(details2.open).toBe(true)
  })

  it('opens original PDF evidence when citation provenance is available', async () => {
    const user = userEvent.setup()
    const onOpenEvidence = vi.fn()
    const source = {
      chunk_id: 'doc-c1',
      text: 'original evidence',
      metadata: {},
      citation: {
        document_id: 'doc-1',
        filename: 'report.pdf',
        chunk_type: 'text',
        page_numbers: [4],
        source_locations: [],
      },
    }
    render(
      <ChatMessage
        message={assistant({ content: 'Grounded claim [source: 1].', sources: [source] })}
        isStreaming={false}
        isLast
        onRetry={() => {}}
        onOpenEvidence={onOpenEvidence}
      />,
    )

    await user.click(screen.getByRole('link', { name: '1' }))
    expect(onOpenEvidence).toHaveBeenCalledWith(source)
    expect(screen.getByText(/page 4/)).toBeTruthy()
  })

  it('shows an inline error with a Retry button that fires onRetry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <ChatMessage message={assistant({ error: 'boom' })} isStreaming={false} isLast onRetry={onRetry} />,
    )

    expect(screen.getByText(/boom/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('renders a user turn as plain text, not markdown', () => {
    render(
      <ChatMessage
        message={{ id: 'u1', role: 'user', content: '**not bold**', sources: [], metrics: {} }}
        isStreaming={false}
        isLast
        onRetry={() => {}}
      />,
    )

    expect(screen.getByText('**not bold**')).toBeTruthy()
    expect(screen.queryByText('not bold')).toBeNull()
  })
})
