import { describe, expect, it, vi } from 'vitest'
import { downloadTextFile } from '../../src/export/download'

describe('downloadTextFile', () => {
  it('creates a temporary markdown download link and removes it after clicking', async () => {
    vi.useFakeTimers()
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:chatmark')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadTextFile({
      document,
      filename: 'conversation.md',
      mimeType: 'text/markdown;charset=utf-8',
      text: '# Conversation',
    })

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download=\'conversation.md\']')).toBeNull()
    expect(revokeObjectURL).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:chatmark')
    vi.useRealTimers()
  })
})
