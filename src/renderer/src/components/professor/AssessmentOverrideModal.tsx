import { useState } from 'react'
import { ShieldAlert, X } from 'lucide-react'
import { applyAssessmentOverride } from '../../lib/assessments'
import type { AssessmentSessionSummary } from '../../types/assessment'

interface AssessmentOverrideModalProps {
  session: AssessmentSessionSummary
  onClose: () => void
  onApplied: () => void
}

type OverrideAction = 'extend_time' | 'excuse_interruption' | 'reopen'

export default function AssessmentOverrideModal({
  session,
  onClose,
  onApplied
}: AssessmentOverrideModalProps): React.ReactElement {
  const active = session.status === 'active'
  const [action, setAction] = useState<OverrideAction>(active ? 'extend_time' : 'reopen')
  const [minutes, setMinutes] = useState(active ? '5' : '10')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await applyAssessmentOverride({
        sessionId: session.sessionId,
        action,
        minutes: action === 'excuse_interruption' ? undefined : Number(minutes),
        reason: reason.trim() || undefined
      })
      onApplied()
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Could not apply the override.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-modal glass-panel assessment-override-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="auth-header">
          <span className="auth-title">
            <ShieldAlert size={15} /> Override {session.studentName}
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>
        <p className="auth-sub">
          Every override is written to the audit log with your account, timestamp, and reason.
        </p>

        <div className="auth-form">
          <div className="form-field">
            <label htmlFor="override-action">Action</label>
            <select
              id="override-action"
              value={action}
              onChange={(event) => {
                const next = event.target.value as OverrideAction
                setAction(next)
                setMinutes(next === 'reopen' ? '10' : '5')
              }}
            >
              {active && <option value="extend_time">Extend time</option>}
              {active && <option value="excuse_interruption">Excuse interruptions</option>}
              {!active && <option value="reopen">Reopen attempt</option>}
            </select>
          </div>

          {action !== 'excuse_interruption' && (
            <div className="form-field">
              <label htmlFor="override-minutes">
                {action === 'reopen' ? 'New attempt length (minutes)' : 'Extension (minutes)'}
              </label>
              <input
                id="override-minutes"
                type="number"
                min={1}
                max={240}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="override-reason">Reason</label>
            <textarea
              id="override-reason"
              rows={3}
              value={reason}
              placeholder="e.g. Verified internet outage in the lab."
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => void apply()} disabled={busy}>
              {busy ? 'Applying…' : 'Apply override'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
