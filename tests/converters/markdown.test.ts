import type { Conversation } from '../../src/model/conversation'
import { describe, expect, it } from 'vitest'
import { MarkdownConverter } from '../../src/converters/markdown'

describe('markdownConverter', () => {
  it('renders conversation metadata, text, and fenced code blocks', () => {
    const conversation: Conversation = {
      title: 'Exporting ChatGPT',
      source: {
        site: 'chatgpt',
        url: 'https://chatgpt.com/c/abc',
        exportedAt: '2026-05-16T07:30:00.000Z',
      },
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Give me a JS snippet.' }],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Here is one:' },
            { type: 'code', language: 'js', code: 'console.log(\'hello\');' },
          ],
        },
      ],
    }

    expect(new MarkdownConverter().convert(conversation)).toBe(`# Exporting ChatGPT

> Source: https://chatgpt.com/c/abc
> Site: chatgpt
> Exported: 2026-05-16T07:30:00.000Z

## User

Give me a JS snippet.

## Assistant

Here is one:

\`\`\`js
console.log('hello');
\`\`\`
`)
  })

  it('preserves markdown, images, references, and thinking blocks', () => {
    const conversation: Conversation = {
      title: 'Rich export',
      source: {
        site: 'chatgpt',
        url: 'https://chatgpt.com/c/rich',
        exportedAt: '2026-05-16T08:00:00.000Z',
      },
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', text: 'I should compare the two sources.' },
            {
              type: 'markdown',
              markdown:
                '### Summary\n\n- One\n- Two\n\n> Important\n\nRead [OpenAI](https://openai.com/).',
            },
            {
              type: 'image',
              url: 'https://example.com/chart.png',
              alt: 'Chart',
            },
            {
              type: 'references',
              links: [
                { title: 'OpenAI', url: 'https://openai.com/' },
                { title: 'Docs', url: 'https://platform.openai.com/docs' },
              ],
            },
          ],
        },
      ],
    }

    expect(new MarkdownConverter().convert(conversation)).toContain(`## Assistant

<details>
<summary>Thinking</summary>

I should compare the two sources.

</details>

### Summary

- One
- Two

> Important

Read [OpenAI](https://openai.com/).

![Chart](https://example.com/chart.png)

### References

1. [OpenAI](https://openai.com/)
2. [Docs](https://platform.openai.com/docs)`)
  })
})
