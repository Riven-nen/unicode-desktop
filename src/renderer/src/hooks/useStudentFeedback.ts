import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchStudentFeedback } from '../lib/professorQueries'
import type { StudentFeedbackItem } from '../types/professor'

interface Snapshot {
  userId: string
  items: StudentFeedbackItem[]
}

export interface StudentFeedbackState {
  items: StudentFeedbackItem[]
  loading: boolean
  reload: () => void
}

/**
 * The student's feedback for the dashboard sidebar. The full list still
 * lives in the feedback modal; this only needs the newest few.
 */
export function useStudentFeedback(session: Session | null): StudentFeedbackState {
  const userId = session?.user.id ?? null
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback((): void => setVersion((current) => current + 1), [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    void fetchStudentFeedback(userId)
      .then((items) => {
        if (!cancelled) setSnapshot({ userId, items })
      })
      .catch(() => {
        // The dashboard is still useful without the sidebar preview; keep the
        // previous items when a background refresh fails.
        if (!cancelled) {
          setSnapshot((current) =>
            current && current.userId === userId ? current : { userId, items: [] }
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [userId, version])

  const matches = userId !== null && snapshot?.userId === userId
  return {
    items: matches ? snapshot.items : [],
    loading: userId !== null && !matches,
    reload
  }
}
