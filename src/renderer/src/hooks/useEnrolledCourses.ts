import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface EnrolledCourse {
  id: string
  /** Short code (e.g. "CS 101"); preferred for the workspace folder name. */
  code: string | null
  title: string
  term: string | null
}

interface EnrollmentRow {
  classes: { id: string; name: string; code: string | null } | null
}

export interface EnrolledCoursesState {
  courses: EnrolledCourse[]
  /** True until the current user's enrollments have been fetched once. */
  loading: boolean
}

// A snapshot belongs to exactly one user, so switching accounts never shows
// the previous student's classes while the new query is in flight.
interface Snapshot {
  userId: string
  courses: EnrolledCourse[]
}

/**
 * The student's enrolled classes. Workspace folders are created from these
 * course codes — students never have to make a course folder by hand.
 */
export function useEnrolledCourses(session: Session | null): EnrolledCoursesState {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!supabase || !userId) return
    const client = supabase
    let cancelled = false

    void client
      .from('enrollments')
      .select('classes ( id, name, code )')
      .eq('student_id', userId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[courses] enrollment load failed:', error)
          setSnapshot({ userId, courses: [] })
          return
        }
        const rows = (data ?? []) as unknown as EnrollmentRow[]
        const courses = rows
          .map((row) => row.classes)
          .filter((course): course is NonNullable<EnrollmentRow['classes']> => course !== null)
          .map((course) => ({
            id: course.id,
            code: course.code,
            title: course.name,
            term: null
          }))
          // Stable order keeps duplicate-name suffixes deterministic.
          .sort((a, b) =>
            (a.code ?? a.title).localeCompare(b.code ?? b.title, undefined, {
              sensitivity: 'base'
            })
          )
        setSnapshot({ userId, courses })
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const matches = userId !== null && snapshot?.userId === userId
  return {
    courses: matches ? snapshot.courses : [],
    loading: userId !== null && !matches
  }
}
