import { exportCurrentConversationAsMarkdown } from '../export/current-conversation'
import { downloadTextFile } from '../export/download'
import { createMarkdownFilename } from '../export/filename'
import { mountInlineExportControl } from './inline-export-control'

const inlineControlOptions = {
  document,
  onExport: async () => {
    const markdown = await exportCurrentConversationAsMarkdown()
    downloadTextFile({
      document,
      filename: createMarkdownFilename(document.title),
      mimeType: 'text/markdown;charset=utf-8',
      text: markdown,
    })
  },
}

mountInlineExportControl(inlineControlOptions)
window.setInterval(mountInlineExportControl, 2_000, inlineControlOptions)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'CHATMARK_EXPORT_ACTIVE') {
    return false
  }

  void exportCurrentConversationAsMarkdown()
    .then((markdown) => {
      sendResponse({
        ok: true,
        markdown,
        filename: createMarkdownFilename(document.title),
      })
    })
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    })

  return true
})
