interface DownloadTextFileOptions {
  document: Document
  filename: string
  mimeType: string
  text: string
}

export function downloadTextFile(options: DownloadTextFileOptions): void {
  const url = URL.createObjectURL(new Blob([options.text], { type: options.mimeType }))
  const anchor = options.document.createElement('a')

  anchor.href = url
  anchor.download = options.filename
  anchor.style.display = 'none'

  options.document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
