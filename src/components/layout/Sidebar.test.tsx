import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Sidebar } from './Sidebar'

const health = {
  ready: true,
  status: 'ok',
  checks: {
    postgres: { ok: true, latency_ms: 3 },
  },
}

describe('Sidebar', () => {
  it('exposes workspace tools through an accessible mobile disclosure', async () => {
    const user = userEvent.setup()
    render(
      <Sidebar
        health={health}
        totalDocs={4}
        readyDocsCount={3}
        totalChunks={120}
        onUpload={vi.fn()}
        isUploading={false}
        onLogout={vi.fn()}
        isLogoutDisabled={false}
      />,
    )

    const toggle = screen.getByRole('button', { name: /tools/i })
    const tools = document.getElementById('workspace-tools')

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(tools).not.toHaveClass('sidebar-tools--open')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(tools).toHaveClass('sidebar-tools--open')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
  })
})
