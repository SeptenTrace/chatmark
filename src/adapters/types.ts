import type { Conversation } from '../model/conversation'

export interface SiteAdapter {
  id: string
  label: string
  matches: (url: URL) => boolean
  extract: () => Promise<Conversation>
}
