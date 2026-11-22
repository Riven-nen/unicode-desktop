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
  attemptNumber: number
}

export interface AssessmentExamState {
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
  serverOffsetMs: number
}

export type AssessmentEventType =
  'tab_out' | 'fullscreen_exit' | 'paste_blocked' | 'warning' | 'focus_return'

export type AssessmentEventKind = AssessmentEventType | 'override' | 'auto_submit'

export interface AssessmentEventEntry {
  id: string
  studentId: string
  eventType: AssessmentEventKind
  metadata: Record<string, unknown>
  occurredAt: string
}

export interface AssessmentEventResult {
  action: 'logged' | 'warning' | 'auto_submit'
  status: AssessmentSessionStatus
  tabOutCount: number
  fullscreenExitCount: number
  blockedPasteCount: number
  interruptionCount: number
  allowedTabOuts: number
  submissionId: string | null
  serverNow: string
  serverOffsetMs: number
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
  attemptNumber: number
  maxAttempts: number
  reopenCount: number
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

export interface AssessmentOverrideResult {
  status: AssessmentSessionStatus
  expiresAt: string | null
  interruptionCount: number
  overrideNote: string | null
  overrideAt: string | null
  serverNow: string
  serverOffsetMs: number
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
