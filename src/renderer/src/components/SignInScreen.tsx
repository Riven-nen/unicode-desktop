import { useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import AppearancePanel from './AppearancePanel'
import TitleBarControls from './TitleBarControls'

interface SignInScreenProps {
  /** Shown while the persisted session is being restored. */
  loading?: boolean
  /** Enters local-only mode without an account. */
  onGuest: () => void
}

type AuthMode = 'signin' | 'signup'

export default function SignInScreen({
  loading = false,
  onGuest
}: SignInScreenProps): React.ReactElement {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const switchMode = (nextMode: AuthMode): void => {
    setMode(nextMode)
    setError(null)
    setInfo(null)
  }

  const handleSubmit = async (): Promise<void> => {
    if (!supabase) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (authError) throw authError
        // The session listener in App routes to the editor/dashboard.
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: email.split('@')[0] } }
        })
        if (authError) throw authError
        if (!data.session) {
          setInfo('Account created. Check your email to confirm, then sign in.')
        }
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-container signin-app">
      <nav className="top-nav">
        <div className="nav-logo">
          <div className="logo-icon"></div>
          Unicode Lab
        </div>
        <div className="nav-right">
          <AppearancePanel />
        </div>
        <TitleBarControls />
      </nav>

      <main className="signin-main">
        <div className="signin-glow" aria-hidden="true" />
        <section className="signin-card glass-panel">
          <div className="signin-brand">
            <div className="logo-icon signin-logo" aria-hidden="true"></div>
            <h1>Unicode Lab</h1>
            <p>
              Time-travel diffs, paste tracking, and integrity review for programming coursework.
            </p>
          </div>

          {loading ? (
            <div className="signin-loading" role="status">
              <span className="signin-spinner" aria-hidden="true" />
              Loading your session…
            </div>
          ) : (
            <>
              <div className="signin-mode" role="tablist" aria-label="Authentication mode">
                <button
                  role="tab"
                  aria-selected={mode === 'signin'}
                  className={mode === 'signin' ? 'active' : ''}
                  onClick={() => switchMode('signin')}
                >
                  Sign in
                </button>
                <button
                  role="tab"
                  aria-selected={mode === 'signup'}
                  className={mode === 'signup' ? 'active' : ''}
                  onClick={() => switchMode('signup')}
                >
                  Create account
                </button>
              </div>

              {!isSupabaseConfigured ? (
                <div className="signin-notice">
                  Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and a publishable
                  key to <code>.env</code>, then restart the app.
                </div>
              ) : (
                <form
                  className="auth-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleSubmit()
                  }}
                >
                  <input
                    autoFocus
                    type="email"
                    placeholder="Email"
                    value={email}
                    autoComplete="email"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  {error && <div className="auth-error">{error}</div>}
                  {info && <div className="auth-info">{info}</div>}
                  <button type="submit" className="auth-submit" disabled={busy}>
                    {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                </form>
              )}

              <div className="signin-divider" aria-hidden="true">
                <span>or</span>
              </div>

              <button className="btn-secondary signin-guest" onClick={onGuest}>
                Continue without an account
              </button>
              <p className="signin-note">
                Local mode keeps snapshots on this device. Sign in to sync them with your classes.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
