/** Shared terminal event shapes (main ↔ preload ↔ renderer). */

export interface TerminalDataEvent {
  stream: 'stdout' | 'stderr'
  data: string
}

export interface TerminalExitEvent {
  code: number | null
}
