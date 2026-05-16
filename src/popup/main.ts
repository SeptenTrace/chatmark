const exportButton = document.querySelector<HTMLButtonElement>('#export')
const statusNode = document.querySelector<HTMLElement>('#status')

exportButton?.addEventListener('click', () => {
  void exportActiveTab()
})

async function exportActiveTab(): Promise<void> {
  setStatus('Exporting...')
  setBusy(true)

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab.id) {
      throw new Error('No active tab was found.')
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'CHATMARK_EXPORT_ACTIVE',
    })

    if (!response?.ok) {
      throw new Error(response?.error ?? 'Export failed.')
    }

    const url = URL.createObjectURL(
      new Blob([response.markdown], { type: 'text/markdown;charset=utf-8' }),
    )

    await chrome.downloads.download({
      url,
      filename: response.filename ?? 'chatmark-export.md',
      saveAs: true,
    })

    setStatus('Markdown export started.')
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
  catch (error) {
    setStatus(error instanceof Error ? error.message : String(error))
  }
  finally {
    setBusy(false)
  }
}

function setStatus(message: string): void {
  if (statusNode) {
    statusNode.textContent = message
  }
}

function setBusy(isBusy: boolean): void {
  if (exportButton) {
    exportButton.disabled = isBusy
  }
}
