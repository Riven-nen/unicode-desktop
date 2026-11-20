import { useEffect } from 'react'
import { Calendar, FileText, FolderOpen, Send, X } from 'lucide-react'
import type { StudentAssignment } from '../types/student'

interface AssignmentDetailModalProps {
  assignment: StudentAssignment | null
  /** Stable reference time captured by the dashboard for due-date flags. */
  now: number
  /** True while this assignment is waiting in the offline submission queue. */
  queued: boolean
  /** True while this assignment is being submitted from the card or modal. */
  submitting: boolean
  onClose: () => void
  onOpenFile: (assignment: StudentAssignment) => void
  onSubmit: (assignment: StudentAssignment) => void
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
  onClose,
  onOpenFile,
  onSubmit
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
  const status = queued
    ? 'queued'
    : latest === null
      ? 'new'
      : latest.grade !== null
        ? 'graded'
        : 'submitted'
  const due = assignment.dueAt ? new Date(assignment.dueAt) : null
  const late =
    due !== null && latest !== null ? new Date(latest.submittedAt).getTime() > due.getTime() : false
  const overdue = due !== null && latest === null && due.getTime() < now

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
            {status === 'queued'
              ? 'Queued'
              : status === 'graded' && latest
                ? `Graded · ${latest.grade}`
                : status === 'submitted'
                  ? 'Submitted'
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
          <button
            className="btn-primary"
            disabled={submitting || queued}
            onClick={() => onSubmit(assignment)}
          >
            <Send size={12} />
            {queued ? 'Queued' : submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
