import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchStudentAssignments } from '../lib/studentAssignments'
import type { StudentAssignment } from '../types/student'

export interface StudentAssignmentsState {
  assignments: StudentAssignment[]
  loading: boolean
  error: string | null
  reload: () => void
}

interface Snapshot {
  userId: string
  assignments: StudentAssignment[]
}

/**
 * The student's assignment list for every enrolled class. Fetches lazily so
 * the modal does not query until it is opened.
 */
export function useStudentAssignments(
  session: Session | null,
  enabled = true
): StudentAssignmentsState {
  const userId = session?.user.id ?? null
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback((): void => {
    setError(null)
    setVersion((current) => current + 1)
  }, [])

  // Scheduled assignments become visible without a row update, so poll while
  // the app is open. Realtime handles the normal create/update path.
  useEffect(() => {
    if (!enabled || !userId) return
    const refresh = (): void => setVersion((current) => current + 1)
    const timer = window.setInterval(refresh, 60_000)
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, userId])

  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false

    void fetchStudentAssignments(userId)
      .then((assignments) => {
        if (cancelled) return
        setSnapshot({ userId, assignments })
        setError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        // Keep the last good list on screen if a background refresh fails.
        setSnapshot((current) =>
          current && current.userId === userId ? current : { userId, assignments: [] }
        )
        setError(
          loadError instanceof Error ? loadError.message : 'Could not load your assignments.'
        )
      })

    return () => {
      cancelled = true
    }
  }, [enabled, userId, version])

  const matches = userId !== null && snapshot?.userId === userId
  return {
    assignments: matches ? snapshot.assignments : [],
    loading: enabled && userId !== null && !matches && error === null,
    error,
    reload
  }
}
