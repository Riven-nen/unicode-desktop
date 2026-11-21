import { useEffect, useId } from 'react'
import { Info, X } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  busyLabel?: string
  danger?: boolean
  icon?: React.ReactNode
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  busyLabel = 'Working…',
  danger = false,
  icon,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.ReactElement {
  const titleId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel])

  return (
    <div className="auth-overlay" onClick={busy ? undefined : onCancel}>
      <div
        className="auth-modal glass-panel confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="auth-header">
          <span className="auth-title" id={titleId}>
            {title}
          </span>
          <button className="diff-close" onClick={onCancel} disabled={busy} title="Close">
            <X size={14} />
          </button>
        </header>

        <div className="confirm-body">
          <span className={`confirm-icon ${danger ? 'is-danger' : ''}`}>
            {icon ?? <Info size={18} />}
          </span>
          <div className="confirm-copy">
            <h3>{message}</h3>
            {detail && <p>{detail}</p>}
          </div>
        </div>

        <div className="confirm-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`btn-primary ${danger ? 'is-danger' : ''}`}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
