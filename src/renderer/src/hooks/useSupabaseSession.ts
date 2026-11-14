import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface SupabaseSessionState {
  session: Session | null
  /** True until the persisted session has been resolved once. */
  loading: boolean
}

/**
 * Tracks the current Supabase auth session. `loading` starts true when
 * Supabase is configured so the app can show a sign-in/loading screen instead
 * of briefly flashing the signed-out editor on startup.
 */
export function useSupabaseSession(): SupabaseSessionState {
  const [state, setState] = useState<SupabaseSessionState>(() => ({
    session: null,
    loading: supabase !== null
  }))

  useEffect(() => {
    if (!supabase) return

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setState({ session: data.session, loading: false })
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setState({ session: nextSession, loading: false })
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}
