import { useState } from 'react'
import { X } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

interface AuthPanelProps {
  open: boolean
  onClose: () => void
}

type AuthMode = 'signin' | 'signup'

export default function AuthPanel({ open, onClose }: AuthPanelProps): React.ReactElement | null {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (!open) return null

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
        onClose()
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: email.split('@')[0] } }
        })
        if (authError) throw authError
        if (!data.session) {
          setInfo('Account created. Check your email to confirm, then sign in.')
        } else {
          onClose()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-modal glass-panel">
        <header className="auth-header">
          <span className="auth-title">{mode === 'signin' ? 'Sign in' : 'Create account'}</span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>
        <p className="auth-sub">
          {isSupabaseConfigured
            ? 'Sign in to sync your snapshot history and paste activity to the lab dashboard.'
            : 'Supabase is not configured yet — see .env.example. Your history stays on this device.'}
        </p>
        <div className="auth-form">
          <input
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
          <button
            className="auth-submit"
            disabled={busy || !isSupabaseConfigured}
            onClick={() => void handleSubmit()}
          >
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </div>
        <div className="auth-toggle">
          {mode === 'signin' ? (
            <span>
              No account?{' '}
              <button
                className="link-like"
                onClick={() => {
                  setMode('signup')
                  setError(null)
                }}
              >
                Create one
              </button>
            </span>
          ) : (
            <span>
              Already registered?{' '}
              <button
                className="link-like"
                onClick={() => {
                  setMode('signin')
                  setError(null)
                }}
              >
                Sign in
              </button>
            </span>
          )}
        </div>
        <div className="auth-guest" onClick={onClose}>
          Continue without an account — history stays local
        </div>
      </div>
    </div>
  )
}
