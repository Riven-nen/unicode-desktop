import {
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  FileText,
  Flag,
  Gauge,
  MessageSquare
} from 'lucide-react'
import BandBadge from './BandBadge'
import { initialsOf } from '../../lib/initials'
import type { AssignmentSummary, RosterStudent, SubmissionSummary } from '../../types/professor'

interface StudentViewProps {
  student: RosterStudent
  submissions: SubmissionSummary[]
  assignments: AssignmentSummary[]
  loading: boolean
  error: string | null
  onBack: () => void
  onOpenSubmission: (submissionId: string) => void
}

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })

export default function StudentView({
  student,
  submissions,
  assignments,
  loading,
  error,
  onBack,
  onOpenSubmission
}: StudentViewProps): React.ReactElement {
  const scored = submissions.filter((submission) => submission.ics !== null)
  const averageIcs =
    scored.length > 0
      ? scored.reduce((total, submission) => total + (submission.ics ?? 0), 0) / scored.length
      : null
  const flagged = submissions.filter((submission) => submission.band === 'flag').length

  const titleFor = (assignmentId: string): string =>
    assignments.find((assignment) => assignment.id === assignmentId)?.title ?? 'Assignment'

  return (
    <div className="student-view">
      <header className="student-view-head">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={14} /> Class overview
        </button>
        <div className="student-view-body">
          <span className="student-view-avatar">{initialsOf(student.name)}</span>
          <div className="student-view-copy">
            <h1>{student.name}</h1>
            <p className="professor-sub">{student.email}</p>
            <p className="professor-sub">Enrolled {formatDate(student.enrolledAt)}</p>
          </div>
          <div className="student-view-stats">
            <span className="class-stat">
              <FileText size={13} /> {submissions.length} submissions
            </span>
            <span className="class-stat">
              <Gauge size={13} />{' '}
              {averageIcs === null ? 'No ICS yet' : `${averageIcs.toFixed(1)} avg ICS`}
            </span>
            <span className={`class-stat ${flagged > 0 ? 'class-stat-flag' : ''}`}>
              <Flag size={13} /> {flagged} flagged
            </span>
          </div>
        </div>
      </header>

      <section className="submissions-section">
        <header className="submissions-head">
          <div>
            <h2>Submissions in this class</h2>
            <p className="professor-sub">
              {submissions.length} submission{submissions.length === 1 ? '' : 's'} across{' '}
              {assignments.length} assignment{assignments.length === 1 ? '' : 's'}
            </p>
          </div>
        </header>

        {loading && <div className="professor-empty">Loading submissions…</div>}
        {error && <div className="professor-error">{error}</div>}
        {!loading && !error && submissions.length === 0 && (
          <div className="professor-empty">No submissions from this student in this class yet.</div>
        )}

        {!loading && !error && submissions.length > 0 && (
          <div className="submission-table-wrap">
            <table className="submission-table">
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Submitted</th>
                  <th>ICS</th>
                  <th>Band</th>
                  <th>Pastes</th>
                  <th>Comments</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className={`submission-row ${
                      submission.band ? `band-row-${submission.band}` : ''
                    }`}
                    tabIndex={0}
                    onClick={() => onOpenSubmission(submission.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onOpenSubmission(submission.id)
                      }
                    }}
                  >
                    <td>
                      <span className="student-name">{titleFor(submission.assignmentId)}</span>
                    </td>
                    <td className="mono-cell">{formatDateTime(submission.submittedAt)}</td>
                    <td>
                      {submission.ics === null ? (
                        <span className="cell-muted">—</span>
                      ) : (
                        <div className="ics-cell">
                          <span className="ics-cell-value">{submission.ics.toFixed(1)}</span>
                          <span className="ics-cell-bar">
                            <i
                              style={{
                                width: `${Math.max(0, Math.min(100, submission.ics))}%`
                              }}
                            />
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <BandBadge band={submission.band} />
                    </td>
                    <td>
                      <span
                        className={`count-chip ${submission.pasteCount > 0 ? 'has-count' : ''}`}
                      >
                        <ClipboardPaste size={11} /> {submission.pasteCount}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`count-chip ${submission.commentCount > 0 ? 'has-count' : ''}`}
                      >
                        <MessageSquare size={11} /> {submission.commentCount}
                      </span>
                    </td>
                    <td className="row-arrow" aria-hidden="true">
                      <ChevronRight size={14} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
