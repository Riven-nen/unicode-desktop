import { useEffect } from 'react'
import {
  Calendar,
  CheckCircle2,
  FileText,
  FolderOpen,
  KeyRound,
  PlayCircle,
  Send,
  Timer,
  X
} from 'lucide-react'
import {
  assessmentAvailability,
  assessmentRemainingMs,
  formatCountdown,
  timingSummary
} from '../lib/assessmentTime'
import { sessionStatusLabel } from '../types/assessment'
import type { StudentAssignment } from '../types/student'

interface AssignmentDetailModalProps {
  assignment: StudentAssignment | null
  /** Stable reference time captured by the dashboard for due-date flags. */
  now: number
  /** True while this assignment is waiting in the offline submission queue. */
  queued: boolean
  /** True while this assignment is being submitted from the card or modal. */
  submitting: boolean
  /** True while a timed assessment is starting or resuming. */
  starting: boolean
  onClose: () => void
  onOpenFile: (assignment: StudentAssignment) => void
  onSubmit: (assignment: StudentAssignment) => void
  onStart: (assignment: StudentAssignment) => void
  onRedeemCode: (sessionId: string) => void
}

const formatMoment = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

/**
 * Read-only assignment brief for students: due date, instructions, the file
 * the work belongs in, starter code, and the submission/grade state.
 */
export default function AssignmentDetailModal({
  assignment,
  now,
  queued,
  submitting,
  starting,
  onClose,
  onOpenFile,
  onSubmit,
  onStart,
  onRedeemCode
}: AssignmentDetailModalProps): React.ReactElement | null {
  useEffect(() => {
    if (!assignment) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [assignment, onClose])

  if (!assignment) return null

  const latest = assignment.latestSubmission
  const session = assignment.session
  const timed = assignment.timingMode !== 'none'
  const sessionActive = session?.status === 'active'
  const availability = assessmentAvailability(assignment, now)
  const remaining = assessmentRemainingMs(session, now)
  const seatworkSubmitted = session !== null && session.status !== 'active'
  const status = sessionActive
    ? 'active'
    : timed && seatworkSubmitted
      ? 'submitted'
      : queued
        ? 'queued'
        : latest === null
          ? 'new'
          : latest.grade !== null
            ? 'graded'
            : 'submitted'
  const due = assignment.dueAt ? new Date(assignment.dueAt) : null
  const late =
    due !== null && latest !== null ? new Date(latest.submittedAt).getTime() > due.getTime() : false
  const overdue = due !== null && latest === null && !sessionActive && due.getTime() < now

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-modal glass-panel assignment-detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="auth-header">
          <span className="auth-title">{assignment.title}</span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>

        <div className="assignment-detail-meta">
          <span className="student-class-code">{assignment.classCode}</span>
          <span className={`assignment-status is-${status}`}>
            <span className="assignment-status-dot" />
            {status === 'active'
              ? 'In progress'
              : status === 'queued'
                ? 'Queued'
                : status === 'graded' && latest
                  ? `Graded · ${latest.grade}`
                  : status === 'submitted'
                    ? timed && session
                      ? sessionStatusLabel(session.status)
                      : 'Submitted'
                    : 'Not submitted'}
          </span>
          {assignment.language && (
            <span className="assignment-language">{assignment.language}</span>
          )}
          {assignment.fileName && (
            <span className="assignment-file">
              <FileText size={10} />
              {assignment.fileName}
            </span>
          )}
        </div>

        <div className="assignment-detail-dates">
          {due && (
            <span className={`assignment-due ${late || overdue ? 'is-late' : ''}`}>
              <Calendar size={11} />
              Due {formatMoment(due.toISOString())}
            </span>
          )}
          {late && <span className="assignment-flag is-late">Late</span>}
          {overdue && <span className="assignment-flag is-overdue">Past due</span>}
          {latest && (
            <span className="assignment-due">Submitted {formatMoment(latest.submittedAt)}</span>
          )}
        </div>

        {timed && (
          <div className="assignment-detail-dates assignment-detail-timing">
            <span className="assignment-due">
              <Timer size={11} /> {timingSummary(assignment)}
            </span>
            {assignment.opensAt && (
              <span className="assignment-due">Opens {formatMoment(assignment.opensAt)}</span>
            )}
            {assignment.closesAt && (
              <span className="assignment-due">Closes {formatMoment(assignment.closesAt)}</span>
            )}
            {sessionActive && remaining !== null && (
              <span className={`seatwork-countdown ${remaining <= 5 * 60_000 ? 'is-urgent' : ''}`}>
                {remaining <= 0 ? 'Time is up' : `${formatCountdown(remaining)} left`}
              </span>
            )}
            {!assignment.autoSubmit && (
              <span className="assignment-flag is-late">Manual submit required</span>
            )}
          </div>
        )}

        {assignment.attempts.length > 1 && (
          <details className="assignment-starter assignment-attempts">
            <summary>
              Attempt history ({assignment.attempts.length}/{assignment.maxAttempts})
            </summary>
            <ul>
              {assignment.attempts.map((attempt) => (
                <li key={attempt.id}>
                  Attempt {attempt.attemptNumber}: {sessionStatusLabel(attempt.status)}
                  {attempt.submittedAt
                    ? ` · ${formatMoment(attempt.submittedAt)}`
                    : attempt.startedAt
                      ? ` · started ${formatMoment(attempt.startedAt)}`
                      : ''}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="assignment-detail-body">
          {assignment.description ? (
            <p className="assignment-detail-description">{assignment.description}</p>
          ) : (
            <p className="assignment-detail-description is-empty">
              No written instructions were added for this assignment.
            </p>
          )}

          {assignment.starterCode && (
            <details className="assignment-starter">
              <summary>Starter code</summary>
              <pre>{assignment.starterCode}</pre>
            </details>
          )}

          {queued && (
            <p className="assignment-detail-note">
              This submission is queued and will send automatically when you are back online.
            </p>
          )}

          {latest?.commentCount ? (
            <p className="assignment-detail-note">
              {latest.commentCount} professor{' '}
              {latest.commentCount === 1 ? 'comment is' : 'comments are'} attached to your latest
              submission.
            </p>
          ) : null}
        </div>

        <div className="assignment-detail-actions">
          <button className="btn-secondary" onClick={() => onOpenFile(assignment)}>
            <FolderOpen size={13} /> Open file
          </button>
          {timed && assignment.session && (
            <button className="btn-secondary" onClick={() => onRedeemCode(assignment.session!.id)}>
              <KeyRound size={13} /> Redeem code
            </button>
          )}
          {timed ? (
            sessionActive ? (
              <button
                className="btn-primary"
                disabled={starting}
                onClick={() => onStart(assignment)}
              >
                <PlayCircle size={12} /> {starting ? 'Opening…' : 'Resume'}
              </button>
            ) : seatworkSubmitted ? (
              <button className="btn-secondary" disabled>
                <CheckCircle2 size={12} />
                {session ? sessionStatusLabel(session.status) : 'Submitted'}
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
              <button
                className="btn-primary"
                disabled={starting}
                onClick={() => onStart(assignment)}
              >
                <PlayCircle size={12} /> {starting ? 'Starting…' : 'Start'}
              </button>
            )
          ) : (
            <button
              className="btn-primary"
              disabled={submitting || queued}
              onClick={() => onSubmit(assignment)}
            >
              <Send size={12} />
              {queued ? 'Queued' : submitting ? 'Submitting…' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
