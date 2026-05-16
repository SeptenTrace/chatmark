export type ConversationRole
  = | 'user'
    | 'assistant'
    | 'system'
    | 'tool'
    | 'unknown'

export type MessageBlock
  = | { type: 'text', text: string }
    | { type: 'markdown', markdown: string }
    | { type: 'code', language?: string, code: string }
    | { type: 'image', url: string, alt?: string }
    | { type: 'thinking', text: string }
    | { type: 'references', links: ReferenceLink[] }

export interface ReferenceLink {
  title: string
  url: string
}

export interface Message {
  role: ConversationRole
  content: MessageBlock[]
}

export interface Conversation {
  title: string
  source: {
    site: string
    url: string
    exportedAt: string
  }
  messages: Message[]
}
