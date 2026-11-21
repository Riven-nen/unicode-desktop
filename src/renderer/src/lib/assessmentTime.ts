import type { StudentAssessmentSession, StudentAssignment } from '../types/student'

/** Milliseconds left for a session, corrected by the server clock offset. */
export function assessmentRemainingMs(
  session: Pick<StudentAssessmentSession, 'expiresAt' | 'serverOffsetMs'> | null,
  localNow: number = Date.now()
): number | null {
  if (!session?.expiresAt) return null
  const deadline = Date.parse(session.expiresAt)
  if (!Number.isFinite(deadline)) return null
  return deadline - (localNow + session.serverOffsetMs)
}

/** `mm:ss`, or `h:mm:ss` for limits over an hour. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number): string => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

export type AssessmentAvailability = 'upcoming' | 'open' | 'closed'

/**
 * Display-only availability for a seatwork. The start RPC re-checks the same
 * window against the server clock, so a wrong local clock cannot open it.
 */
export function assessmentAvailability(
  assignment: Pick<StudentAssignment, 'opensAt' | 'closesAt'>,
  localNow: number = Date.now()
): AssessmentAvailability {
  if (assignment.opensAt && Date.parse(assignment.opensAt) > localNow) return 'upcoming'
  if (assignment.closesAt && Date.parse(assignment.closesAt) < localNow) return 'closed'
  return 'open'
}

export function timingSummary(
  assignment: Pick<StudentAssignment, 'timingMode' | 'durationMinutes' | 'opensAt' | 'closesAt'>
): string {
  if (assignment.timingMode === 'none') return ''
  const duration = assignment.durationMinutes ? `${assignment.durationMinutes} min` : 'timed'
  if (assignment.timingMode === 'live_window') {
    return assignment.opensAt
      ? `Shared ${duration} window from ${new Date(assignment.opensAt).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`
      : `Shared ${duration} window`
  }
  return `${duration} · starts when you open it`
}
