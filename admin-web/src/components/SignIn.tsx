import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export default function SignIn(): React.ReactElement {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const signIn = async (): Promise<void> => {
    if (!supabase) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const sendReset = async (): Promise<void> => {
    if (!supabase) return
    if (!email.trim()) {
      setError('Enter your email first.')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (resetError) throw resetError
      setInfo('Check your email for a password reset link.')
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not send the reset email.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <span className="auth-icon">
          <ShieldCheck size={22} />
        </span>
        <span className="eyebrow">Unicode Lab</span>
        <h1>Admin console</h1>
        <p className="muted">
          Sign in with an administrator account. Student and professor accounts cannot open this
          console.
        </p>

        {!isSupabaseConfigured ? (
          <div className="notice error">
            Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and add
            the project URL and publishable key.
          </div>
        ) : (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault()
              void signIn()
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
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <div className="notice error">{error}</div>}
            {info && <div className="notice ok">{info}</div>}
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" className="link-btn" onClick={() => void sendReset()}>
              Forgot password?
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
