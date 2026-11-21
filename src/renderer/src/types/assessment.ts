/** Shared shapes for timed assignments and live seatworks. */

export type AssessmentKind = 'assignment' | 'seatwork'

/**
 * `none` is an ordinary, untimed task. `duration` starts the clock when the
 * student opens the task. `live_window` anchors every student's clock to the
 * shared opening time, so a class that starts late still loses the same time.
 */
export type AssessmentTimingMode = 'none' | 'duration' | 'live_window'

export type AssessmentSessionStatus =
  'active' | 'submitted' | 'auto_submitted' | 'expired' | 'abandoned'

export interface AssessmentSession {
  sessionId: string
  assignmentId: string
  status: AssessmentSessionStatus
  startedAt: string
  expiresAt: string | null
  serverNow: string
  /**
   * `serverNow - local time at receipt`. Use it with `Date.now()` to render a
   * countdown without trusting the student's system clock.
   */
  serverOffsetMs: number
  draftContent: string
  draftRevision: number
}

export interface AssessmentSessionSummary {
  sessionId: string
  studentId: string
  studentName: string
  studentEmail: string
  status: AssessmentSessionStatus
  startedAt: string
  expiresAt: string | null
  submittedAt: string | null
  lastSavedAt: string | null
  draftRevision: number
  finalSubmissionId: string | null
  serverNow: string
  serverOffsetMs: number
}

export interface AssessmentDraftResult {
  revision: number
  savedAt: string
  expiresAt: string | null
  serverNow: string
  serverOffsetMs: number
  status: AssessmentSessionStatus
}

export interface AssessmentSubmissionResult {
  submissionId: string
  status: AssessmentSessionStatus
  submittedAt: string
}

export function isAssessmentTimed(mode: AssessmentTimingMode): boolean {
  return mode !== 'none'
}

export function isSeatworkKind(kind: AssessmentKind): boolean {
  return kind === 'seatwork'
}

export function isSessionTerminal(status: AssessmentSessionStatus): boolean {
  return status !== 'active'
}

export function sessionStatusLabel(status: AssessmentSessionStatus): string {
  switch (status) {
    case 'active':
      return 'In progress'
    case 'submitted':
      return 'Submitted'
    case 'auto_submitted':
      return 'Auto-submitted'
    case 'expired':
      return 'Expired'
    case 'abandoned':
      return 'Abandoned'
  }
}
