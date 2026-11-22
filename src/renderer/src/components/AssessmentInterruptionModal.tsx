import { useState } from 'react'
import { KeyRound, ShieldAlert, Timer } from 'lucide-react'
import { redeemInterruptionKey } from '../lib/assessments'
import { formatCountdown } from '../lib/assessmentTime'

interface AssessmentInterruptionModalProps {
  sessionId: string
  message: string
  remainingMs: number | null
  interruptionCount: number
  allowedTabOuts: number
  submitting: boolean
  onUnlocked: () => void
  onSubmit: () => void
}

export default function AssessmentInterruptionModal({
  sessionId,
  message,
  remainingMs,
  interruptionCount,
  allowedTabOuts,
  submitting,
  onUnlocked,
  onSubmit
}: AssessmentInterruptionModalProps): React.ReactElement {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unlock = async (): Promise<void> => {
    if (!key.trim()) {
      setError('Enter the key from your professor.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await redeemInterruptionKey(sessionId, key.trim())
      onUnlocked()
    } catch (unlockError) {
      setError(
        unlockError instanceof Error ? unlockError.message : 'Could not unlock the assessment.'
      )
    } finally {
      setBusy(false)
    }
  }

  const remainingLabel =
    remainingMs === null ? '—' : remainingMs <= 0 ? 'Time is up' : formatCountdown(remainingMs)
  const nextAutoSubmits = interruptionCount >= allowedTabOuts

  return (
    <div className="auth-overlay assessment-interruption-overlay">
      <div
        className="auth-modal glass-panel assessment-interruption-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="assessment-interruption-title"
      >
        <header className="auth-header">
          <span className="auth-title" id="assessment-interruption-title">
            <ShieldAlert size={15} /> Assessment paused
          </span>
        </header>

        <p className="auth-sub">{message}</p>

        <div className="assessment-interruption-meta">
          <span>
            <Timer size={12} /> Time remaining <strong>{remainingLabel}</strong>
          </span>
          <span>
            Interruption <strong>{interruptionCount}</strong> of <strong>{allowedTabOuts}</strong>{' '}
            allowed
          </span>
        </div>

        <p className="assessment-interruption-warning">
          {nextAutoSubmits
            ? 'The next interruption will submit your attempt automatically.'
            : `${allowedTabOuts - interruptionCount} allowed interruption${
                allowedTabOuts - interruptionCount === 1 ? '' : 's'
              } remaining.`}
        </p>

        <div className="auth-form assessment-interruption-form">
          <p className="assessment-interruption-physical">
            This is a physical intervention. Ask your professor to come to your station and issue a
            resume key. The timer keeps running while this is open.
          </p>

          <div className="form-field">
            <label htmlFor="interruption-key">
              <KeyRound size={12} /> Professor key
            </label>
            <input
              id="interruption-key"
              value={key}
              autoComplete="off"
              spellCheck={false}
              placeholder="8-character key"
              onChange={(event) => {
                setKey(event.target.value.toUpperCase())
                setError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void unlock()
              }}
              disabled={busy}
            />
            <span className="form-hint">
              The key is one-time, expiring, and tied to this attempt.
            </span>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="modal-actions">
            <button
              className="btn-secondary"
              onClick={onSubmit}
              disabled={busy || submitting}
              title="Submit the current draft and end the attempt"
            >
              {submitting ? 'Submitting…' : 'Submit work instead'}
            </button>
            <button
              className="btn-primary"
              onClick={() => void unlock()}
              disabled={busy || submitting}
            >
              {busy ? 'Unlocking…' : 'Unlock and continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
