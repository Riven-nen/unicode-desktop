/** IPC shapes for the bundled Pyright language-server bridge. */

export interface LspStartResult {
  available: boolean
  message?: string
}

export type LspMessage = Record<string, unknown>
