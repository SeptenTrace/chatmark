interface InlineExportControlOptions {
  document: Document
  onExport: () => Promise<void>
}

const hostId = 'chatmark-inline-export'
const hostVersion = '9'

export function mountInlineExportControl(options: InlineExportControlOptions): void {
  const existing = options.document.getElementById(hostId)
  if (existing?.dataset.chatmarkVersion === hostVersion) {
    return
  }

  existing?.remove()

  const host = options.document.createElement('div')
  host.id = hostId
  host.dataset.chatmarkVersion = hostVersion
  host.innerHTML = `
    <style>
      #${hostId} {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        display: grid;
        justify-items: end;
        gap: 8px;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #${hostId} button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid var(--border-light, rgba(0, 0, 0, 0.12));
        border-radius: 18px;
        color: var(--text-primary, #202123);
        background: var(--main-surface-primary, #ffffff);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        line-height: 1;
      }

      #${hostId} [data-chatmark-actions] {
        display: inline-flex;
        gap: 8px;
      }

      #${hostId} button:hover {
        background: var(--main-surface-secondary, #f7f7f8);
      }

      #${hostId} button:disabled {
        cursor: wait;
        opacity: 0.76;
      }

      #${hostId} svg {
        width: 15px;
        height: 15px;
        flex: 0 0 auto;
      }

      #${hostId} [data-chatmark-status] {
        display: none;
        max-width: 260px;
        padding: 7px 9px;
        border: 1px solid rgba(23, 32, 26, 0.1);
        border-radius: 8px;
        color: #17201a;
        background: rgba(248, 250, 248, 0.96);
        box-shadow: 0 8px 20px rgba(23, 32, 26, 0.12);
        font-size: 12px;
        line-height: 1.35;
      }

      #${hostId} [data-chatmark-status][data-visible="true"] {
        display: block;
      }
    </style>
    <div data-chatmark-status role="status" aria-live="polite"></div>
    <div data-chatmark-actions>
      <button data-chatmark-export type="button" title="Export this conversation as Markdown" aria-label="Export this conversation as Markdown">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Export</span>
      </button>
    </div>
  `

  const button = host.querySelector<HTMLButtonElement>('[data-chatmark-export]')
  const status = host.querySelector<HTMLElement>('[data-chatmark-status]')

  button?.addEventListener('click', () => {
    void runExport(options.onExport, button, status)
  })

  options.document.body?.append(host)
}

async function runExport(
  onExport: () => Promise<void>,
  button: HTMLButtonElement,
  status: HTMLElement | null,
): Promise<void> {
  setStatus(status, 'Exporting...')
  button.disabled = true

  try {
    await onExport()
    setStatus(status, 'Markdown download started.')
  }
  catch (error) {
    setStatus(status, error instanceof Error ? error.message : String(error))
  }
  finally {
    button.disabled = false
  }
}

function setStatus(status: HTMLElement | null, message: string): void {
  if (!status) {
    return
  }

  status.textContent = message
  status.dataset.visible = 'true'
}
