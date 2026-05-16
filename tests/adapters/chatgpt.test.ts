import { describe, expect, it } from 'vitest'
import { ChatGPTAdapter } from '../../src/adapters/chatgpt'

describe('chatGPTAdapter', () => {
  it('prefers the ChatGPT conversation API so hidden or virtualized turns are exported', async () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-visible">
          <h6>ChatGPT said:</h6>
          <div class="markdown prose"><p>Only visible turn.</p></div>
        </article>
      </main>
    `

    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({ accessToken: 'test-access-token' }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          title: 'Full API Conversation',
          current_node: 'assistant-2',
          mapping: {
            'root': { id: 'root', parent: null, children: ['user-1'] },
            'user-1': {
              id: 'user-1',
              parent: 'root',
              children: ['assistant-1'],
              message: {
                author: { role: 'user' },
                create_time: 1,
                content: { content_type: 'text', parts: ['Question 1'] },
              },
            },
            'assistant-1': {
              id: 'assistant-1',
              parent: 'user-1',
              children: ['user-2'],
              message: {
                author: { role: 'assistant' },
                create_time: 2,
                content: {
                  content_type: 'text',
                  parts: ['### Answer 1\n\n- Item A\n- Item B'],
                },
              },
            },
            'user-2': {
              id: 'user-2',
              parent: 'assistant-1',
              children: ['assistant-2'],
              message: {
                author: { role: 'user' },
                create_time: 3,
                content: {
                  content_type: 'multimodal_text',
                  parts: [
                    'Question 2',
                    {
                      content_type: 'image_asset_pointer',
                      asset_pointer: 'file-service://file-upload-123',
                      alt_text: 'Uploaded image',
                    },
                  ],
                },
              },
            },
            'assistant-2': {
              id: 'assistant-2',
              parent: 'user-2',
              children: [],
              message: {
                author: { role: 'assistant' },
                create_time: 4,
                content: { content_type: 'text', parts: ['Answer 2 with [link](https://example.com).'] },
                metadata: {
                  thoughts: 'Need to include the cited page.',
                  content_references: [
                    { title: 'Example', url: 'https://example.com' },
                  ],
                },
              },
            },
          },
        }),
      } as Response
    })

    const adapter = new ChatGPTAdapter({
      document,
      fetch,
      location: new URL('https://chatgpt.com/c/abc'),
      now: () => new Date('2026-05-16T08:00:00.000Z'),
    })

    await expect(adapter.extract()).resolves.toMatchObject({
      title: 'Full API Conversation',
      messages: [
        { role: 'user', content: [{ type: 'markdown', markdown: 'Question 1' }] },
        {
          role: 'assistant',
          content: [{ type: 'markdown', markdown: '### Answer 1\n\n- Item A\n- Item B' }],
        },
        {
          role: 'user',
          content: [
            { type: 'markdown', markdown: 'Question 2' },
            {
              type: 'image',
              url: 'https://chatgpt.com/backend-api/files/file-upload-123/download',
              alt: 'Uploaded image',
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            { type: 'thinking', text: 'Need to include the cited page.' },
            { type: 'markdown', markdown: 'Answer 2 with [link](https://example.com).' },
            {
              type: 'references',
              links: [{ title: 'Example', url: 'https://example.com' }],
            },
          ],
        },
      ],
    })

    expect(fetch).toHaveBeenCalledWith('https://chatgpt.com/backend-api/conversation/abc', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      signal: expect.any(AbortSignal),
    })
  })

  it('times out hung API requests in API-only mode', async () => {
    vi.useFakeTimers()
    document.body.innerHTML = ''

    const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    })

    const adapter = new ChatGPTAdapter({
      accessToken: null,
      allowDomFallback: false,
      apiTimeoutMs: 25,
      document,
      fetch,
      location: new URL('https://chatgpt.com/c/hung'),
      now: () => new Date('2026-05-16T08:10:00.000Z'),
    })

    const promise = adapter.extract()
    await vi.advanceTimersByTimeAsync(25)

    await expect(promise).resolves.toMatchObject({
      messages: [],
    })
    expect(fetch).toHaveBeenCalledWith('https://chatgpt.com/backend-api/conversation/hung', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: expect.any(AbortSignal),
    })

    vi.useRealTimers()
  })

  it('can disable DOM fallback when callers need API-only extraction', async () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-visible">
          <h6>ChatGPT said:</h6>
          <div class="markdown prose"><p>Visible fallback should not be used.</p></div>
        </article>
      </main>
    `

    const adapter = new ChatGPTAdapter({
      allowDomFallback: false,
      document,
      fetch: vi.fn().mockResolvedValue({ ok: false }),
      location: new URL('https://chatgpt.com/c/api-only'),
      now: () => new Date('2026-05-16T08:10:00.000Z'),
    })

    await expect(adapter.extract()).resolves.toMatchObject({
      messages: [],
    })
  })

  it('extracts user and assistant messages from ChatGPT-like article nodes', async () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <h5>User said:</h5>
          <div class="whitespace-pre-wrap">Please write a function.</div>
        </article>
        <article data-testid="conversation-turn-2">
          <h6>ChatGPT said:</h6>
          <div class="markdown prose">
            <p>Sure.</p>
            <pre><code class="language-ts">export function add(a: number, b: number) {
  return a + b;
}</code></pre>
          </div>
        </article>
      </main>
    `

    const adapter = new ChatGPTAdapter({
      document,
      location: new URL('https://chatgpt.com/c/abc'),
      now: () => new Date('2026-05-16T07:30:00.000Z'),
    })

    await expect(adapter.extract()).resolves.toEqual({
      title: 'ChatGPT Conversation',
      source: {
        site: 'chatgpt',
        url: 'https://chatgpt.com/c/abc',
        exportedAt: '2026-05-16T07:30:00.000Z',
      },
      messages: [
        {
          role: 'user',
          content: [{ type: 'markdown', markdown: 'Please write a function.' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'markdown',
              markdown:
                'Sure.\n\n```ts\nexport function add(a: number, b: number) {\n  return a + b;\n}\n```',
            },
          ],
        },
      ],
    })
  })

  it('preserves common markdown structure when falling back to rendered DOM', async () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <h6>ChatGPT said:</h6>
          <div class="markdown prose">
            <h3>Plan</h3>
            <p>Read <a href="https://example.com/path">the source</a>.</p>
            <ul><li>First item</li><li><strong>Second</strong> item</li></ul>
            <blockquote><p>Quoted line</p></blockquote>
            <img src="https://example.com/image.png" alt="Example image">
          </div>
        </article>
      </main>
    `

    const adapter = new ChatGPTAdapter({
      document,
      fetch: vi.fn().mockResolvedValue({ ok: false }),
      location: new URL('https://chatgpt.com/c/dom-fallback'),
      now: () => new Date('2026-05-16T08:30:00.000Z'),
    })

    await expect(adapter.extract()).resolves.toMatchObject({
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'markdown',
              markdown:
                '### Plan\n\nRead [the source](https://example.com/path).\n\n- First item\n- **Second** item\n\n> Quoted line\n\n![Example image](https://example.com/image.png)',
            },
          ],
        },
      ],
    })
  })

  it('extracts thinking and references from alternate API payload shapes', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Alternate metadata',
        current_node: 'assistant',
        mapping: {
          assistant: {
            id: 'assistant',
            parent: null,
            children: [],
            message: {
              author: { role: 'assistant' },
              create_time: 1,
              content: {
                content_type: 'thoughts',
                thoughts: [{ summary: 'Checked the source list.' }],
                parts: [
                  {
                    content_type: 'reasoning',
                    text: 'Visible reasoning summary.',
                  },
                  'Final answer.',
                ],
              },
              metadata: {
                sources: [{ name: 'Source A', href: 'https://a.example' }],
                search_result_groups: [
                  {
                    entries: [{ title: 'Source B', url: 'https://b.example' }],
                  },
                ],
              },
            },
          },
        },
      }),
    })

    const adapter = new ChatGPTAdapter({
      document,
      fetch,
      location: new URL('https://chatgpt.com/c/alternate'),
      now: () => new Date('2026-05-16T09:30:00.000Z'),
    })

    await expect(adapter.extract()).resolves.toMatchObject({
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', text: 'Checked the source list.' },
            { type: 'thinking', text: 'Visible reasoning summary.' },
            { type: 'markdown', markdown: 'Final answer.' },
            {
              type: 'references',
              links: [
                { title: 'Source A', url: 'https://a.example' },
                { title: 'Source B', url: 'https://b.example' },
              ],
            },
          ],
        },
      ],
    })
  })
})
