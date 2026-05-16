export function createMarkdownFilename(title: string): string {
  const base = title
    .replace(/\s*[-|]\s*ChatGPT\s*$/i, '')
    .replace(/[^a-z0-9\u4E00-\u9FA5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return `${base || 'chatmark-export'}.md`
}
