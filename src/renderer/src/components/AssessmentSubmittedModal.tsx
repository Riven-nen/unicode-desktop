import { CheckCircle2, Timer, X } from 'lucide-react'

interface AssessmentSubmittedModalProps {
  auto: boolean
  onClose: () => void
  onDashboard: () => void
}

export default function AssessmentSubmittedModal({
  auto,
  onClose,
  onDashboard
}: AssessmentSubmittedModalProps): React.ReactElement {
  return (
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-modal glass-panel assessment-result-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="auth-header">
          <span className="auth-title">
            {auto ? <Timer size={15} /> : <CheckCircle2 size={15} />}
            {auto ? 'Time is up' : 'Seatwork submitted'}
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>

        <p className="auth-sub">
          {auto
            ? 'The timer reached zero. The server submitted the latest saved draft, and that submission is now final. Any typing you do in the editor after this point is not part of the submitted work.'
            : 'Your seatwork was submitted successfully. The submission is final.'}
        </p>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            View editor
          </button>
          <button className="btn-primary" onClick={onDashboard}>
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
