/**
 * Clipboard access for the browser-only admin demo.
 */

/** Reads plain text from the system clipboard. */
export async function readClipboardText(): Promise<string> {
  return navigator.clipboard.readText()
}

/** Writes plain text to the system clipboard. */
export async function writeClipboardText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}
