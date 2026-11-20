import { useEffect, useState } from 'react'
import ProfessorModal from './ProfessorModal'
import {
  friendlyJudge0Error,
  getJudge0Config,
  saveJudge0Config,
  testJudge0
} from '../../lib/judge0'
import type { Judge0PublicConfig, Judge0Status } from '../../../../shared/judge0'

interface Judge0SettingsModalProps {
  onClose: () => void
  onSaved: (config: Judge0PublicConfig) => void
}

export default function Judge0SettingsModal({
  onClose,
  onSaved
}: Judge0SettingsModalProps): React.ReactElement {
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [clearToken, setClearToken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState<Judge0Status | null>(null)

  useEffect(() => {
    let cancelled = false
    void getJudge0Config()
      .then((config) => {
        if (cancelled) return
        setHasToken(config.hasToken)
      })
      .catch((configError) => {
        if (!cancelled) setError(friendlyJudge0Error(configError))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = async (runTest: boolean): Promise<void> => {
    setBusy(true)
    setError(null)
    setStatus(null)
    setSaved(false)
    try {
      const tokenInput = clearToken ? null : token.trim() ? token.trim() : undefined
      const next = await saveJudge0Config({ token: tokenInput })
      setHasToken(next.hasToken)
      setToken('')
      setClearToken(false)
      setSaved(true)
      onSaved(next)
      if (runTest) {
        setStatus(await testJudge0())
      }
    } catch (saveError) {
      setError(friendlyJudge0Error(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfessorModal title="Judge0 settings" onClose={onClose} wide>
      <p className="auth-sub">
        This build uses a fixed Judge0 endpoint. Add an API token only if that instance requires
        one.
      </p>

      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          void persist(false)
        }}
      >
        <div className="form-field">
          <label htmlFor="judge0-token">Auth token (optional)</label>
          <input
            id="judge0-token"
            autoFocus
            type="password"
            value={token}
            placeholder={hasToken ? 'Saved token — leave blank to keep' : 'Not set'}
            autoComplete="off"
            onChange={(event) => {
              setToken(event.target.value)
              setSaved(false)
            }}
          />
        </div>

        {hasToken && (
          <label className="form-check">
            <input
              type="checkbox"
              checked={clearToken}
              onChange={(event) => setClearToken(event.target.checked)}
            />
            Clear the saved token
          </label>
        )}

        {error && <div className="auth-error">{error}</div>}
        {saved && !error && <div className="auth-info">Settings saved.</div>}
        {status && (
          <div className={status.ok ? 'judge0-status-ok' : 'auth-error'}>
            {status.message}
            {status.version ? ` · Judge0 ${status.version}` : ''}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void persist(false)}
            disabled={busy}
          >
            Save
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void persist(true)}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Save & test'}
          </button>
        </div>
      </form>
    </ProfessorModal>
  )
}
