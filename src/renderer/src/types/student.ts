import type { AssessmentKind, AssessmentSessionStatus, AssessmentTimingMode } from './assessment'

export interface StudentAssessmentSession {
  id: string
  status: AssessmentSessionStatus
  startedAt: string
  expiresAt: string | null
  submittedAt: string | null
  lastSavedAt: string | null
  draftRevision: number
  attemptNumber: number
  examMode: boolean
  allowedTabOuts: number
  tabOutCount: number
  fullscreenExitCount: number
  blockedPasteCount: number
  interruptionCount: number
  fullscreenRequired: boolean
  blockPaste: boolean
  runOnlyTerminal: boolean
  overrideNote: string | null
  overrideAt: string | null
  /** Corrects the local clock for countdowns; the server still owns the deadline. */
  serverOffsetMs: number
}

export interface StudentSubmission {
  id: string
  submittedAt: string
  status: string
  grade: number | null
  /** Server timestamp for the latest grade release, or null while private. */
  gradeReleasedAt: string | null
  commentCount: number
}

export interface StudentAssignment {
  id: string
  classId: string
  classCode: string
  className: string
  title: string
  description: string | null
  language: string | null
  /** Bare workspace file name, e.g. `fibonacci.py`. */
  fileName: string | null
  starterCode: string | null
  createdAt: string
  /** When the assignment became visible; null means it was published immediately. */
  publishAt: string | null
  dueAt: string | null
  autoTestEnabled: boolean
  kind: AssessmentKind
  timingMode: AssessmentTimingMode
  durationMinutes: number | null
  opensAt: string | null
  closesAt: string | null
  autoSubmit: boolean
  showTimer: boolean
  allowedTabOuts: number
  fullscreenRequired: boolean
  blockPaste: boolean
  runOnlyTerminal: boolean
  maxAttempts: number
  latestSubmission: StudentSubmission | null
  /** The latest attempt, when this is a timed assessment. */
  session: StudentAssessmentSession | null
  /** Every attempt, oldest first, for the history list. */
  attempts: StudentAssessmentSession[]
}
