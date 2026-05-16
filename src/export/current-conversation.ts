import { createAdapterForCurrentPage } from '../adapters/registry'
import { MarkdownConverter } from '../converters/markdown'

export async function exportCurrentConversationAsMarkdown(): Promise<string> {
  const adapter = createAdapterForCurrentPage()
  if (!adapter) {
    throw new Error('This site is not supported by ChatMark yet.')
  }

  const conversation = await adapter.extract()
  if (conversation.messages.length === 0) {
    throw new Error('No conversation messages were found on this page.')
  }

  return new MarkdownConverter().convert(conversation)
}
