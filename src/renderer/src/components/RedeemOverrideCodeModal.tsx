import { useState } from 'react'
import { KeyRound, X } from 'lucide-react'
import { redeemAssessmentOverrideCode } from '../lib/assessments'

interface RedeemOverrideCodeModalProps {
  sessionId: string
  onClose: () => void
  onRedeemed: (message: string) => void
}

export default function RedeemOverrideCodeModal({
  sessionId,
  onClose,
  onRedeemed
}: RedeemOverrideCodeModalProps): React.ReactElement {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redeem = async (): Promise<void> => {
    if (!code.trim()) {
      setError('Enter the code from your professor.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await redeemAssessmentOverrideCode(sessionId, code.trim())
      onRedeemed(result.overrideNote ?? 'Override code applied.')
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : 'Could not redeem the code.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal glass-panel" onClick={(event) => event.stopPropagation()}>
        <header className="auth-header">
          <span className="auth-title">
            <KeyRound size={15} /> Redeem override code
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>
        <p className="auth-sub">
          Enter the one-time code from your professor. It may extend time, excuse interruptions, or
          reopen a submitted attempt.
        </p>
        <div className="auth-form">
          <input
            autoFocus
            value={code}
            placeholder="8-character code"
            spellCheck={false}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase())
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void redeem()
              if (event.key === 'Escape') onClose()
            }}
          />
          {error && <div className="auth-error">{error}</div>}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => void redeem()} disabled={busy}>
              {busy ? 'Redeeming…' : 'Redeem code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
