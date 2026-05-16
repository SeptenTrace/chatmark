# ChatMark

![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4)
![pnpm](https://img.shields.io/badge/pnpm-10.x-F69220)
![License](https://img.shields.io/badge/license-MIT-16A34A)

Export AI chats to clean Markdown, directly from the page.

ChatMark is a lightweight browser extension for saving long AI conversations without copy-paste cleanup. It currently supports ChatGPT and is built around a small adapter/converter pipeline so more AI sites and output formats can be added without rewriting the export flow.

## Features

- One-click in-page export on `https://chatgpt.com/`
- Full conversation export through ChatGPT's authenticated conversation API
- Markdown output with headings, lists, quotes, code blocks, links, images, citations, and thinking blocks
- Manifest V3 extension with no backend service
- Adapter/converter architecture for future Claude, Gemini, and other exporters

## Install

```bash
pnpm install
pnpm run build
```

Open `chrome://extensions` or `arc://extensions`, enable **Developer mode**, click **Load unpacked**, and select `dist/`.

More details: [docs/INSTALL.md](docs/INSTALL.md)

## Usage

1. Open a ChatGPT conversation.
2. Click the floating **Export** button.
3. Save the generated Markdown file.

The extension uses your active browser session on ChatGPT. It does not require a separate token, account setup, or external server.

## Development

```bash
pnpm install
pnpm run check
pnpm run package
```

Useful scripts:

- `pnpm run build` - build the unpacked extension into `dist/`
- `pnpm run lint` - run Antfu ESLint rules
- `pnpm run test` - run Vitest
- `pnpm run typecheck` - run TypeScript without emitting files
- `pnpm run package` - build `release/chatmark-v0.1.0.zip`

## Architecture

```text
src/adapters/      site-specific extraction, currently ChatGPT
src/converters/    internal conversation model to output formats
src/content/       injected page controls and message handling
src/export/        export orchestration, downloads, filenames
src/model/         shared conversation types
src/popup/         extension popup UI
```

The core flow is:

```text
ChatGPT adapter -> Conversation model -> Markdown converter -> browser download
```

## Roadmap

- Claude adapter
- Gemini adapter
- Export formats beyond Markdown
- Optional asset bundling for downloaded images

## License

MIT
