import { useState } from 'react'
import { CheckCircle2, KeyRound, X } from 'lucide-react'
import { redeemProfessorInvite } from '../lib/professorInvites'

interface ProfessorInviteModalProps {
  onClose: () => void
  /** Called after the profile role changes so the app can re-route. */
  onRedeemed: () => void
}

export default function ProfessorInviteModal({
  onClose,
  onRedeemed
}: ProfessorInviteModalProps): React.ReactElement {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await redeemProfessorInvite(code)
      setDone(true)
      onRedeemed()
    } catch (redeemError) {
      setError(
        redeemError instanceof Error
          ? redeemError.message
          : 'Could not redeem that professor invite.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay" onClick={done ? undefined : onClose}>
      <div
        className="auth-modal glass-panel join-class-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="auth-header">
          <span className="auth-title">
            <KeyRound size={15} /> Professor invite
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>

        {done ? (
          <div className="auth-info professor-invite-done">
            <CheckCircle2 size={15} />
            <span>Professor access unlocked. Loading your dashboard…</span>
          </div>
        ) : (
          <>
            <p className="auth-sub">
              Enter the invite code your administrator generated. Your student account will become a
              professor account.
            </p>

            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              <input
                autoFocus
                className="join-code-input"
                placeholder="PROF-XXXX-XXXX"
                value={code}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
              {error && <div className="auth-error">{error}</div>}
              <button
                type="submit"
                className="auth-submit"
                disabled={busy || code.trim().length < 4}
              >
                {busy ? 'Redeeming…' : 'Redeem invite'}
              </button>
            </form>

            <p className="signin-note">
              Codes may expire or have a limited number of uses. Ask your administrator for a new
              code if this one stops working.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
