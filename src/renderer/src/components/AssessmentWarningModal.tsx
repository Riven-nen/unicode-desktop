import { AlertTriangle, X } from 'lucide-react'

interface AssessmentWarningModalProps {
  message: string
  onClose: () => void
}

export default function AssessmentWarningModal({
  message,
  onClose
}: AssessmentWarningModalProps): React.ReactElement {
  return (
    <div className="auth-overlay assessment-warning-overlay">
      <div className="auth-modal glass-panel assessment-warning-modal" role="alertdialog">
        <header className="auth-header">
          <span className="auth-title">
            <AlertTriangle size={15} /> Assessment warning
          </span>
          <button className="diff-close" onClick={onClose} title="Dismiss">
            <X size={14} />
          </button>
        </header>
        <p className="auth-sub">{message}</p>
        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>
            Return to assessment
          </button>
        </div>
      </div>
    </div>
  )
}
