import { useCallback, useEffect, useRef, useState } from 'react'
import {
  recordAssessmentEvent,
  saveAssessmentDraft,
  startAssessmentSession,
  submitAssessmentSession
} from '../lib/assessments'
import { assessmentRemainingMs } from '../lib/assessmentTime'
import type {
  AssessmentEventResult,
  AssessmentEventType,
  AssessmentSession,
  AssessmentSubmissionResult
} from '../types/assessment'

export type SubmitReason = 'manual' | 'auto'

interface UseTimedAssessmentOptions {
  /** Reads the live editor content, or the file on disk after a crash. */
  readContent: () => Promise<string | null>
  onSubmitted: (result: AssessmentSubmissionResult, reason: SubmitReason) => void
  /** Shown when the server records a warning-level exam interruption. */
  onWarning?: (message: string) => void
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
  recordEvent: (
    eventType: AssessmentEventType,
    metadata?: Record<string, unknown>
  ) => Promise<AssessmentEventResult | null>
  enterFullscreen: () => Promise<boolean>
  /** Stop counting window blur while the interruption key modal is open. */
  pauseGuard: () => void
  resumeGuard: () => void
  reset: () => void
}

// Drafts are one row per session updated in place, so this is write churn, not
// row growth. Ten seconds keeps the draft useful without saving on every key.
const AUTOSAVE_INTERVAL_MS = 10_000
// Save once more near the deadline so a server-side finalize cannot miss the
// student's last stretch of typing.
const FINAL_SAVE_WINDOW_MS = 5_000

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
  onSubmitted,
  onWarning
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
  const finalSaveRef = useRef(false)
  const guardPausedRef = useRef(false)
  const revisionRef = useRef(0)
  const readRef = useRef(readContent)
  const submittedRef = useRef(onSubmitted)
  const warningRef = useRef(onWarning)

  useEffect(() => {
    readRef.current = readContent
    submittedRef.current = onSubmitted
    warningRef.current = onWarning
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
    finalSaveRef.current = false
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

  const exitFullscreen = useCallback((): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
      return true
    } catch {
      return false
    }
  }, [])

  const pauseGuard = useCallback((): void => {
    guardPausedRef.current = true
  }, [])

  const resumeGuard = useCallback((): void => {
    guardPausedRef.current = false
  }, [])

  const recordEvent = useCallback(
    async (
      eventType: AssessmentEventType,
      metadata: Record<string, unknown> = {}
    ): Promise<AssessmentEventResult | null> => {
      const current = sessionRef.current
      if (!current || current.status !== 'active' || finalizingRef.current) return null

      try {
        const result = await recordAssessmentEvent({
          sessionId: current.sessionId,
          eventType,
          metadata
        })
        if (result.status !== 'active') {
          sessionRef.current = null
          setSession(null)
          setRemainingMs(null)
          exitFullscreen()
          submittedRef.current(
            {
              submissionId: result.submissionId ?? current.sessionId,
              status: result.status,
              submittedAt: result.serverNow
            },
            'auto'
          )
          return result
        }

        setSession((previous) =>
          previous && previous.sessionId === current.sessionId
            ? {
                ...previous,
                tabOutCount: result.tabOutCount,
                fullscreenExitCount: result.fullscreenExitCount,
                blockedPasteCount: result.blockedPasteCount,
                interruptionCount: result.interruptionCount,
                allowedTabOuts: result.allowedTabOuts,
                serverOffsetMs: result.serverOffsetMs
              }
            : previous
        )

        if (result.action === 'warning') {
          const label =
            eventType === 'fullscreen_exit'
              ? 'Fullscreen was exited'
              : 'You left the assessment window'
          warningRef.current?.(
            `${label}. This is interruption ${result.interruptionCount} of ${result.allowedTabOuts} allowed. The next interruption will submit automatically.`
          )
        }
        return result
      } catch (eventError) {
        setError(messageOf(eventError))
        return null
      }
    },
    [exitFullscreen]
  )

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
        exitFullscreen()
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
    [exitFullscreen]
  )

  const reset = useCallback((): void => {
    sessionRef.current = null
    finalizingRef.current = false
    expiredRef.current = false
    finalSaveRef.current = false
    revisionRef.current = 0
    exitFullscreen()
    setSession(null)
    setRemainingMs(null)
    setSaving(false)
    setSubmitting(false)
    setError(null)
  }, [exitFullscreen])

  // Countdown + deadline finalization. The interval keeps running while the
  // student is in the dashboard so a forgotten timer still auto-submits.
  const activeSessionId = session?.sessionId ?? null
  const expiresAt = session?.expiresAt ?? null
  useEffect(() => {
    if (!activeSessionId || !expiresAt) return
    const tick = (): void => {
      const remaining = assessmentRemainingMs(sessionRef.current)
      setRemainingMs(remaining)
      if (
        remaining !== null &&
        remaining > 0 &&
        remaining <= FINAL_SAVE_WINDOW_MS &&
        !finalSaveRef.current
      ) {
        finalSaveRef.current = true
        void saveNow()
      }
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
  }, [activeSessionId, expiresAt, saveNow, submit])

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

  // Exam guard: tab-out/window blur after a short grace. Duplicate blur +
  // visibility events are coalesced into one server event.
  const examMode = session?.examMode ?? false
  const examActive = session?.status === 'active'
  const examSessionId = session?.sessionId ?? null
  const fullscreenRequired = session?.fullscreenRequired ?? false

  useEffect(() => {
    if (!examActive || !examMode || !examSessionId) return
    let timer: number | null = null
    const clearTimer = (): void => {
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
    }
    const schedule = (): void => {
      if (guardPausedRef.current) return
      clearTimer()
      timer = window.setTimeout(() => {
        timer = null
        if (guardPausedRef.current) return
        // A fullscreen exam is still the assessment surface even if the window
        // reports a transient blur while entering/leaving fullscreen.
        if (
          !document.fullscreenElement &&
          (document.visibilityState === 'hidden' || !document.hasFocus())
        ) {
          void recordEvent('tab_out', { source: 'window' })
        }
      }, 2500)
    }
    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') schedule()
      else clearTimer()
    }
    const handleBlur = (): void => schedule()
    const handleFocus = (): void => clearTimer()

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    return () => {
      clearTimer()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [examActive, examMode, examSessionId, recordEvent])

  // The first real exit from fullscreen counts as an interruption. Initial
  // state is captured so entering fullscreen does not fire an event.
  useEffect(() => {
    if (!examActive || !examMode || !fullscreenRequired || !examSessionId) return
    let wasFullscreen = document.fullscreenElement !== null
    const handleFullscreenChange = (): void => {
      const isFullscreen = document.fullscreenElement !== null
      if (wasFullscreen && !isFullscreen) {
        void recordEvent('fullscreen_exit')
      }
      wasFullscreen = isFullscreen
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [examActive, examMode, fullscreenRequired, examSessionId, recordEvent])

  return {
    session,
    remainingMs,
    saving,
    submitting,
    error,
    start,
    submit,
    saveNow,
    recordEvent,
    enterFullscreen,
    pauseGuard,
    resumeGuard,
    reset
  }
}
