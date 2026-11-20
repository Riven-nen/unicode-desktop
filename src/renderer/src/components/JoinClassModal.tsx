import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { joinClassByCode } from '../lib/enrollments'

interface JoinClassModalProps {
  onClose: () => void
  onJoined: (classId: string) => void
}

export default function JoinClassModal({
  onClose,
  onJoined
}: JoinClassModalProps): React.ReactElement {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const classId = await joinClassByCode(code)
      onJoined(classId)
      onClose()
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Could not join that class.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-modal glass-panel join-class-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="auth-header">
          <span className="auth-title">
            <UserPlus size={15} /> Join a class
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>

        <p className="auth-sub">
          Enter the join code your professor shares. You will be enrolled immediately.
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
            placeholder="e.g. CS101J4K"
            value={code}
            maxLength={16}
            autoComplete="off"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={busy || code.trim().length < 4}>
            {busy ? 'Joining…' : 'Join class'}
          </button>
        </form>

        <p className="signin-note">
          Codes are not case-sensitive. Ask your professor if your code has expired.
        </p>
      </div>
    </div>
  )
}
