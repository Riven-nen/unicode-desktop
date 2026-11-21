import { AlertTriangle, FileText, Save, Send, Timer } from 'lucide-react'
import { formatCountdown } from '../lib/assessmentTime'
import type { StudentAssignment } from '../types/student'

interface AssessmentBarProps {
  assignment: StudentAssignment
  remainingMs: number | null
  saving: boolean
  submitting: boolean
  error: string | null
  onOpenFile: () => void
  onSubmit: () => void
}

export default function AssessmentBar({
  assignment,
  remainingMs,
  saving,
  submitting,
  error,
  onOpenFile,
  onSubmit
}: AssessmentBarProps): React.ReactElement {
  const expired = remainingMs !== null && remainingMs <= 0
  const urgent = remainingMs !== null && remainingMs > 0 && remainingMs <= 60_000
  const warning = remainingMs !== null && remainingMs > 60_000 && remainingMs <= 5 * 60_000
  const className = [
    'assessment-bar',
    urgent || expired ? 'is-urgent' : warning ? 'is-warning' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} role="status" aria-live="polite">
      <span className="assessment-bar-kind">
        <Timer size={14} />
        {assignment.kind === 'seatwork' ? 'Seatwork' : 'Timed assignment'}
      </span>
      <span className="assessment-bar-title">{assignment.title}</span>
      {assignment.showTimer && remainingMs !== null && (
        <span className="assessment-bar-clock">
          {expired ? 'Time is up — submitting…' : `${formatCountdown(remainingMs)} remaining`}
        </span>
      )}
      {!assignment.showTimer && <span className="assessment-bar-clock">Time limit enforced</span>}
      <span className="assessment-bar-save">
        {saving ? (
          <>
            <Save size={12} /> Saving…
          </>
        ) : error ? (
          <>
            <AlertTriangle size={12} /> Autosave paused
          </>
        ) : (
          'Draft autosaves'
        )}
      </span>
      <div className="assessment-bar-actions">
        <button className="btn-secondary" onClick={onOpenFile} disabled={submitting}>
          <FileText size={12} /> Open file
        </button>
        <button className="btn-primary" onClick={onSubmit} disabled={submitting}>
          <Send size={12} /> {submitting ? 'Submitting…' : 'Submit seatwork'}
        </button>
      </div>
      {error && <span className="assessment-bar-error">{error}</span>}
    </div>
  )
}
