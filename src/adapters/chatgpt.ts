import type {
  Conversation,
  ConversationRole,
  Message,
  MessageBlock,
  ReferenceLink,
} from '../model/conversation'
import type { SiteAdapter } from './types'

interface ChatGPTAdapterOptions {
  accessToken?: string | null
  allowDomFallback?: boolean
  apiTimeoutMs?: number
  document?: Document
  fetch?: typeof fetch
  location?: URL
  now?: () => Date
}

export class ChatGPTAdapter implements SiteAdapter {
  id = 'chatgpt'
  label = 'ChatGPT'

  private readonly document: Document
  private readonly fetch: typeof fetch
  private readonly location: URL
  private readonly now: () => Date
  private readonly allowDomFallback: boolean
  private readonly apiTimeoutMs: number
  private accessToken: string | null | undefined
  private lastApiFailure: string | null = null

  constructor(options: ChatGPTAdapterOptions = {}) {
    this.accessToken = options.accessToken
    this.allowDomFallback = options.allowDomFallback ?? true
    this.apiTimeoutMs = options.apiTimeoutMs ?? 15_000
    this.document = options.document ?? document
    this.fetch = options.fetch ?? fetch.bind(window)
    this.location = options.location ?? new URL(window.location.href)
    this.now = options.now ?? (() => new Date())
  }

  matches(url: URL): boolean {
    return url.hostname === 'chatgpt.com' || url.hostname.endsWith('.chatgpt.com')
  }

  getLastApiFailure(): string | null {
    return this.lastApiFailure
  }

  async extract(): Promise<Conversation> {
    const apiConversation = await this.extractFromApi()
    if (apiConversation && apiConversation.messages.length > 0) {
      return apiConversation
    }

    if (!this.allowDomFallback) {
      return {
        title: this.extractTitle(),
        source: {
          site: this.id,
          url: this.location.href,
          exportedAt: this.now().toISOString(),
        },
        messages: [],
      }
    }

    const messages = this.findTurnNodes()
      .map(node => this.extractMessage(node))
      .filter((message): message is Message => message !== null)

    return {
      title: this.extractTitle(),
      source: {
        site: this.id,
        url: this.location.href,
        exportedAt: this.now().toISOString(),
      },
      messages,
    }
  }

  private async extractFromApi(): Promise<Conversation | null> {
    this.lastApiFailure = null
    const conversationId = this.extractConversationId()
    if (!conversationId) {
      this.lastApiFailure = 'No conversation id was found in the current URL.'
      return null
    }

    try {
      const apiUrl = new URL(`/backend-api/conversation/${conversationId}`, this.location.origin)
      const abortController = new AbortController()
      const timeoutId = window.setTimeout(() => abortController.abort(), this.apiTimeoutMs)

      try {
        const headers = await this.createApiHeaders(abortController.signal)
        const response = await this.fetch(apiUrl.href, {
          credentials: 'include',
          headers,
          signal: abortController.signal,
        })

        if (!response.ok) {
          const status
            = typeof response.status === 'number' ? String(response.status) : 'a non-OK response'
          this.lastApiFailure = `ChatGPT API returned ${status} ${response.statusText || ''}`.trim()
          return null
        }

        const data = await response.json()
        const conversation = this.parseApiConversation(data)
        if (!conversation) {
          this.lastApiFailure = `ChatGPT API response did not include a conversation mapping. Top-level keys: ${objectKeysForDebug(data).join(', ') || '(none)'}.`
          return null
        }
        if (conversation.messages.length === 0) {
          this.lastApiFailure = 'ChatGPT API response had a mapping but no parseable messages.'
        }

        return conversation
      }
      finally {
        window.clearTimeout(timeoutId)
      }
    }
    catch (error) {
      this.lastApiFailure
        = error instanceof Error
          ? `ChatGPT API request failed: ${error.name}: ${error.message}`
          : `ChatGPT API request failed: ${String(error)}`
      return null
    }
  }

  private async createApiHeaders(signal: AbortSignal): Promise<Record<string, string>> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const accessToken = this.accessToken ?? (await this.fetchAccessToken(signal))

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    return headers
  }

  private async fetchAccessToken(signal: AbortSignal): Promise<string | null> {
    if (this.accessToken !== undefined) {
      return this.accessToken
    }

    try {
      const sessionUrl = new URL('/api/auth/session', this.location.origin)
      const response = await this.fetch(sessionUrl.href, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal,
      })
      if (!response.ok) {
        this.accessToken = null
        return null
      }

      const data = await response.json()
      this.accessToken = isRecord(data) && typeof data.accessToken === 'string' ? data.accessToken : null
      return this.accessToken
    }
    catch {
      this.accessToken = null
      return null
    }
  }

  private extractConversationId(): string | null {
    return this.location.pathname.match(/^\/c\/([^/?#]+)/)?.[1] ?? null
  }

  private parseApiConversation(data: unknown): Conversation | null {
    if (!isRecord(data) || !isRecord(data.mapping)) {
      return null
    }

    const messages = apiNodesInDisplayOrder(data.mapping, data.current_node)
      .map(node => this.apiNodeToMessage(node))
      .filter((message): message is Message => message !== null)

    return {
      title:
        typeof data.title === 'string' && data.title.trim()
          ? data.title.trim()
          : this.extractTitle(),
      source: {
        site: this.id,
        url: this.location.href,
        exportedAt: this.now().toISOString(),
      },
      messages,
    }
  }

  private apiNodeToMessage(node: ApiNode): Message | null {
    const message = node.message
    if (!isRecord(message) || !isRecord(message.author) || !isRecord(message.content)) {
      return null
    }

    const content = apiContentToBlocks(message.content)
    const thinking = extractThinking(message.metadata)
    const references = extractReferenceLinks(message.metadata)
    const blocks: MessageBlock[] = [
      ...thinking.map(text => ({ type: 'thinking' as const, text })),
      ...content,
    ]

    if (references.length > 0) {
      blocks.push({ type: 'references', links: references })
    }

    return blocks.length > 0
      ? { role: normalizeRole(message.author.role), content: blocks }
      : null
  }

  private findTurnNodes(): HTMLElement[] {
    return Array.from(
      this.document.querySelectorAll<HTMLElement>(
        'article[data-testid^="conversation-turn-"], [data-testid^="conversation-turn-"]',
      ),
    )
  }

  private extractMessage(node: HTMLElement): Message | null {
    const role = this.extractRole(node)
    const contentRoot = this.findContentRoot(node, role)
    const content = extractBlocks(contentRoot)

    if (content.length === 0) {
      return null
    }

    return { role, content }
  }

  private extractRole(node: HTMLElement): ConversationRole {
    const authorRole = node.querySelector<HTMLElement>('[data-message-author-role]')
    const role = authorRole?.dataset.messageAuthorRole

    if (role === 'user' || role === 'assistant' || role === 'system' || role === 'tool') {
      return role
    }

    const headingText = Array.from(node.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      .map(heading => heading.textContent?.toLowerCase() ?? '')
      .join(' ')

    if (headingText.includes('chatgpt') || headingText.includes('assistant')) {
      return 'assistant'
    }

    if (headingText.includes('user') || headingText.includes('you')) {
      return 'user'
    }

    return 'unknown'
  }

  private findContentRoot(node: HTMLElement, role: ConversationRole): HTMLElement {
    if (role === 'assistant') {
      return (
        node.querySelector<HTMLElement>('.markdown')
        ?? node.querySelector<HTMLElement>('.prose')
        ?? node
      )
    }

    return node.querySelector<HTMLElement>('.whitespace-pre-wrap') ?? node
  }

  private extractTitle(): string {
    const rawTitle = this.document.title.replace(/\s*[-|]\s*ChatGPT\s*$/i, '').trim()
    return rawTitle || 'ChatGPT Conversation'
  }
}

function extractBlocks(root: HTMLElement): MessageBlock[] {
  if (root.matches('.markdown, .prose')) {
    const markdown = serializeBlockChildren(root)
    return markdown ? [{ type: 'markdown', markdown }] : []
  }

  const codeBlocks = new Set<Element>(Array.from(root.querySelectorAll('pre')))
  const blocks: MessageBlock[] = []

  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement)) {
      continue
    }

    if (child.matches('h1,h2,h3,h4,h5,h6')) {
      continue
    }

    if (child.matches('pre')) {
      const code = child.querySelector('code')
      blocks.push({
        type: 'code',
        language: extractLanguage(code),
        code: normalizeText(code?.textContent ?? child.textContent ?? ''),
      })
      continue
    }

    if (child.querySelector('pre')) {
      const text = textWithoutCode(child, codeBlocks)
      if (text) {
        blocks.push({ type: 'markdown', markdown: text })
      }

      for (const pre of Array.from(child.querySelectorAll('pre'))) {
        const code = pre.querySelector('code')
        blocks.push({
          type: 'code',
          language: extractLanguage(code),
          code: normalizeText(code?.textContent ?? pre.textContent ?? ''),
        })
      }

      continue
    }

    const text = normalizeText(child.textContent ?? '')
    if (text) {
      blocks.push({ type: 'markdown', markdown: text })
    }
  }

  if (blocks.length > 0) {
    return blocks
  }

  const text = normalizeText(root.textContent ?? '')
  return text ? [{ type: 'markdown', markdown: text }] : []
}

function textWithoutCode(root: HTMLElement, codeBlocks: Set<Element>): string {
  const pieces: string[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const textNode = walker.currentNode
    const parentPre = textNode.parentElement?.closest('pre')
    if (parentPre && codeBlocks.has(parentPre)) {
      continue
    }

    pieces.push(textNode.textContent ?? '')
  }

  return normalizeText(pieces.join(' '))
}

function extractLanguage(code: Element | null): string | undefined {
  const className = code?.getAttribute('class') ?? ''
  const match = className.match(/language-([\w+-]+)/i)
  return match?.[1]
}

function normalizeText(value: string): string {
  return value.replace(/\u00A0/g, ' ').replace(/[ \t]+\n/g, '\n').trim()
}

function serializeBlockChildren(root: Element): string {
  return Array.from(root.childNodes)
    .map(node => serializeBlockNode(node))
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function serializeBlockNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeInlineText(node.textContent ?? '').trim()
  }

  if (!(node instanceof HTMLElement)) {
    return ''
  }

  const tag = node.tagName.toLowerCase()
  if (/^h[1-6]$/.test(tag)) {
    return `${'#'.repeat(Number(tag[1]))} ${serializeInlineChildren(node)}`.trim()
  }

  if (tag === 'p') {
    return serializeInlineChildren(node)
  }

  if (tag === 'ul' || tag === 'ol') {
    return serializeList(node, tag === 'ol')
  }

  if (tag === 'blockquote') {
    const quote = serializeBlockChildren(node) || serializeInlineChildren(node)
    return quote
      .split('\n')
      .map(line => `> ${line}`.trimEnd())
      .join('\n')
  }

  if (tag === 'pre') {
    const code = node.querySelector('code')
    const language = extractLanguage(code)
    const body = normalizeText(code?.textContent ?? node.textContent ?? '')
    return `\`\`\`${language ?? ''}\n${body}\n\`\`\``
  }

  if (tag === 'img') {
    return serializeImage(node)
  }

  if (node.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,pre,img')) {
    return serializeBlockChildren(node)
  }

  return serializeInlineChildren(node)
}

function serializeList(list: HTMLElement, ordered: boolean): string {
  return Array.from(list.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'LI')
    .map((item, index) => {
      const nestedLists = Array.from(item.children).filter(child =>
        child.matches('ul,ol'),
      ) as HTMLElement[]
      const itemClone = item.cloneNode(true) as HTMLElement
      for (const nested of Array.from(itemClone.querySelectorAll('ul,ol'))) {
        nested.remove()
      }

      const marker = ordered ? `${index + 1}.` : '-'
      const firstLine = `${marker} ${serializeInlineChildren(itemClone)}`.trim()
      const nested = nestedLists.map(nestedList => serializeBlockNode(nestedList)).join('\n')
      return nested ? `${firstLine}\n${indentLines(nested)}` : firstLine
    })
    .join('\n')
}

function serializeInlineChildren(root: Element): string {
  return Array.from(root.childNodes)
    .map(node => serializeInlineNode(node))
    .join('')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function serializeInlineNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeInlineText(node.textContent ?? '')
  }

  if (!(node instanceof HTMLElement)) {
    return ''
  }

  const tag = node.tagName.toLowerCase()
  if (tag === 'br') {
    return '\n'
  }

  if (tag === 'a') {
    const href = node.getAttribute('href')
    const text = serializeInlineChildren(node) || href || ''
    return href ? `[${text}](${href})` : text
  }

  if (tag === 'strong' || tag === 'b') {
    return `**${serializeInlineChildren(node)}**`
  }

  if (tag === 'em' || tag === 'i') {
    return `*${serializeInlineChildren(node)}*`
  }

  if (tag === 'code') {
    return `\`${normalizeInlineText(node.textContent ?? '')}\``
  }

  if (tag === 'img') {
    return serializeImage(node)
  }

  return serializeInlineChildren(node)
}

function serializeImage(image: HTMLElement): string {
  const src = image.getAttribute('src')
  if (!src) {
    return ''
  }

  return `![${image.getAttribute('alt') ?? 'Image'}](${src})`
}

function normalizeInlineText(value: string): string {
  return value.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ')
}

function indentLines(value: string): string {
  return value
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n')
}

interface ApiNode {
  id: string
  parent?: string | null
  message?: unknown
}

function apiNodesInDisplayOrder(mapping: Record<string, unknown>, currentNode: unknown): ApiNode[] {
  const nodes = new Map<string, ApiNode>()
  for (const [id, rawNode] of Object.entries(mapping)) {
    if (!isRecord(rawNode)) {
      continue
    }

    nodes.set(id, {
      id,
      parent: typeof rawNode.parent === 'string' ? rawNode.parent : null,
      message: rawNode.message,
    })
  }

  if (typeof currentNode === 'string' && nodes.has(currentNode)) {
    const path: ApiNode[] = []
    const seen = new Set<string>()
    let cursor: string | null | undefined = currentNode

    while (cursor && nodes.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor)
      const node = nodes.get(cursor)
      if (node) {
        path.push(node)
        cursor = node.parent
      }
    }

    return path.reverse()
  }

  return Array.from(nodes.values()).sort((a, b) => apiCreateTime(a) - apiCreateTime(b))
}

function apiCreateTime(node: ApiNode): number {
  if (!isRecord(node.message) || typeof node.message.create_time !== 'number') {
    return Number.MAX_SAFE_INTEGER
  }

  return node.message.create_time
}

function apiContentToBlocks(content: Record<string, unknown>): MessageBlock[] {
  const parts = Array.isArray(content.parts) ? content.parts : []
  const blocks: MessageBlock[] = [
    ...extractThinking(content.thoughts).map(text => ({ type: 'thinking' as const, text })),
    ...parts.flatMap(part => apiPartToBlocks(part)),
  ]

  if (blocks.length > 0) {
    return blocks
  }

  if (typeof content.text === 'string' && content.text.trim()) {
    return [{ type: 'markdown', markdown: content.text.trim() }]
  }

  return []
}

function apiPartToBlocks(part: unknown): MessageBlock[] {
  if (typeof part === 'string') {
    const markdown = part.trim()
    return markdown ? [{ type: 'markdown', markdown }] : []
  }

  if (!isRecord(part)) {
    return []
  }

  const imageUrl = pickString(part.url, part.image_url, part.asset_pointer)
  const contentType = typeof part.content_type === 'string' ? part.content_type : ''
  if (contentType.includes('reasoning') || contentType.includes('thought')) {
    const text = pickString(part.text, part.content, part.summary)
    return text ? [{ type: 'thinking', text: text.trim() }] : []
  }

  if (imageUrl && (contentType.includes('image') || isLikelyImageUrl(imageUrl))) {
    return [
      {
        type: 'image',
        url: normalizeImageUrl(imageUrl),
        alt: pickString(part.alt, part.alt_text, part.name) ?? 'Image',
      },
    ]
  }

  const markdown = pickString(part.text, part.content, part.markdown)
  return markdown ? [{ type: 'markdown', markdown: markdown.trim() }] : []
}

function extractThinking(metadata: unknown): string[] {
  if (typeof metadata === 'string') {
    return metadata.trim() ? [metadata.trim()] : []
  }

  if (Array.isArray(metadata)) {
    return metadata.flatMap(item => extractThinking(item))
  }

  if (!isRecord(metadata)) {
    return []
  }

  const direct = pickString(
    metadata.thoughts,
    metadata.thinking,
    metadata.reasoning,
    metadata.reasoning_content,
    metadata.summary,
    metadata.text,
  )

  return direct ? [direct.trim()] : []
}

function extractReferenceLinks(metadata: unknown): ReferenceLink[] {
  if (!isRecord(metadata)) {
    return []
  }

  const seen = new Set<string>()
  const links: ReferenceLink[] = []
  collectReferenceLinks(metadata.content_references, links, seen)
  collectReferenceLinks(metadata.citations, links, seen)
  collectReferenceLinks(metadata.sources, links, seen)
  collectReferenceLinks(metadata.search_result_groups, links, seen)
  return links
}

function collectReferenceLinks(value: unknown, links: ReferenceLink[], seen: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectReferenceLinks(item, links, seen)
    }
    return
  }

  if (!isRecord(value)) {
    return
  }

  const url = pickString(value.url, value.href, value.link)
  if (url?.startsWith('http') && !seen.has(url)) {
    seen.add(url)
    links.push({
      title: pickString(value.title, value.name, value.domain) ?? url,
      url,
    })
  }

  for (const nested of Object.values(value)) {
    if (typeof nested === 'object' && nested !== null) {
      collectReferenceLinks(nested, links, seen)
    }
  }
}

function normalizeRole(value: unknown): ConversationRole {
  return value === 'user' || value === 'assistant' || value === 'system' || value === 'tool'
    ? value
    : 'unknown'
}

function pickString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.trim() !== '')
}

function isLikelyImageUrl(value: string): boolean {
  return (
    value.startsWith('file-service://')
    || (/^https?:\/\//.test(value) && /\.(?:png|jpe?g|gif|webp|avif)(?:\?|#|$)/i.test(value))
  )
}

function normalizeImageUrl(value: string): string {
  if (value.startsWith('file-service://')) {
    const fileId = value.replace('file-service://', '')
    return `https://chatgpt.com/backend-api/files/${fileId}/download`
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function objectKeysForDebug(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value).slice(0, 12) : []
}
