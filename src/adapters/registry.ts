import type { SiteAdapter } from './types'
import { ChatGPTAdapter } from './chatgpt'

export function createAdapterForCurrentPage(): SiteAdapter | null {
  const url = new URL(window.location.href)
  const adapters: SiteAdapter[] = [new ChatGPTAdapter()]
  return adapters.find(adapter => adapter.matches(url)) ?? null
}
