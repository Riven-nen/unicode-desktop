import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Dashboard from './components/Dashboard'
import SignIn from './components/SignIn'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { AdminProfile, Role } from './lib/adminQueries'

interface ProfileRow {
  id: string
  email: string | null
  display_name: string | null
  role: string
  created_at: string
}

export default function App(): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async (current: Session): Promise<void> => {
    if (!supabase) return
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, created_at')
      .eq('id', current.user.id)
      .maybeSingle()

    if (profileError) {
      setError(profileError.message)
      setProfile(null)
      return
    }
    if (!data) {
      setProfile(null)
      setError('No profile row exists for this account.')
      return
    }
    const row = data as unknown as ProfileRow
    setProfile({
      id: row.id,
      email: row.email,
      displayName: row.display_name?.trim() || row.email?.split('@')[0] || 'Admin',
      role: row.role === 'admin' || row.role === 'professor' ? (row.role as Role) : 'student',
      createdAt: row.created_at
    })
    setError(null)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session)
      if (!cancelled) setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setLoading(false)
        return
      }
      void loadProfile(nextSession).finally(() => setLoading(false))
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = (): void => {
    void supabase?.auth.signOut()
  }

  if (!isSupabaseConfigured) return <SignIn />
  if (loading) {
    return (
      <div className="auth-page">
        <div className="loading-card">
          <span className="spinner" />
          Loading admin console…
        </div>
      </div>
    )
  }
  if (!session) return <SignIn />
  if (error) {
    return (
      <div className="auth-page">
        <section className="auth-card">
          <span className="eyebrow">Admin console</span>
          <h1>Could not load your profile</h1>
          <div className="notice error">{error}</div>
          <button className="btn" onClick={signOut}>
            Sign out
          </button>
        </section>
      </div>
    )
  }
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="auth-page">
        <section className="auth-card">
          <span className="eyebrow">Admin console</span>
          <h1>Not authorized</h1>
          <p className="muted">
            This account is not an administrator. Ask an existing admin to promote it, or sign in
            with an admin account.
          </p>
          <button className="btn" onClick={signOut}>
            Sign out
          </button>
        </section>
      </div>
    )
  }

  return <Dashboard profile={profile} onSignOut={signOut} />
}
