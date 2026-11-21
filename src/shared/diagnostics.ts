/** Local language-check diagnostics shared by main, preload, and renderer. */

export interface LanguageDiagnostic {
  line: number
  column: number
  endLine: number
  endColumn: number
  message: string
}

export interface LanguageCheckInput {
  /** Monaco language id: python, java, c, or cpp. */
  language: string
  /** Workspace file name, used only to pick the temporary file name. */
  fileName: string
  source: string
}

export interface LanguageCheckResult {
  /** False when the checker/compiler is not installed or could not be run. */
  available: boolean
  diagnostics: LanguageDiagnostic[]
  /** Optional explanation when available is false. */
  message?: string
}
