import { CalendarClock, CheckCircle2, FileText, Info, PlayCircle, Timer } from 'lucide-react'
import {
  assessmentAvailability,
  assessmentRemainingMs,
  formatCountdown,
  timingSummary
} from '../lib/assessmentTime'
import { sessionStatusLabel } from '../types/assessment'
import type { StudentAssignment } from '../types/student'

interface StudentSeatworkCardProps {
  assignment: StudentAssignment
  localNow: number
  starting: boolean
  onStart: (assignment: StudentAssignment) => void
  onDetails: (assignment: StudentAssignment) => void
}

const formatMoment = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export default function StudentSeatworkCard({
  assignment,
  localNow,
  starting,
  onStart,
  onDetails
}: StudentSeatworkCardProps): React.ReactElement {
  const session = assignment.session
  const availability = assessmentAvailability(assignment, localNow)
  const remaining = assessmentRemainingMs(session, localNow)
  const active = session?.status === 'active'
  const submitted =
    session?.status === 'submitted' ||
    session?.status === 'auto_submitted' ||
    session?.status === 'expired' ||
    session?.status === 'abandoned'
  const urgent = active && remaining !== null && remaining <= 5 * 60_000

  const state = active
    ? 'active'
    : submitted
      ? 'submitted'
      : availability === 'upcoming'
        ? 'upcoming'
        : availability === 'closed'
          ? 'closed'
          : 'new'

  return (
    <article className={`assignment-card seatwork-card is-${state}`}>
      <div className="assignment-card-head">
        <span className="assignment-card-title">{assignment.title}</span>
        <span className={`assignment-status is-${state}`}>
          <span className="assignment-status-dot" />
          {active
            ? 'In progress'
            : submitted && session
              ? sessionStatusLabel(session.status)
              : availability === 'upcoming'
                ? 'Scheduled'
                : availability === 'closed'
                  ? 'Closed'
                  : 'Ready'}
        </span>
      </div>

      <div className="assignment-card-meta">
        <span className="seatwork-kind">
          <Timer size={10} /> Seatwork
        </span>
        {assignment.fileName && (
          <span className="assignment-file">
            <FileText size={10} />
            {assignment.fileName}
          </span>
        )}
        {assignment.language && <span className="assignment-language">{assignment.language}</span>}
        <span className="assignment-language">
          Attempt {session?.attemptNumber ?? 1}/{assignment.maxAttempts}
        </span>
      </div>

      <p className="seatwork-timing">{timingSummary(assignment)}</p>

      <div className="assignment-card-meta">
        {assignment.opensAt && (
          <span className="assignment-due">
            <CalendarClock size={10} /> Opens {formatMoment(assignment.opensAt)}
          </span>
        )}
        {assignment.closesAt && (
          <span className="assignment-due">Closes {formatMoment(assignment.closesAt)}</span>
        )}
        {active && remaining !== null && (
          <span className={`seatwork-countdown ${urgent ? 'is-urgent' : ''}`}>
            <Timer size={11} />
            {remaining <= 0 ? 'Time is up' : `${formatCountdown(remaining)} left`}
          </span>
        )}
        {submitted && assignment.latestSubmission && (
          <span className="assignment-due">
            <CheckCircle2 size={10} /> Submitted{' '}
            {formatMoment(assignment.latestSubmission.submittedAt)}
          </span>
        )}
        {submitted &&
          assignment.latestSubmission?.grade !== null &&
          assignment.latestSubmission?.grade !== undefined && (
            <span className="assignment-flag is-grade">
              Graded · {assignment.latestSubmission.grade}
            </span>
          )}
      </div>

      {assignment.description && (
        <p className="assignment-card-description">{assignment.description}</p>
      )}

      <div className="assignment-card-actions">
        <button className="btn-secondary" onClick={() => onDetails(assignment)}>
          <Info size={12} /> Details
        </button>
        {active ? (
          <button className="btn-primary" onClick={() => onStart(assignment)} disabled={starting}>
            <PlayCircle size={12} /> {starting ? 'Opening…' : 'Resume seatwork'}
          </button>
        ) : submitted ? (
          <button className="btn-secondary" disabled>
            <CheckCircle2 size={12} /> {session ? sessionStatusLabel(session.status) : 'Submitted'}
          </button>
        ) : availability === 'upcoming' ? (
          <button className="btn-secondary" disabled>
            Opens {assignment.opensAt ? formatMoment(assignment.opensAt) : 'soon'}
          </button>
        ) : availability === 'closed' ? (
          <button className="btn-secondary" disabled>
            Closed
          </button>
        ) : (
          <button className="btn-primary" onClick={() => onStart(assignment)} disabled={starting}>
            <PlayCircle size={12} /> {starting ? 'Starting…' : 'Start seatwork'}
          </button>
        )}
      </div>
      {!active && !submitted && availability === 'open' && (
        <p className="seatwork-start-note">The server timer starts as soon as you begin.</p>
      )}
    </article>
  )
}
