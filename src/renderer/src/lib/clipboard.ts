/**
 * Clipboard access that works both inside Electron and in a plain browser
 * tab. The preload bridge talks to Electron's clipboard directly, which is
 * what the Edit menu needs: reading the system clipboard while focus sits
 * on the menu (not the editor) is impossible via the async Clipboard API.
 * In browser sessions (vite dev without the shell) we fall back to it.
 */
const bridge = typeof window !== 'undefined' ? window.api?.clipboard : undefined

/** Reads plain text from the system clipboard. */
export async function readClipboardText(): Promise<string> {
  if (bridge) return bridge.readText()
  return navigator.clipboard.readText()
}

/** Writes plain text to the system clipboard. */
export async function writeClipboardText(text: string): Promise<void> {
  if (bridge) return bridge.writeText(text)
  return navigator.clipboard.writeText(text)
}
