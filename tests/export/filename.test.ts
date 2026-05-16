import { describe, expect, it } from 'vitest'
import { createMarkdownFilename } from '../../src/export/filename'

describe('createMarkdownFilename', () => {
  it('creates a safe markdown filename from the conversation title', () => {
    expect(createMarkdownFilename('Temporal任务调度解析 - ChatGPT')).toBe(
      'Temporal任务调度解析.md',
    )
    expect(createMarkdownFilename('///')).toBe('chatmark-export.md')
  })
})
