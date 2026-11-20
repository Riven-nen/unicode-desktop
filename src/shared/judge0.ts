/** Shared Judge0 configuration and result shapes (main ↔ preload ↔ renderer). */

export interface Judge0PublicConfig {
  hasToken: boolean
  configured: boolean
}

export interface Judge0SaveConfigInput {
  /** undefined = keep the saved token, null = clear it, string = replace. */
  token?: string | null
}

export interface Judge0RunInput {
  source: string
  languageId: number
  stdin: string
  expectedOutput: string
  timeoutMs?: number
}

export interface Judge0RawResult {
  stdout: string
  stderr: string
  compileOutput: string
  message: string | null
  statusId: number
  statusDescription: string
  time: string | null
  memory: number | null
}

export interface Judge0Status {
  ok: boolean
  configured: boolean
  message: string
  version?: string
}
