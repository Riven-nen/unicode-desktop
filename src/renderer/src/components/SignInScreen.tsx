import { useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import AppearancePanel from './AppearancePanel'
import TitleBarControls from './TitleBarControls'

interface SignInScreenProps {
  /** Shown while the persisted session is being restored. */
  loading?: boolean
}

type AuthMode = 'signin' | 'signup' | 'reset'

interface RecoveryInput {
  accessToken?: string
  refreshToken?: string
  tokenHash?: string
  code?: string
  token?: string
}

/** Accepts a pasted recovery URL, a raw token, or a six-digit code. */
function parseRecoveryInput(raw: string): RecoveryInput {
  const trimmed = raw.trim()
  if (/^\d{6}$/.test(trimmed)) return { token: trimmed }
  try {
    const url = new URL(trimmed)
    const params = url.searchParams
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    return {
      accessToken: hash.get('access_token') ?? params.get('access_token') ?? undefined,
      refreshToken: hash.get('refresh_token') ?? params.get('refresh_token') ?? undefined,
      tokenHash: hash.get('token_hash') ?? params.get('token_hash') ?? undefined,
      code: params.get('code') ?? undefined,
      token: hash.get('token') ?? params.get('token') ?? undefined
    }
  } catch {
    return { token: trimmed }
  }
}

export default function SignInScreen({ loading = false }: SignInScreenProps): React.ReactElement {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const switchMode = (nextMode: AuthMode): void => {
    setMode(nextMode)
    setError(null)
    setInfo(null)
    setResetCode('')
    setNewPassword('')
    setConfirmPassword('')
    if (nextMode !== 'signin') setPassword('')
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

  const sendResetEmail = async (): Promise<void> => {
    if (!supabase) return
    if (!email.trim()) {
      setError('Enter the email address for your account.')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (resetError) throw resetError
      setInfo(
        'If an account exists, a reset email was sent. Paste the link or six-digit code below with a new password.'
      )
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not send the reset email.')
    } finally {
      setBusy(false)
    }
  }

  const completeReset = async (): Promise<void> => {
    if (!supabase) return
    if (newPassword.length < 8) {
      setError('Use at least 8 characters for the new password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    if (!resetCode.trim()) {
      setError('Paste the recovery link or code from the email.')
      return
    }

    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const recovery = parseRecoveryInput(resetCode)
      let verified = false

      if (recovery.accessToken && recovery.refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: recovery.accessToken,
          refresh_token: recovery.refreshToken
        })
        if (sessionError) throw sessionError
        verified = true
      } else if (recovery.tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: recovery.tokenHash,
          type: 'recovery'
        })
        if (verifyError) throw verifyError
        verified = true
      } else if (recovery.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(recovery.code)
        if (exchangeError) throw exchangeError
        verified = true
      } else if (recovery.token) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: recovery.token,
          type: 'recovery'
        })
        if (otpError) {
          // Some templates expose a hashed token rather than a 6-digit code.
          const fallback = await supabase.auth.verifyOtp({
            token_hash: recovery.token,
            type: 'recovery'
          })
          if (fallback.error) throw otpError
        }
        verified = true
      }

      if (!verified) {
        throw new Error('That recovery link or code could not be verified.')
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      // The recovery session is now a normal session; App routes into the app.
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not reset the password.')
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
              {mode === 'reset' ? (
                <div className="signin-reset-head">
                  <button className="back-btn" onClick={() => switchMode('signin')} type="button">
                    Back to sign in
                  </button>
                  <span>Reset password</span>
                </div>
              ) : (
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
              )}

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
                    if (mode === 'reset') {
                      void completeReset()
                      return
                    }
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

                  {mode !== 'reset' && (
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  )}

                  {mode === 'signin' && (
                    <button type="button" className="auth-link" onClick={() => switchMode('reset')}>
                      Forgot password?
                    </button>
                  )}

                  {mode === 'reset' && (
                    <>
                      <button
                        type="button"
                        className="btn-secondary auth-send-reset"
                        onClick={() => void sendResetEmail()}
                        disabled={busy}
                      >
                        Send reset email
                      </button>
                      <input
                        type="text"
                        placeholder="Recovery link or 6-digit code"
                        value={resetCode}
                        autoComplete="one-time-code"
                        onChange={(event) => setResetCode(event.target.value)}
                      />
                      <input
                        type="password"
                        placeholder="New password (8+ characters)"
                        value={newPassword}
                        autoComplete="new-password"
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        autoComplete="new-password"
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                    </>
                  )}

                  {error && <div className="auth-error">{error}</div>}
                  {info && <div className="auth-info">{info}</div>}

                  <button type="submit" className="auth-submit" disabled={busy}>
                    {busy
                      ? 'Working…'
                      : mode === 'reset'
                        ? 'Reset password'
                        : mode === 'signin'
                          ? 'Sign in'
                          : 'Create account'}
                  </button>
                </form>
              )}

              <p className="signin-note">
                Your workspace and class folders appear after you sign in.
              </p>
              <p className="signin-note">
                Have a professor invite? Create or sign in to your account, then redeem the code
                from your dashboard.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
