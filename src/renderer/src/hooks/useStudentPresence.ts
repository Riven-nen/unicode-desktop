import { useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { ProfileRole } from './useProfileRole'

const HEARTBEAT_MS = 30_000
const IDLE_AFTER_MS = 120_000
const FLAG_WINDOW_MS = 15 * 60 * 1000

/**
 * Sends a lightweight presence heartbeat for student accounts. Only the last
 * activity time is kept locally; the server stores the current file, status,
 * and idle duration for the professor's Live Lab.
 */
export function useStudentPresence(
  session: Session | null,
  role: ProfileRole | null,
  activeFile: string | null,
  lastPasteAt: number | null,
  workspaceActive: boolean
): void {
  const userId = session?.user.id ?? null
  const lastActivityRef = useRef(0)
  const enabled = role === 'student' && userId !== null && Boolean(supabase)

  useEffect(() => {
    if (!enabled) return
    lastActivityRef.current = Date.now()
    const markActive = (): void => {
      lastActivityRef.current = Date.now()
    }
    const events = ['keydown', 'mousedown', 'mousemove', 'scroll', 'touchstart'] as const
    for (const event of events) {
      window.addEventListener(event, markActive, { passive: true })
    }
    return () => {
      for (const event of events) {
        window.removeEventListener(event, markActive)
      }
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !supabase) return
    const client = supabase
    let cancelled = false

    const send = async (): Promise<void> => {
      const now = Date.now()
      if (lastActivityRef.current === 0) lastActivityRef.current = now
      const idleSeconds = Math.max(0, Math.floor((now - lastActivityRef.current) / 1000))
      const flagged = lastPasteAt !== null && now - lastPasteAt < FLAG_WINDOW_MS
      const status = flagged
        ? 'flagged'
        : !workspaceActive || idleSeconds * 1000 > IDLE_AFTER_MS
          ? 'idle'
          : 'active'
      const file = activeFile?.split(/[\\/]/).pop() ?? null

      const { error } = await client.rpc('touch_student_presence', {
        current_file: file,
        current_status: status,
        current_idle_seconds: idleSeconds
      })
      if (error && !cancelled) {
        console.warn('[presence] heartbeat failed:', error.message)
      }
    }

    void send()
    const timer = window.setInterval(() => {
      void send()
    }, HEARTBEAT_MS)

    const handleFocus = (): void => {
      lastActivityRef.current = Date.now()
      void send()
    }
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') handleFocus()
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, activeFile, lastPasteAt, workspaceActive])
}
