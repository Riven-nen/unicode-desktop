/** Shared terminal event shapes (main ↔ preload ↔ renderer). */

export interface TerminalDataEvent {
  stream: 'stdout' | 'stderr'
  data: string
}

export interface TerminalExitEvent {
  code: number | null
}

/** Input for a temporary local copy of a student submission snapshot. */
export interface SubmissionLocalRunInput {
  submissionId: string
  fileName: string
  language: string
  content: string
}

/** A prepared temporary directory/file for a professor's local run. */
export interface SubmissionLocalRun {
  runId: string
  directory: string
  filePath: string
}
