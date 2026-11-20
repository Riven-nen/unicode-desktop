import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type ProfileRole = 'student' | 'professor' | 'admin'

interface RoleState {
  userId: string
  role: ProfileRole
  error: string | null
}

export interface ProfileRoleState {
  role: ProfileRole | null
  loading: boolean
  error: string | null
  /** Re-reads the role, e.g. after a professor invite is redeemed. */
  reload: () => void
}

/**
 * Reads the signed-in user's role from `profiles`. RLS allows a user to read
 * their own row. A missing row (or a failed lookup) falls back to `student`
 * so the editor remains the safe default; only an explicit professor row
 * routes to the dashboard.
 */
export function useProfileRole(session: Session | null): ProfileRoleState {
  const [state, setState] = useState<RoleState | null>(null)
  const [version, setVersion] = useState(0)
  const userId = session?.user?.id ?? null
  const reload = useCallback((): void => setVersion((current) => current + 1), [])

  useEffect(() => {
    if (!supabase || !userId) return
    const client = supabase
    let cancelled = false

    void client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[role] profile load failed:', error)
          setState({ userId, role: 'student', error: error.message })
          return
        }
        setState({
          userId,
          role:
            data?.role === 'admin' ? 'admin' : data?.role === 'professor' ? 'professor' : 'student',
          error: null
        })
      })

    return () => {
      cancelled = true
    }
  }, [userId, version])

  const matches = userId !== null && state?.userId === userId
  return {
    role: matches ? state.role : null,
    loading: userId !== null && !matches,
    error: matches ? state.error : null,
    reload
  }
}
