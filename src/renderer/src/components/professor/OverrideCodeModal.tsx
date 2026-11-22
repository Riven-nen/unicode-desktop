import { useState } from 'react'
import { Clipboard, KeyRound, X } from 'lucide-react'
import { createAssessmentOverrideCode } from '../../lib/assessments'
import { writeClipboardText } from '../../lib/clipboard'
import type { AssessmentSessionSummary } from '../../types/assessment'

interface OverrideCodeModalProps {
  session: AssessmentSessionSummary
  onClose: () => void
}

export default function OverrideCodeModal({
  session,
  onClose
}: OverrideCodeModalProps): React.ReactElement {
  const active = session.status === 'active'
  const [action, setAction] = useState<'extend_time' | 'excuse_interruption' | 'reopen'>(
    active ? 'extend_time' : 'reopen'
  )
  const [minutes, setMinutes] = useState(active ? '5' : '10')
  const [validMinutes, setValidMinutes] = useState('15')
  const [reason, setReason] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const next = await createAssessmentOverrideCode({
        sessionId: session.sessionId,
        action,
        minutes: action === 'excuse_interruption' ? undefined : Number(minutes),
        reason: reason.trim() || undefined,
        validMinutes: Number(validMinutes)
      })
      setCode(next)
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : 'Could not create the code.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal glass-panel" onClick={(event) => event.stopPropagation()}>
        <header className="auth-header">
          <span className="auth-title">
            <KeyRound size={15} /> One-time code · {session.studentName}
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>
        <p className="auth-sub">
          Give this code to the student. It can be redeemed once before it expires.
        </p>

        {code ? (
          <div className="override-code-result">
            <code>{code}</code>
            <button
              className="btn-secondary"
              onClick={() => void writeClipboardText(code)}
              title="Copy code"
            >
              <Clipboard size={13} /> Copy
            </button>
            <p className="ics-note">
              Expires in {validMinutes} minutes. This code is not shown again.
            </p>
          </div>
        ) : (
          <div className="auth-form">
            <div className="form-field">
              <label htmlFor="code-action">Action</label>
              <select
                id="code-action"
                value={action}
                onChange={(event) => {
                  const next = event.target.value as typeof action
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
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="code-minutes">
                    {action === 'reopen' ? 'Attempt length' : 'Extension'}
                  </label>
                  <input
                    id="code-minutes"
                    type="number"
                    min={1}
                    max={240}
                    value={minutes}
                    onChange={(event) => setMinutes(event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="code-valid">Code valid for (minutes)</label>
                  <input
                    id="code-valid"
                    type="number"
                    min={1}
                    max={1440}
                    value={validMinutes}
                    onChange={(event) => setValidMinutes(event.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="form-field">
              <label htmlFor="code-reason">Reason</label>
              <input
                id="code-reason"
                value={reason}
                placeholder="e.g. Verified internet outage"
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => void generate()} disabled={busy}>
                {busy ? 'Generating…' : 'Generate code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
