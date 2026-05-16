import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountInlineExportControl } from '../../src/content/inline-export-control'

describe('mountInlineExportControl', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('injects one export button and calls the export handler when clicked', async () => {
    const onExport = vi.fn().mockResolvedValue(undefined)

    mountInlineExportControl({ document, onExport })
    mountInlineExportControl({ document, onExport })

    const buttons = document.querySelectorAll<HTMLButtonElement>('[data-chatmark-export]')
    expect(buttons).toHaveLength(1)

    buttons[0].click()
    await vi.waitFor(() => expect(onExport).toHaveBeenCalledTimes(1))
  })

  it('shows an error message when the export handler fails', async () => {
    const onExport = vi.fn().mockRejectedValue(new Error('No messages found'))

    mountInlineExportControl({ document, onExport })
    document.querySelector<HTMLButtonElement>('[data-chatmark-export]')?.click()

    await vi.waitFor(() => {
      expect(document.querySelector('[data-chatmark-status]')?.textContent).toBe(
        'No messages found',
      )
    })
  })
})
