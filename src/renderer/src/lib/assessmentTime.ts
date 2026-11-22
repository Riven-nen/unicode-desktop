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

const formatMoment = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

/**
 * A live seatwork's close time is a hard cutoff. If it falls before the
 * configured duration ends, students silently get a shorter window than the
 * form says. Return a form error instead.
 */
export function liveWindowError(
  durationMinutes: number,
  opensAt: string | null,
  closesAt: string | null
): string | null {
  if (!opensAt || !closesAt) return null
  const openMs = Date.parse(opensAt)
  const closeMs = Date.parse(closesAt)
  if (!Number.isFinite(openMs) || !Number.isFinite(closeMs)) return null
  if (closeMs <= openMs) return 'The closing time must be after the opening time.'
  const durationMs = Math.round(durationMinutes) * 60_000
  if (Number.isFinite(durationMs) && closeMs < openMs + durationMs) {
    const available = Math.max(1, Math.floor((closeMs - openMs) / 60_000))
    return `The close time cuts the ${Math.round(durationMinutes)}-minute window to ${available} minute${available === 1 ? '' : 's'}. Move the close time later or set the duration to ${available} minute${available === 1 ? '' : 's'}.`
  }
  return null
}

export function timingSummary(
  assignment: Pick<StudentAssignment, 'timingMode' | 'durationMinutes' | 'opensAt' | 'closesAt'>
): string {
  if (assignment.timingMode === 'none') return ''
  const configured = assignment.durationMinutes
  const duration = configured ? `${configured} min` : 'timed'
  if (assignment.timingMode === 'live_window') {
    if (assignment.opensAt && assignment.closesAt) {
      const openMs = Date.parse(assignment.opensAt)
      const closeMs = Date.parse(assignment.closesAt)
      const windowMinutes =
        Number.isFinite(openMs) && Number.isFinite(closeMs)
          ? Math.max(1, Math.round((closeMs - openMs) / 60_000))
          : null
      const effective =
        windowMinutes !== null && configured ? Math.min(windowMinutes, configured) : windowMinutes
      return `Shared ${effective ?? 'timed'} min window ${formatMoment(
        assignment.opensAt
      )} → ${formatMoment(assignment.closesAt)}`
    }
    return assignment.opensAt
      ? `Shared ${duration} window from ${formatMoment(assignment.opensAt)}`
      : `Shared ${duration} window`
  }
  return `${duration} · starts when you open it`
}
