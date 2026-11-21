import { useCallback, useEffect, useRef, useState } from 'react'
import type * as monaco from 'monaco-editor'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { snapshotQueue } from '../lib/snapshotQueue'
import type {
  CodeSnapshot,
  DetectionSource,
  PasteEventRecord,
  SnapshotType,
  SyncStatus
} from '../types/tracker'

// Idle window after the last keystroke before an auto snapshot is captured.
const DEBOUNCE_MS = 1500
// Minimum spacing between consecutive auto snapshots.
const MIN_AUTO_INTERVAL_MS = 10_000
// A burst of inserted text at least this large, with no matching onDidPaste
// event, is treated as a suspected paste (drag-drop, middle-click, ...).
const VELOCITY_PASTE_THRESHOLD = 120
// Rows fetched per table when hydrating history after sign-in.
const HISTORY_ROW_LIMIT = 200
// Rows sent per Supabase insert batch.
const SYNC_BATCH_SIZE = 25
// Delay before retrying a failed sync.
const SYNC_RETRY_MS = 30_000
// Delay between a capture and the first flush attempt.
const FLUSH_DELAY_MS = 1000

// Marks captures recorded before the student signed in.
const LOCAL_USER = 'local'

interface ChangeWindow {
  chars: number
  texts: string[]
  history: boolean
}

interface UseCodeTrackerOptions {
  session: Session | null
  labId?: string | null
  fileNames: string[]
  /**
   * Called whenever a tracked model's content changes (real edits, not
   * programmatic flushes). App uses this to flag tabs dirty against disk.
   */
  onModelChange?: (fileName: string, content: string) => void
}

export interface CodeTrackerApi {
  snapshotsByFile: Record<string, CodeSnapshot[]>
  pastesByFile: Record<string, PasteEventRecord[]>
  syncStatus: SyncStatus
  queuedCount: number
  attachModel(fileName: string, model: monaco.editor.ITextModel): () => void
  handlePaste(fileName: string, event: monaco.editor.IPasteEvent): void
  captureManualSnapshot(fileName: string): void
  restoreSnapshot(fileName: string, snapshot: CodeSnapshot): void
  getModelValue(fileName: string): string | null
  /** Replaces a model's content without recording a user edit. */
  setModelValue(fileName: string, content: string): boolean
  /** Captures the live content immediately (used when submitting). */
  captureCurrent(fileName: string): void
  /** Flushes pending edits and resolves once queued captures are synced. */
  flush(fileName?: string): Promise<void>
  flushNow(): void
}

interface TimedRow {
  id: string
  file_name: string
  created_at: string
}

function mergeRows<T extends TimedRow>(
  existing: Record<string, T[]>,
  incoming: T[]
): Record<string, T[]> {
  const byId = new Map<string, T>()
  for (const list of Object.values(existing)) {
    for (const row of list) byId.set(row.id, row)
  }
  for (const row of incoming) byId.set(row.id, row)

  const merged: Record<string, T[]> = {}
  for (const row of byId.values()) {
    const list = merged[row.file_name]
    if (list) list.push(row)
    else merged[row.file_name] = [row]
  }
  for (const key of Object.keys(merged)) {
    merged[key].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  return merged
}

/**
 * The onDidPaste event fires after the paste has landed in the model, so the
 * event range spans exactly the pasted text (verified against monaco's
 * codeEditorWidget._paste). The clipboard payload is preferred; the range is
 * the fallback for embedders that revoke clipboardData early.
 */
function resolvePastedText(
  event: monaco.editor.IPasteEvent,
  model: monaco.editor.ITextModel
): string {
  try {
    const fromClipboard = event.clipboardEvent?.clipboardData?.getData('text/plain')
    if (fromClipboard) return fromClipboard
  } catch {
    // Clipboard data already consumed — fall through to the range.
  }
  try {
    return model.getValueInRange(event.range)
  } catch {
    return ''
  }
}

export function useCodeTracker({
  session,
  labId = null,
  fileNames,
  onModelChange
}: UseCodeTrackerOptions): CodeTrackerApi {
  const userId = session?.user?.id ?? null

  const [snapshotsByFile, setSnapshotsByFile] = useState<Record<string, CodeSnapshot[]>>({})
  const [pastesByFile, setPastesByFile] = useState<Record<string, PasteEventRecord[]>>({})
  const [queueState, setQueueState] = useState(() => ({
    status: snapshotQueue.getStatus(),
    size: snapshotQueue.size()
  }))

  // Mutable bookkeeping (refs keep the capture path allocation-free and
  // immune to stale closures inside monaco event handlers).
  const modelsRef = useRef(new Map<string, monaco.editor.ITextModel>())
  const listenersRef = useRef(new Map<monaco.editor.ITextModel, monaco.IDisposable>())
  const lastSnapshotRef = useRef(new Map<string, CodeSnapshot>())
  const snapshotsStateRef = useRef<Record<string, CodeSnapshot[]>>({})
  const windowsRef = useRef(new Map<string, ChangeWindow>())
  // Gaps between edit bursts, attached to the next snapshot for the heatmap.
  const typingIntervalsRef = useRef(new Map<string, number[]>())
  const lastChangeRef = useRef(new Map<string, number>())
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const restoringRef = useRef<string | null>(null)
  // Serializes sync batches: concurrent callers wait their turn instead of
  // being dropped while another flush is in flight.
  const flushChainRef = useRef<Promise<void>>(Promise.resolve())
  const userIdRef = useRef(userId)
  const labIdRef = useRef(labId)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushRef = useRef<() => Promise<void>>(async () => {})
  const finalizeWindowRef = useRef<(fileName: string) => void>(() => {})
  const onModelChangeRef = useRef(onModelChange)

  useEffect(() => {
    onModelChangeRef.current = onModelChange
  })

  useEffect(() => {
    userIdRef.current = userId
    labIdRef.current = labId
  }, [userId, labId])

  // Mirror snapshot state in a ref so merge operations stay pure.
  const applySnapshotState = useCallback((next: Record<string, CodeSnapshot[]>): void => {
    snapshotsStateRef.current = next
    setSnapshotsByFile(next)
    // Keep the newest snapshot per file so capture dedupe stays correct.
    for (const list of Object.values(next)) {
      if (list.length > 0) lastSnapshotRef.current.set(list[0].file_name, list[0])
    }
  }, [])

  // --- Sync plumbing ---------------------------------------------------------

  const scheduleRetry = useCallback((): void => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null
      void flushRef.current()
    }, SYNC_RETRY_MS)
  }, [])

  const runFlush = useCallback(async (): Promise<void> => {
    const currentUserId = userIdRef.current
    if (!supabase || !currentUserId) return

    const items = snapshotQueue.itemsForUser(currentUserId)
    if (items.length === 0) {
      snapshotQueue.setStatus(navigator.onLine ? 'synced' : 'offline')
      return
    }

    snapshotQueue.setStatus('syncing')
    try {
      for (let start = 0; start < items.length; start += SYNC_BATCH_SIZE) {
        const batch = items.slice(start, start + SYNC_BATCH_SIZE)
        const snapshotRows = batch
          .filter((item) => item.kind === 'snapshot')
          .map((item) => ({ ...(item.payload as CodeSnapshot), user_id: currentUserId }))
        const pasteRows = batch
          .filter((item) => item.kind === 'paste')
          .map((item) => ({ ...(item.payload as PasteEventRecord), user_id: currentUserId }))

        // Snapshots go first so referenced snapshot_ids exist for paste rows.
        if (snapshotRows.length > 0) {
          const { error } = await supabase.from('code_snapshots').insert(snapshotRows)
          if (error) throw error
        }
        if (pasteRows.length > 0) {
          const { error } = await supabase.from('paste_events').insert(pasteRows)
          if (error) throw error
        }
        snapshotQueue.remove(new Set(batch.map((item) => item.id)))
      }
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      snapshotQueue.setStatus('synced')
    } catch (error) {
      console.warn('[tracker] sync failed — will retry:', error)
      snapshotQueue.bumpAttempts(new Set(items.map((item) => item.id)))
      snapshotQueue.setStatus(navigator.onLine ? 'error' : 'offline')
      scheduleRetry()
    }
  }, [scheduleRetry])

  const flushQueue = useCallback((): Promise<void> => {
    const next = flushChainRef.current.then(runFlush)
    flushChainRef.current = next.catch(() => undefined)
    return next
  }, [runFlush])

  // Late-bound function references, kept current outside of render so the
  // timers and effects below always call the latest implementation.
  useEffect(() => {
    flushRef.current = flushQueue
  }, [flushQueue])

  const scheduleFlush = useCallback((): void => {
    if (flushTimerRef.current) return
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null
      void flushRef.current()
    }, FLUSH_DELAY_MS)
  }, [])

  // --- Capture logic ---------------------------------------------------------

  const recordPaste = useCallback(
    (
      fileName: string,
      snapshot: CodeSnapshot | null,
      pastedText: string,
      detectedVia: DetectionSource
    ): void => {
      if (!pastedText) return
      const record: PasteEventRecord = {
        id: crypto.randomUUID(),
        snapshot_id: snapshot?.id ?? null,
        user_id: userIdRef.current ?? LOCAL_USER,
        lab_id: labIdRef.current ?? null,
        file_name: fileName,
        pasted_text: pastedText,
        pasted_chars: pastedText.length,
        paste_mode: pastedText.includes('\n') ? 'multi-line' : 'single-line',
        detected_via: detectedVia,
        created_at: new Date().toISOString()
      }
      setPastesByFile((prev) => ({
        ...prev,
        [fileName]: [record, ...(prev[fileName] ?? [])]
      }))
      snapshotQueue.enqueue('paste', record)
      scheduleFlush()
    },
    [scheduleFlush]
  )

  const captureSnapshot = useCallback(
    (fileName: string, type: SnapshotType, force = false): CodeSnapshot | null => {
      const model = modelsRef.current.get(fileName)
      if (!model) return null

      const content = model.getValue()
      const last = lastSnapshotRef.current.get(fileName)
      if (!force && last && last.content === content) return null

      const intervals = typingIntervalsRef.current.get(fileName) ?? []
      const snapshot: CodeSnapshot = {
        id: crypto.randomUUID(),
        user_id: userIdRef.current ?? LOCAL_USER,
        lab_id: labIdRef.current ?? null,
        file_name: fileName,
        content,
        snapshot_type: type,
        version: model.getVersionId(),
        char_count: content.length,
        line_count: model.getLineCount(),
        language: model.getLanguageId() || null,
        created_at: new Date().toISOString(),
        typing_intervals: intervals.length > 0 ? intervals : null
      }
      typingIntervalsRef.current.delete(fileName)
      lastChangeRef.current.delete(fileName)

      applySnapshotState({
        ...snapshotsStateRef.current,
        [fileName]: [snapshot, ...(snapshotsStateRef.current[fileName] ?? [])]
      })
      snapshotQueue.enqueue('snapshot', snapshot)
      scheduleFlush()
      return snapshot
    },
    [applySnapshotState, scheduleFlush]
  )

  const finalizeWindow = useCallback(
    (fileName: string): void => {
      timersRef.current.delete(fileName)
      const changeWindow = windowsRef.current.get(fileName)
      if (!changeWindow) return

      // Suspected paste: a large burst of inserted text without a matching
      // onDidPaste event (drag-drop, middle-click paste, IME insertions).
      // Undo/redo bursts are excluded so they never raise false positives.
      if (changeWindow.chars >= VELOCITY_PASTE_THRESHOLD && !changeWindow.history) {
        windowsRef.current.delete(fileName)
        // A bulk insert is not typing rhythm.
        typingIntervalsRef.current.delete(fileName)
        lastChangeRef.current.delete(fileName)
        const snapshot = captureSnapshot(fileName, 'paste', true)
        recordPaste(fileName, snapshot, changeWindow.texts.join(''), 'velocity')
        return
      }

      const last = lastSnapshotRef.current.get(fileName)
      const elapsed = last ? Date.now() - Date.parse(last.created_at) : Infinity
      if (elapsed < MIN_AUTO_INTERVAL_MS) {
        // Too soon for another auto snapshot — re-arm after the cooldown so
        // the latest change is never silently dropped. The ref indirection
        // avoids a self-referential callback dependency.
        timersRef.current.set(
          fileName,
          setTimeout(
            () => finalizeWindowRef.current(fileName),
            MIN_AUTO_INTERVAL_MS - elapsed + DEBOUNCE_MS
          )
        )
        return
      }

      windowsRef.current.delete(fileName)
      captureSnapshot(fileName, 'auto')
    },
    [captureSnapshot, recordPaste]
  )

  useEffect(() => {
    finalizeWindowRef.current = finalizeWindow
  }, [finalizeWindow])

  const handleContentChange = useCallback(
    (fileName: string, event: monaco.editor.IModelContentChangedEvent): void => {
      // A restore lands as a normal edit — capture it immediately and flag
      // it as 'restore' so the timeline shows the rollback.
      if (restoringRef.current === fileName) {
        restoringRef.current = null
        captureSnapshot(fileName, 'restore')
        return
      }

      // Bulk programmatic replaces (setValue) are not user edits.
      if (event.isFlush) return

      // Edit cadence: one sample per content change, ignoring undo/redo and
      // implausibly long pauses. These become the typing heatmap points.
      if (!event.isUndoing && !event.isRedoing) {
        const inserted = event.changes.reduce((total, change) => total + change.text.length, 0)
        if (inserted > 0) {
          const now = Date.now()
          const previous = lastChangeRef.current.get(fileName)
          if (previous !== undefined) {
            const interval = now - previous
            if (interval >= 20 && interval <= 10_000) {
              const samples = typingIntervalsRef.current.get(fileName) ?? []
              if (samples.length < 800) samples.push(Math.round(interval))
              typingIntervalsRef.current.set(fileName, samples)
            }
          }
          lastChangeRef.current.set(fileName, now)
        }
      }

      const existing = windowsRef.current.get(fileName)
      const changeWindow: ChangeWindow = existing ?? { chars: 0, texts: [], history: false }
      if (event.isUndoing || event.isRedoing) changeWindow.history = true
      for (const change of event.changes) {
        if (change.text.length > 0) {
          changeWindow.chars += change.text.length
          changeWindow.texts.push(change.text)
        }
      }
      windowsRef.current.set(fileName, changeWindow)

      const timer = timersRef.current.get(fileName)
      if (timer) clearTimeout(timer)
      timersRef.current.set(
        fileName,
        setTimeout(() => finalizeWindow(fileName), DEBOUNCE_MS)
      )
    },
    [captureSnapshot, finalizeWindow]
  )

  const handlePaste = useCallback(
    (fileName: string, event: monaco.editor.IPasteEvent): void => {
      const model = modelsRef.current.get(fileName)
      if (!model) return

      // Pastes capture immediately — no debounce.
      const timer = timersRef.current.get(fileName)
      if (timer) {
        clearTimeout(timer)
        timersRef.current.delete(fileName)
      }
      // Reset the window so the velocity heuristic doesn't double-count
      // this paste (onDidChangeModelContent fires before onDidPaste).
      windowsRef.current.delete(fileName)
      // A paste is not typing rhythm.
      typingIntervalsRef.current.delete(fileName)
      lastChangeRef.current.delete(fileName)

      const pastedText = resolvePastedText(event, model)
      if (!pastedText) return
      const snapshot = captureSnapshot(fileName, 'paste', true)
      recordPaste(fileName, snapshot, pastedText, 'onDidPaste')
    },
    [captureSnapshot, recordPaste]
  )

  const attachModel = useCallback(
    (fileName: string, model: monaco.editor.ITextModel): (() => void) => {
      modelsRef.current.set(fileName, model)

      // Guard against double-attach (React StrictMode remounts the editor).
      const existing = listenersRef.current.get(model)
      if (existing) return () => undefined

      const listener = model.onDidChangeContent((event) => {
        // Flush events come from programmatic setValue calls, not edits;
        // they shouldn't mark a tab dirty.
        if (!event.isFlush) onModelChangeRef.current?.(fileName, model.getValue())
        handleContentChange(fileName, event)
      })
      listenersRef.current.set(model, listener)

      return () => {
        listener.dispose()
        listenersRef.current.delete(model)
        if (modelsRef.current.get(fileName) === model) modelsRef.current.delete(fileName)
      }
    },
    [handleContentChange]
  )

  const restoreSnapshot = useCallback((fileName: string, snapshot: CodeSnapshot): void => {
    const model = modelsRef.current.get(fileName)
    if (!model) return
    restoringRef.current = fileName
    try {
      // pushEditOperations records this on the undo stack, so Ctrl+Z can
      // undo a restore. The content-change listener fires synchronously
      // during this call and captures the 'restore' snapshot.
      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: snapshot.content }],
        () => null
      )
    } finally {
      // If the content was already identical, no change event fired — make
      // sure the flag never leaks into the next real edit.
      if (restoringRef.current === fileName) restoringRef.current = null
    }
  }, [])

  const captureManualSnapshot = useCallback(
    (fileName: string): void => {
      captureSnapshot(fileName, 'manual', true)
    },
    [captureSnapshot]
  )

  const getModelValue = useCallback(
    (fileName: string): string | null => modelsRef.current.get(fileName)?.getValue() ?? null,
    []
  )

  const setModelValue = useCallback((fileName: string, content: string): boolean => {
    const model = modelsRef.current.get(fileName)
    if (!model) return false
    if (model.getValue() !== content) model.setValue(content)
    return true
  }, [])

  const captureCurrent = useCallback(
    (fileName: string): void => {
      // Forced capture: submission must not depend on the idle debounce or
      // the minimum auto-snapshot interval.
      captureSnapshot(fileName, 'auto', true)
    },
    [captureSnapshot]
  )

  const flush = useCallback(async (fileName?: string): Promise<void> => {
    // Finalize any debounced edit window so the submitted content is in the
    // snapshot set, then wait for the queue to finish syncing.
    const targets = fileName ? [fileName] : Array.from(windowsRef.current.keys())
    for (const name of targets) {
      const timer = timersRef.current.get(name)
      if (timer) {
        clearTimeout(timer)
        timersRef.current.delete(name)
      }
      finalizeWindowRef.current(name)
    }
    await flushRef.current()
  }, [])

  const flushNow = useCallback((): void => {
    void flushRef.current()
  }, [])

  // --- Effects -----------------------------------------------------------------

  // Queue state subscription (status + size). The initial value comes from
  // the useState initializer; updates only arrive via queue events.
  useEffect(() => {
    const unsubscribe = snapshotQueue.subscribe(() => {
      setQueueState({ status: snapshotQueue.getStatus(), size: snapshotQueue.size() })
    })
    return unsubscribe
  }, [])

  // Hydrate remote history and flush queued captures whenever the signed-in
  // user changes. Depends on the user id (not the session object) so token
  // refreshes don't re-trigger loads.
  useEffect(() => {
    if (!supabase || !userId) return
    const client = supabase

    const loadRemoteHistory = async (): Promise<void> => {
      try {
        const [snapshotsRes, pastesRes] = await Promise.all([
          client
            .from('code_snapshots')
            .select('*')
            .eq('user_id', userId)
            .in('file_name', fileNames)
            .order('created_at', { ascending: false })
            .limit(HISTORY_ROW_LIMIT),
          client
            .from('paste_events')
            .select('*')
            .eq('user_id', userId)
            .in('file_name', fileNames)
            .order('created_at', { ascending: false })
            .limit(HISTORY_ROW_LIMIT)
        ])
        if (snapshotsRes.error || pastesRes.error) {
          console.warn('[tracker] history load failed:', snapshotsRes.error ?? pastesRes.error)
          return
        }
        const snapshots = (snapshotsRes.data ?? []) as CodeSnapshot[]
        const pastes = (pastesRes.data ?? []) as PasteEventRecord[]
        applySnapshotState(mergeRows(snapshotsStateRef.current, snapshots))
        setPastesByFile((prev) => mergeRows(prev, pastes))
      } catch (error) {
        console.warn('[tracker] history load failed:', error)
      }
    }

    void (async () => {
      await loadRemoteHistory()
      await flushRef.current()
    })()
  }, [userId, fileNames, applySnapshotState])

  // Flush when the network comes back; mark offline when it drops.
  useEffect(() => {
    const handleOnline = (): void => {
      if (userIdRef.current) void flushRef.current()
    }
    const handleOffline = (): void => {
      if (isSupabaseConfigured && userIdRef.current) snapshotQueue.setStatus('offline')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Dispose timers and model listeners on unmount.
  useEffect(() => {
    const timers = timersRef.current
    const listeners = listenersRef.current
    const windows = windowsRef.current
    const typingIntervals = typingIntervalsRef.current
    const lastChanges = lastChangeRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      const flushTimer = flushTimerRef.current
      if (flushTimer) clearTimeout(flushTimer)
      const retryTimer = retryTimerRef.current
      if (retryTimer) clearTimeout(retryTimer)
      for (const disposable of listeners.values()) disposable.dispose()
      listeners.clear()
      windows.clear()
      typingIntervals.clear()
      lastChanges.clear()
    }
  }, [])

  const syncStatus: SyncStatus = !isSupabaseConfigured
    ? 'local-only'
    : !userId
      ? 'signed-out'
      : queueState.status

  return {
    snapshotsByFile,
    pastesByFile,
    syncStatus,
    queuedCount: queueState.size,
    attachModel,
    handlePaste,
    captureManualSnapshot,
    restoreSnapshot,
    getModelValue,
    setModelValue,
    captureCurrent,
    flush,
    flushNow
  }
}
