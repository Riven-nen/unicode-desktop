import { useCallback, useEffect, useRef, useState } from 'react'
import {
  saveAssessmentDraft,
  startAssessmentSession,
  submitAssessmentSession
} from '../lib/assessments'
import { assessmentRemainingMs } from '../lib/assessmentTime'
import type { AssessmentSession, AssessmentSubmissionResult } from '../types/assessment'

export type SubmitReason = 'manual' | 'auto'

interface UseTimedAssessmentOptions {
  /** Reads the live editor content, or the file on disk after a crash. */
  readContent: () => Promise<string | null>
  onSubmitted: (result: AssessmentSubmissionResult, reason: SubmitReason) => void
}

export interface TimedAssessmentApi {
  session: AssessmentSession | null
  remainingMs: number | null
  saving: boolean
  submitting: boolean
  error: string | null
  /** Starts or resumes the session and returns its server-owned deadline. */
  start: (assignmentId: string) => Promise<AssessmentSession>
  submit: (reason?: SubmitReason) => Promise<AssessmentSubmissionResult | null>
  saveNow: () => Promise<void>
  reset: () => void
}

const AUTOSAVE_INTERVAL_MS = 8_000

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'The assessment session could not be saved.'
}

/**
 * Owns the active timed session: server-offset countdown, draft autosave, and
 * deadline auto-submit. The server deadline is authoritative; this hook only
 * decides when to ask the server to finalize.
 */
export function useTimedAssessment({
  readContent,
  onSubmitted
}: UseTimedAssessmentOptions): TimedAssessmentApi {
  const [session, setSession] = useState<AssessmentSession | null>(null)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sessionRef = useRef<AssessmentSession | null>(null)
  const savingRef = useRef(false)
  const finalizingRef = useRef(false)
  const expiredRef = useRef(false)
  const revisionRef = useRef(0)
  const readRef = useRef(readContent)
  const submittedRef = useRef(onSubmitted)

  useEffect(() => {
    readRef.current = readContent
    submittedRef.current = onSubmitted
  })

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const start = useCallback(async (assignmentId: string): Promise<AssessmentSession> => {
    setError(null)
    const next = await startAssessmentSession(assignmentId)
    revisionRef.current = next.draftRevision
    finalizingRef.current = false
    expiredRef.current = false
    sessionRef.current = next
    setSession(next)
    setRemainingMs(assessmentRemainingMs(next))
    return next
  }, [])

  const saveNow = useCallback(async (): Promise<void> => {
    const current = sessionRef.current
    if (!current || current.status !== 'active' || savingRef.current || finalizingRef.current) {
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      const content = await readRef.current()
      if (content === null) return
      const revision = revisionRef.current + 1
      const result = await saveAssessmentDraft({
        sessionId: current.sessionId,
        content,
        revision
      })
      revisionRef.current = Math.max(revision, result.revision)
      setSession((previous) =>
        previous && previous.sessionId === current.sessionId
          ? {
              ...previous,
              expiresAt: result.expiresAt ?? previous.expiresAt,
              serverOffsetMs: result.serverOffsetMs,
              draftRevision: result.revision
            }
          : previous
      )
      setError(null)
    } catch (saveError) {
      setError(messageOf(saveError))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [])

  const submit = useCallback(
    async (reason: SubmitReason = 'manual'): Promise<AssessmentSubmissionResult | null> => {
      const current = sessionRef.current
      if (!current || current.status !== 'active' || finalizingRef.current) return null

      finalizingRef.current = true
      setSubmitting(true)
      try {
        const content = await readRef.current()
        const result = await submitAssessmentSession(current.sessionId, content)
        sessionRef.current = null
        setSession(null)
        setRemainingMs(null)
        setError(null)
        submittedRef.current(result, reason)
        return result
      } catch (submitError) {
        setError(messageOf(submitError))
        finalizingRef.current = false
        throw submitError
      } finally {
        setSubmitting(false)
      }
    },
    []
  )

  const reset = useCallback((): void => {
    sessionRef.current = null
    finalizingRef.current = false
    expiredRef.current = false
    revisionRef.current = 0
    setSession(null)
    setRemainingMs(null)
    setSaving(false)
    setSubmitting(false)
    setError(null)
  }, [])

  // Countdown + deadline finalization. The interval keeps running while the
  // student is in the dashboard so a forgotten timer still auto-submits.
  const activeSessionId = session?.sessionId ?? null
  const expiresAt = session?.expiresAt ?? null
  useEffect(() => {
    if (!activeSessionId || !expiresAt) return
    const tick = (): void => {
      const remaining = assessmentRemainingMs(sessionRef.current)
      setRemainingMs(remaining)
      if (remaining !== null && remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true
        void submit('auto').catch(() => {
          // The error stays visible; the student can submit manually.
        })
      }
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [activeSessionId, expiresAt, submit])

  // Autosave only while the session is active. The document-hidden save covers
  // tab switches and window minimize; the interval covers normal editing.
  const autosaveSessionId = session?.sessionId ?? null
  const autosaveActive = session?.status === 'active'
  useEffect(() => {
    if (!autosaveSessionId || !autosaveActive) return
    const timer = window.setInterval(() => void saveNow(), AUTOSAVE_INTERVAL_MS)
    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') void saveNow()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [autosaveSessionId, autosaveActive, saveNow])

  return {
    session,
    remainingMs,
    saving,
    submitting,
    error,
    start,
    submit,
    saveNow,
    reset
  }
}
