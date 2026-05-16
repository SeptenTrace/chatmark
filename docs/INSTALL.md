# Install ChatMark

ChatMark is a Manifest V3 browser extension. Install it from a release zip, or build it locally and load the generated extension as an unpacked extension.

## Install From Release Zip

1. Download the latest zip from [GitHub Releases](https://github.com/SeptenTrace/chatmark/releases/latest).
2. Unzip it to a local folder.
3. Open `chrome://extensions` or `arc://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the unzipped folder.
7. Open or refresh `https://chatgpt.com/`.

## Build From Source

```bash
pnpm install
pnpm run build
```

The unpacked extension is generated at:

```text
dist/
```

## Load In Chrome Or Arc

1. Open `chrome://extensions` or `arc://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist/` directory from this repository.
5. Open or refresh `https://chatgpt.com/`.

ChatMark injects a small `Export` button on supported chat pages. Click it to download the current conversation as Markdown.

## Refresh After Changes

After editing source code:

```bash
pnpm run build
```

Then open `chrome://extensions` or `arc://extensions` and click **Reload** on ChatMark. Refresh any open ChatGPT tab so the content script updates.

## Pack A Zip

```bash
pnpm run package
```

The browser-ready zip is written to:

```text
release/chatmark-v0.1.0.zip
```

Use the zip for sharing or release uploads. For local development, `Load unpacked` with `dist/` is faster.
