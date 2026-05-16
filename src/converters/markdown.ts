import type { Conversation, MessageBlock } from '../model/conversation'
import type { Converter } from './types'

const roleLabels = {
  user: 'User',
  assistant: 'Assistant',
  system: 'System',
  tool: 'Tool',
  unknown: 'Unknown',
} as const

export class MarkdownConverter implements Converter {
  id = 'markdown'
  label = 'Markdown'

  convert(conversation: Conversation): string {
    const lines: string[] = [
      `# ${conversation.title || 'Untitled Conversation'}`,
      '',
      `> Source: ${conversation.source.url}`,
      `> Site: ${conversation.source.site}`,
      `> Exported: ${conversation.source.exportedAt}`,
      '',
    ]

    for (const message of conversation.messages) {
      lines.push(`## ${roleLabels[message.role]}`, '')
      lines.push(renderBlocks(message.content), '')
    }

    return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
  }
}

function renderBlocks(blocks: MessageBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === 'code') {
        const language = block.language ?? ''
        return `\`\`\`${language}\n${block.code.trimEnd()}\n\`\`\``
      }

      if (block.type === 'markdown') {
        return block.markdown.trim()
      }

      if (block.type === 'image') {
        return `![${block.alt ?? 'Image'}](${block.url})`
      }

      if (block.type === 'thinking') {
        return `<details>\n<summary>Thinking</summary>\n\n${block.text.trim()}\n\n</details>`
      }

      if (block.type === 'references') {
        const links = block.links
          .map((link, index) => `${index + 1}. [${link.title}](${link.url})`)
          .join('\n')
        return `### References\n\n${links}`
      }

      return block.text.trim()
    })
    .filter(Boolean)
    .join('\n\n')
}
