import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import { Eye, EyeOff, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { fetchIcsSettings } from '../lib/adminQueries'
import { extensionForLanguage } from '../lib/icsDemo/assignments'
import { AuthorshipTracker, emptyEditStats } from '../lib/icsDemo/authorship'
import type { EditStats } from '../lib/icsDemo/authorship'
import {
  DEFAULT_ICS_METRIC,
  DEFAULT_ICS_POLICY,
  evaluateEvidence
} from '../lib/icsDemo/icsEvidence'
import type {
  DemoKeystroke,
  EvidenceResult,
  IcsMetricConfig,
  TimelinePoint,
  TrackedRun
} from '../lib/icsDemo/icsEvidence'
import { writeClipboardText } from '../lib/icsDemo/clipboard'
import { EDITOR_TYPING_OPTIONS } from '../lib/icsDemo/editorOptions'
import { registerHtmlCompletions } from '../lib/icsDemo/htmlCompletions'
import '../lib/icsDemo/monaco'
import '../icsDemo.css'

const DEMO_THEME = 'vs-dark'
const DEMO_FONT_FAMILY = "'Cascadia Code', Consolas, monospace"
const DEMO_FONT_SIZE = 13
const DEMO_FONT_LIGATURES = false

interface IcsDemoProps {
  open: boolean
  onClose: () => void
}

interface LiveStats {
  typedChars: number
  pastedChars: number
  startedAt: number
  lastEventAt: number
  /** Time already lost to idle gaps beyond the grace period. */
  idleMs: number
}

const IDLE_GRACE = 5 * 60 * 1000

const DEMO_LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'javascript', label: 'JavaScript' }
] as const

type DemoLanguage = (typeof DEMO_LANGUAGES)[number]['id']

const initialStats = (): LiveStats => ({
  typedChars: 0,
  pastedChars: 0,
  startedAt: 0,
  lastEventAt: 0,
  idleMs: 0
})

const BAND_LABEL = { pass: 'PASS', review: 'REVIEW', flag: 'FLAG' } as const
const RADIUS = 56
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const RUNS_KEY = 'unicode.icsDemoRuns.v1'

function loadRuns(): TrackedRun[] {
  try {
    const raw = localStorage.getItem(RUNS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as TrackedRun[]) : []
  } catch {
    return []
  }
}

function persistRuns(runs: TrackedRun[]): void {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs))
  } catch {
    // A full or blocked storage area must not break the demo.
  }
}

/** Offset of a 1-based Monaco position in a plain string. */
function offsetAt(text: string, line: number, column: number): number {
  let offset = 0
  let currentLine = 1
  while (currentLine < line) {
    const next = text.indexOf('\n', offset)
    if (next < 0) return text.length
    offset = next + 1
    currentLine += 1
  }
  return Math.min(text.length, offset + Math.max(0, column - 1))
}

function modifierString(event: KeyboardEvent): string {
  return `${event.ctrlKey ? 'C' : ''}${event.altKey ? 'A' : ''}${event.shiftKey ? 'S' : ''}${event.metaKey ? 'M' : ''}`
}

function evidenceFor(
  edits: EditStats,
  pastedChars: number,
  focus: { returns: number },
  intervals: number[],
  metric: IcsMetricConfig
): EvidenceResult {
  return evaluateEvidence(
    {
      insertedChars: edits.insertedChars,
      pastedChars,
      edits: {
        inserts: edits.inserts,
        fixes: edits.deletes,
        reworks: edits.reworks,
        revisits: edits.revisits,
        midLineResumes: edits.midLinePauses,
        undoRedo: edits.undoRedo,
        pauses: edits.pauses,
        chunkBursts: edits.chunkBursts,
        chunkChars: edits.chunkChars,
        deletions: edits.deletes,
        bursts: edits.bursts
      },
      returns: focus.returns,
      immediateChunks: edits.immediateChunks,
      intervals,
      coverage: 1
    },
    DEFAULT_ICS_POLICY,
    metric
  )
}

/**
 * Live integrity-score playground: typing and pasting in the demo editor feed
 * the same weighted terms as the real pipeline, and the metric that just
 * changed is highlighted.
 */
export default function IcsDemo({ open, onClose }: IcsDemoProps): React.ReactElement | null {
  const [language, setLanguage] = useState<DemoLanguage>('python')
  const [text, setText] = useState('')
  const [stats, setStats] = useState<LiveStats>(initialStats)
  const [authorshipStats, setAuthorshipStats] = useState<EditStats>(emptyEditStats)
  const [focusStats, setFocusStats] = useState({ returns: 0, awayMs: 0 })
  const [intervals, setIntervals] = useState<number[]>([])
  const [scenario, setScenario] = useState('')
  const [runs, setRuns] = useState<TrackedRun[]>(() => loadRuns())
  const [recording, setRecording] = useState(false)
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [recordStartedAt, setRecordStartedAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [active, setActive] = useState<{
    key: 'paste' | 'cadence' | 'focus'
    at: number
  } | null>(null)
  const [event, setEvent] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [metric, setMetric] = useState<IcsMetricConfig>(DEFAULT_ICS_METRIC)
  const [metricVersion, setMetricVersion] = useState<number | null>(null)
  const pastePending = useRef(0)
  const statsRef = useRef(stats)
  const idleFlag = useRef(false)
  const authorshipRef = useRef(new AuthorshipTracker())
  const intervalsRef = useRef<number[]>([])
  const lastIntervalAtRef = useRef(0)
  const keystrokesRef = useRef<DemoKeystroke[]>([])
  const sessionStartRef = useRef(0)
  const lastPasteAtRef = useRef(0)
  const [keylogCount, setKeylogCount] = useState(0)
  const recordingRef = useRef(false)
  const liveRef = useRef<TimelinePoint | null>(null)
  const focusRef = useRef({
    returns: 0,
    awayMs: 0,
    awayStartedAt: 0,
    lastReturnAt: 0,
    usedReturn: false
  })
  const pasteDisposer = useRef<(() => void) | null>(null)
  const changeDisposer = useRef<(() => void) | null>(null)
  const previousValueRef = useRef('')

  const logEvent = (entry: Omit<DemoKeystroke, 't'>, at = Date.now()): void => {
    if (sessionStartRef.current === 0) sessionStartRef.current = at
    keystrokesRef.current.push({ t: at - sessionStartRef.current, ...entry })
    if (keystrokesRef.current.length > 2000) keystrokesRef.current.splice(0, 200)
    if (entry.kind !== 'keydown' && entry.kind !== 'keyup' && entry.kind !== 'cursor') {
      setKeylogCount(keystrokesRef.current.length)
    }
  }
  /** The next controlled value change is starter replacement, not user input. */
  const resetPending = useRef<string | null>(null)

  const closeDemo = useCallback((): void => {
    setPreviewOpen(false)
    onClose()
  }, [onClose])

  useEffect(() => {
    statsRef.current = stats
  }, [stats])

  // The demo runs against the live admin metric, not a frozen copy.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetchIcsSettings()
      .then((settings) => {
        if (cancelled) return
        setMetric(settings)
        setMetricVersion(settings.version)
      })
      .catch(() => {
        if (cancelled) return
        setMetric(DEFAULT_ICS_METRIC)
        setMetricVersion(null)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    return () => {
      pasteDisposer.current?.()
      pasteDisposer.current = null
      changeDisposer.current?.()
      changeDisposer.current = null
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (keyboardEvent: KeyboardEvent): void => {
      if (keyboardEvent.key === 'Escape') closeDemo()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeDemo])

  // Window focus tracking for the v3 away signal.
  useEffect(() => {
    if (!open) return
    const markAway = (): void => {
      const focus = focusRef.current
      if (focus.awayStartedAt > 0) return
      focus.awayStartedAt = Date.now()
      logEvent({ kind: 'blur' })
    }
    const markBack = (): void => {
      const focus = focusRef.current
      if (focus.awayStartedAt === 0) return
      const nowMs = Date.now()
      focus.awayMs += nowMs - focus.awayStartedAt
      focus.awayStartedAt = 0
      focus.returns += 1
      focus.lastReturnAt = nowMs
      focus.usedReturn = false
      logEvent({ kind: 'focus' }, nowMs)
      setFocusStats({ returns: focus.returns, awayMs: focus.awayMs })
      setNow(nowMs)
    }
    const onVisibility = (): void => {
      if (document.hidden) markAway()
      else markBack()
    }
    const onBlur = (): void => markAway()
    const onFocus = (): void => markBack()
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [open])

  // Keep a live snapshot of the score and evidence for the recording sampler.
  useEffect(() => {
    if (!open) return
    const auth = authorshipRef.current.snapshot()
    const ev = evidenceFor(auth, stats.pastedChars, focusStats, intervals, metric)
    liveRef.current = {
      t: 0,
      score: Math.round(ev.score),
      band: ev.band,
      confidence: ev.confidence,
      values: ev.values,
      counts: {
        insertedChars: auth.insertedChars,
        pastedChars: stats.pastedChars,
        fixes: auth.deletes,
        reworks: auth.reworks,
        revisits: auth.revisits,
        pauses: auth.pauses,
        chunkBursts: auth.chunkBursts,
        chunkChars: auth.chunkChars,
        bursts: auth.bursts,
        returns: focusStats.returns,
        immediateChunks: auth.immediateChunks
      }
    }
  }, [open, authorshipStats, stats, focusStats, intervals, metric])

  // Sample the live score twice a second while recording.
  useEffect(() => {
    if (!open || !recording) return
    const sample = (): void => {
      const live = liveRef.current
      if (!live) return
      setTimeline((previous) =>
        [...previous, { ...live, t: Date.now() - recordStartedAt }].slice(-600)
      )
    }
    sample()
    const timer = window.setInterval(sample, 500)
    return () => window.clearInterval(timer)
  }, [open, recording, recordStartedAt])

  // One-second tick updates the timer and warns about long idle gaps. Idle
  // time itself is not scored: only a blur → return → immediate line chunk
  // counts as away evidence.
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      const tick = Date.now()
      setNow(tick)
      const current = statsRef.current
      if (current.startedAt === 0) return
      const idle = tick - current.lastEventAt
      if (idle > IDLE_GRACE) {
        if (!idleFlag.current) {
          idleFlag.current = true
          setEvent('Paused for 5+ minutes — pauses are neutral; only edits move the score.')
        }
        setActive({ key: 'focus', at: tick })
      }
      if (idle <= IDLE_GRACE) idleFlag.current = false
    }, 1000)
    return () => clearInterval(timer)
  }, [open])

  // Clear the highlight shortly after the metric stops changing.
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setActive(null), 1200)
    return () => clearTimeout(timer)
  }, [active])

  if (!open) return null

  const pasteRatio =
    stats.typedChars + stats.pastedChars === 0
      ? 0
      : stats.pastedChars / (stats.typedChars + stats.pastedChars)
  const evidence = evidenceFor(authorshipStats, stats.pastedChars, focusStats, intervals, metric)
  const score = Math.round(evidence.score)
  const band = evidence.band
  const activeKey = active?.key ?? null

  const markActive = (key: 'paste' | 'cadence' | 'focus'): void => {
    setActive({ key, at: Date.now() })
  }

  const recordEdit = (inserted: number, pastedNow: number, at: number): void => {
    setStats((previous) => {
      const typedNow = Math.max(0, inserted - pastedNow)
      const firstEvent = previous.startedAt === 0
      const gap = firstEvent ? 0 : Math.max(0, at - previous.lastEventAt)
      const idleAdded = firstEvent ? 0 : Math.max(0, gap - IDLE_GRACE)

      return {
        typedChars: previous.typedChars + typedNow,
        pastedChars: previous.pastedChars + pastedNow,
        startedAt: firstEvent ? at : previous.startedAt,
        lastEventAt: at,
        idleMs: previous.idleMs + idleAdded
      }
    })
  }

  const handleChange = (value: string): void => {
    if (resetPending.current !== null) {
      const expected = resetPending.current
      resetPending.current = null
      if (value === expected) {
        setText(value)
        return
      }
    }
    const at = Date.now()
    const delta = Math.max(0, value.length - text.length)
    const pastedNow = Math.min(pastePending.current, delta)
    pastePending.current = 0
    setText(value)
    recordEdit(delta, pastedNow, at)

    if (pastedNow > 0) {
      markActive('paste')
      setEvent(`Pasted ${pastedNow} characters — the paste term drops.`)
    } else if (delta > 0) {
      markActive('cadence')
      setEvent('Typing burst — authorship evidence is being measured.')
    } else {
      markActive('focus')
      setEvent('Editing activity — focus window updated.')
    }
  }

  const handleMount: OnMount = (editor) => {
    pasteDisposer.current?.()
    changeDisposer.current?.()
    const dom = editor.getDomNode()
    previousValueRef.current = editor.getValue()
    if (dom) {
      const onPaste = (event: ClipboardEvent): void => {
        pastePending.current = event.clipboardData?.getData('text').length ?? 0
        lastPasteAtRef.current = Date.now()
        authorshipRef.current.discardBurst()
        logEvent({ kind: 'paste', d: pastePending.current })
      }
      const onCopy = (): void => logEvent({ kind: 'copy' })
      const onCut = (): void => logEvent({ kind: 'cut' })
      const onKeyDown = (event: KeyboardEvent): void =>
        logEvent({
          kind: 'keydown',
          key: event.key,
          code: event.code,
          mods: modifierString(event)
        })
      const onKeyUp = (event: KeyboardEvent): void =>
        logEvent({
          kind: 'keyup',
          key: event.key,
          code: event.code,
          mods: modifierString(event)
        })
      dom.addEventListener('paste', onPaste, true)
      dom.addEventListener('copy', onCopy, true)
      dom.addEventListener('cut', onCut, true)
      dom.addEventListener('keydown', onKeyDown, true)
      dom.addEventListener('keyup', onKeyUp, true)
      pasteDisposer.current = () => {
        dom.removeEventListener('paste', onPaste, true)
        dom.removeEventListener('copy', onCopy, true)
        dom.removeEventListener('cut', onCut, true)
        dom.removeEventListener('keydown', onKeyDown, true)
        dom.removeEventListener('keyup', onKeyUp, true)
      }
    } else {
      pasteDisposer.current = null
    }

    const changeSubscription = editor.onDidChangeModelContent((contentEvent) => {
      if (contentEvent.isFlush) return
      let insertedChars = 0
      let deletedChars = 0
      let startLine = Number.MAX_SAFE_INTEGER
      let startColumn = Number.MAX_SAFE_INTEGER
      let containsNewline = false
      for (const change of contentEvent.changes) {
        insertedChars += change.text.length
        deletedChars += change.rangeLength
        if (change.text.includes('\n')) containsNewline = true
        startLine = Math.min(startLine, change.range.startLineNumber)
        startColumn = Math.min(startColumn, change.range.startColumn)
      }
      const safeStartLine = startLine === Number.MAX_SAFE_INTEGER ? 1 : startLine
      const lineText = editor.getModel()?.getLineContent(safeStartLine) ?? ''
      const lineIndent = (lineText.match(/^[ \t]*/) ?? [''])[0].length
      const previousValue = previousValueRef.current
      let deletedText = ''
      for (const change of contentEvent.changes) {
        const start = offsetAt(
          previousValue,
          change.range.startLineNumber,
          change.range.startColumn
        )
        deletedText += previousValue.slice(start, start + change.rangeLength)
      }
      previousValueRef.current = editor.getValue()
      const now = Date.now()
      if (insertedChars > 0 && !contentEvent.isUndoing && !contentEvent.isRedoing) {
        const previous = lastIntervalAtRef.current
        if (previous > 0) {
          const gap = now - previous
          if (gap >= 20 && gap <= 10_000 && intervalsRef.current.length < 300) {
            intervalsRef.current.push(Math.round(gap))
            setIntervals(intervalsRef.current.slice(-200))
          }
        }
        lastIntervalAtRef.current = now
      }
      const focus = focusRef.current
      const afterReturn =
        focus.lastReturnAt > 0 && !focus.usedReturn && now - focus.lastReturnAt <= 2500
      if (afterReturn) focus.usedReturn = true
      if (sessionStartRef.current === 0) sessionStartRef.current = now
      const insertedText = contentEvent.changes.map((change) => change.text).join('')
      const kind: DemoKeystroke['kind'] = contentEvent.isUndoing
        ? 'undo'
        : contentEvent.isRedoing
          ? 'redo'
          : now - lastPasteAtRef.current < 60
            ? 'paste'
            : insertedChars > 0 && deletedChars > 0
              ? 'replace'
              : deletedChars > 0
                ? 'delete'
                : 'insert'
      logEvent(
        {
          kind,
          text: insertedText.slice(0, 120),
          del: deletedText.slice(0, 120),
          d: deletedChars,
          l: safeStartLine,
          c: startColumn === Number.MAX_SAFE_INTEGER ? 1 : startColumn,
          i: lineIndent,
          r: afterReturn
        },
        now
      )
      authorshipRef.current.record(
        {
          insertedChars,
          deletedChars,
          insertedText,
          deletedText,
          startLine: safeStartLine,
          startColumn: startColumn === Number.MAX_SAFE_INTEGER ? 1 : startColumn,
          lineIndent,
          containsNewline,
          afterReturn,
          isUndoRedo: contentEvent.isUndoing || contentEvent.isRedoing
        },
        now
      )
      setAuthorshipStats(authorshipRef.current.snapshot())
    })
    const cursorSubscription = editor.onDidChangeCursorSelection((selectionEvent) => {
      const position = selectionEvent.selection.getPosition()
      const selectionLength = selectionEvent.selection.isEmpty()
        ? 0
        : (editor.getModel()?.getValueInRange(selectionEvent.selection).length ?? 0)
      logEvent({
        kind: 'cursor',
        l: position.lineNumber,
        c: position.column,
        sel: selectionLength
      })
    })
    changeDisposer.current = () => {
      changeSubscription.dispose()
      cursorSubscription.dispose()
    }
  }

  const togglePreview = (): void => {
    setPreviewOpen((open) => !open)
  }

  const resetPlayground = (message: string | null): void => {
    resetPending.current = ''
    setText('')
    setStats(initialStats())
    authorshipRef.current.reset()
    setAuthorshipStats(emptyEditStats())
    intervalsRef.current = []
    lastIntervalAtRef.current = 0
    setIntervals([])
    keystrokesRef.current = []
    sessionStartRef.current = 0
    lastPasteAtRef.current = 0
    setKeylogCount(0)
    focusRef.current = {
      returns: 0,
      awayMs: 0,
      awayStartedAt: 0,
      lastReturnAt: 0,
      usedReturn: false
    }
    setFocusStats({ returns: 0, awayMs: 0 })
    setNow(Date.now())
    setActive(null)
    setEvent(message)
    pastePending.current = 0
    idleFlag.current = false
  }

  const changeLanguage = (next: DemoLanguage): void => {
    if (next === language) return
    setPreviewOpen(false)
    setLanguage(next)
    const label = DEMO_LANGUAGES.find((option) => option.id === next)?.label ?? next
    resetPlayground(`Switched to ${label} — the live score starts fresh.`)
  }

  const reset = (): void => {
    resetPlayground(null)
  }

  const ledger = [
    {
      key: 'authored',
      label: 'Authorship',
      value: evidence.values.authored,
      contribution: evidence.contributions.authored,
      active: activeKey === 'cadence'
    },
    {
      key: 'paste',
      label: 'Paste',
      value: evidence.values.paste,
      contribution: evidence.contributions.paste,
      active: activeKey === 'paste'
    },
    {
      key: 'transcription',
      label: 'Transcription',
      value: evidence.values.transcription,
      contribution: evidence.contributions.transcription,
      active: activeKey === 'cadence'
    },
    {
      key: 'rhythm',
      label: 'Rhythm',
      value: evidence.values.rhythm,
      contribution: evidence.contributions.rhythm,
      active: false
    },
    {
      key: 'away',
      label: 'Away',
      value: evidence.values.away,
      contribution: evidence.contributions.away,
      active: activeKey === 'focus'
    },
    {
      key: 'similarity',
      label: 'Similarity',
      value: evidence.values.similarity,
      contribution: evidence.contributions.similarity,
      active: false
    }
  ]

  const cards = [
    {
      key: 'authored',
      label: 'Authorship',
      value: `${Math.round(evidence.values.authored * 100)}`,
      detail: `${authorshipStats.deletes} fixes · ${authorshipStats.reworks} rewrites · ${authorshipStats.revisits} revisits`,
      active: activeKey === 'cadence'
    },
    {
      key: 'paste',
      label: 'Paste',
      value: `${Math.round(pasteRatio * 100)}%`,
      detail: `${stats.pastedChars} pasted of ${authorshipStats.insertedChars + stats.pastedChars} inserted`,
      active: activeKey === 'paste'
    },
    {
      key: 'transcription',
      label: 'Transcription',
      value: `${Math.round(evidence.values.transcription * 100)}`,
      detail: `${authorshipStats.chunkBursts} chunks / ${authorshipStats.pauses} pauses · ${authorshipStats.deletes} deletions`,
      active: false
    },
    {
      key: 'confidence',
      label: 'Confidence',
      value: `${Math.round(evidence.confidence * 100)}%`,
      detail: evidence.limited ? 'limited evidence — review, not pass' : 'enough evidence to score',
      active: false
    }
  ]

  const startRecording = (): void => {
    const name = scenario.trim() || `Scenario ${runs.length + 1}`
    setScenario(name)
    resetPlayground(null)
    keystrokesRef.current = []
    sessionStartRef.current = 0
    setKeylogCount(0)
    setTimeline([])
    setRecordStartedAt(Date.now())
    recordingRef.current = true
    setRecording(true)
    setEvent(`Recording "${name}" — type or paste, then press Stop & save.`)
  }

  const stopRecording = (): void => {
    recordingRef.current = false
    setRecording(false)
    const liveStats = authorshipRef.current.snapshot()
    if (liveStats.insertedChars === 0) {
      setEvent('No edits recorded — nothing saved.')
      return
    }
    const liveEvidence = evidenceFor(
      liveStats,
      stats.pastedChars,
      focusStats,
      intervalsRef.current,
      metric
    )
    const counts = {
      insertedChars: liveStats.insertedChars,
      pastedChars: stats.pastedChars,
      fixes: liveStats.deletes,
      reworks: liveStats.reworks,
      revisits: liveStats.revisits,
      pauses: liveStats.pauses,
      chunkBursts: liveStats.chunkBursts,
      chunkChars: liveStats.chunkChars,
      bursts: liveStats.bursts,
      returns: focusStats.returns,
      immediateChunks: liveStats.immediateChunks
    }
    const durationMs = Date.now() - recordStartedAt
    const finalPoint: TimelinePoint = {
      t: durationMs,
      score: Math.round(liveEvidence.score),
      band: liveEvidence.band,
      confidence: liveEvidence.confidence,
      values: liveEvidence.values,
      counts
    }
    const finalTimeline = [...timeline, finalPoint].slice(-600)
    const run: TrackedRun = {
      id: crypto.randomUUID(),
      scenario: scenario.trim() || `Scenario ${runs.length + 1}`,
      at: new Date().toISOString(),
      startedAt: new Date(recordStartedAt).toISOString(),
      durationMs,
      language,
      score: liveEvidence.score,
      band: liveEvidence.band,
      confidence: liveEvidence.confidence,
      reason: liveEvidence.reason,
      values: liveEvidence.values,
      counts,
      keylog: keystrokesRef.current.slice(-1000),
      timeline: finalTimeline
    }
    const next = [run, ...runs].slice(0, 30)
    setRuns(next)
    persistRuns(next)
    setTimeline(finalTimeline)
    setEvent(
      `Saved "${run.scenario}" — ${Math.round(run.score)} ${BAND_LABEL[run.band]} over ${(
        durationMs / 1000
      ).toFixed(1)}s.`
    )
  }

  const removeRun = (id: string): void => {
    const next = runs.filter((run) => run.id !== id)
    setRuns(next)
    persistRuns(next)
  }

  const clearRuns = (): void => {
    setRuns([])
    persistRuns([])
    setEvent('Cleared tracked runs.')
  }

  const copyRuns = (): void => {
    if (runs.length === 0) return
    void writeClipboardText(JSON.stringify(runs, null, 2)).then(
      () => setEvent(`Copied ${runs.length} tracked runs as JSON.`),
      () => setEvent('Could not copy tracked runs.')
    )
  }

  const copyKeylog = (): void => {
    if (keystrokesRef.current.length === 0) return
    void writeClipboardText(JSON.stringify(keystrokesRef.current, null, 2)).then(
      () => setEvent(`Copied ${keystrokesRef.current.length} keylog events.`),
      () => setEvent('Could not copy the keylog.')
    )
  }

  return (
    <div className="auth-overlay" onClick={closeDemo}>
      <div
        className="auth-modal glass-panel integrity-demo"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <header className="auth-header">
          <span className="auth-title">
            <ShieldCheck size={15} /> ICS metric demo
          </span>
          <button className="diff-close" onClick={closeDemo} title="Close">
            <X size={14} />
          </button>
        </header>

        <p className="auth-sub">
          Type or paste in the playground. The score uses the live admin metric
          {metricVersion === null ? ' (shipped defaults)' : ` version ${metricVersion}`} and
          recalculates on every edit, flashing the signal that just changed.
        </p>

        <div className="ics-live">
          <div className="ics-live-editor">
            <div className="ics-editor-head">
              <span>Playground</span>
              <div className="ics-editor-tools">
                <label className="ics-language-picker">
                  <select
                    value={language}
                    aria-label="Playground language"
                    onChange={(selectEvent) =>
                      changeLanguage(selectEvent.target.value as DemoLanguage)
                    }
                  >
                    {DEMO_LANGUAGES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {language === 'html' && (
                  <button
                    className={`icon-text-btn ${previewOpen ? 'is-active' : ''}`}
                    onClick={togglePreview}
                    title={previewOpen ? 'Hide the inline preview' : 'Preview the HTML inline'}
                  >
                    {previewOpen ? <EyeOff size={11} /> : <Eye size={11} />}
                    {previewOpen ? 'Hide preview' : 'Preview'}
                  </button>
                )}
                <button className="icon-text-btn" onClick={reset}>
                  <RotateCcw size={11} /> Reset
                </button>
              </div>
            </div>
            <div className={`ics-code-host ${previewOpen ? 'is-previewing' : ''}`}>
              <Editor
                key={language}
                height="100%"
                language={language}
                path={`inmemory://ics-demo/playground${extensionForLanguage(language)}`}
                theme={DEMO_THEME}
                value={text}
                beforeMount={(monacoInstance) => {
                  registerHtmlCompletions(monacoInstance)
                }}
                onMount={handleMount}
                onChange={(value) => handleChange(value ?? '')}
                loading={<div className="ics-editor-loading">Loading editor…</div>}
                options={{
                  ...EDITOR_TYPING_OPTIONS,
                  ariaLabel: 'Integrity demo playground',
                  placeholder: 'Type or paste code here…',
                  minimap: { enabled: false },
                  lineNumbers: 'off',
                  glyphMargin: false,
                  folding: false,
                  lineDecorationsWidth: 8,
                  lineNumbersMinChars: 0,
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  fontSize: DEMO_FONT_SIZE,
                  fontFamily: DEMO_FONT_FAMILY,
                  fontLigatures: DEMO_FONT_LIGATURES,
                  padding: { top: 10, bottom: 10 },
                  renderLineHighlight: 'none',
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  automaticLayout: true
                }}
              />
            </div>

            {previewOpen && language === 'html' && (
              <div className="ics-html-preview">
                <div className="ics-html-preview-head">
                  <span>Inline preview</span>
                  <span className="ics-html-preview-url">Rendered from the editor</span>
                  <button
                    className="icon-text-btn"
                    onClick={() => setPreviewOpen(false)}
                    title="Hide the inline preview"
                  >
                    <EyeOff size={11} /> Hide
                  </button>
                </div>
                <iframe
                  className="ics-html-preview-frame"
                  srcDoc={text}
                  title="HTML preview"
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                />
              </div>
            )}

            <p className="ics-editor-hint">
              Nothing here is saved or submitted. Pick a language and start typing, or paste a
              block, to see each term react immediately.
            </p>
          </div>

          <div className="ics-live-side">
            <div className={`ics-gauge is-${band}`}>
              <svg viewBox="0 0 140 140" className="ics-gauge-svg" aria-hidden="true">
                <circle cx="70" cy="70" r={RADIUS} className="ics-gauge-track" />
                <circle
                  cx="70"
                  cy="70"
                  r={RADIUS}
                  className="ics-gauge-fill"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
                  transform="rotate(-90 70 70)"
                />
              </svg>
              <div className="ics-gauge-center">
                <strong>{score}</strong>
                <span>{BAND_LABEL[band]}</span>
              </div>
            </div>

            {evidence.limited && (
              <p className="ics-gauge-note">
                <strong>{score}</strong> is the evidence score. {authorshipStats.insertedChars}{' '}
                characters and {authorshipStats.bursts} bursts give{' '}
                {Math.round(evidence.confidence * 100)}% confidence; below{' '}
                {Math.round(metric.minConfidence * 100)}% the band is always Review, even when the
                evidence itself is positive.
              </p>
            )}

            <div className="ics-track">
              <div className="ics-track-head">
                <input
                  value={scenario}
                  onChange={(inputEvent) => setScenario(inputEvent.target.value)}
                  placeholder="Name this scenario (e.g. hand-copy, second monitor)"
                  aria-label="Scenario name"
                  disabled={recording}
                />
                <button
                  className={`icon-text-btn ${recording ? 'is-recording' : ''}`}
                  onClick={recording ? stopRecording : startRecording}
                >
                  {recording ? 'Stop & save' : 'Start recording'}
                </button>
              </div>
              {recording && (
                <div className="ics-rec">
                  <span className="ics-rec-dot" /> REC{' '}
                  {Math.max(0, Math.floor((now - recordStartedAt) / 1000))}s · {timeline.length}{' '}
                  samples · {keylogCount} key events
                </div>
              )}
              <TimelineChart
                points={timeline}
                passThreshold={metric.passThreshold}
                reviewThreshold={metric.reviewThreshold}
              />
              <details className="ics-runs" open={runs.length > 0}>
                <summary>
                  Saved runs ({runs.length}) · keylog {keylogCount}
                </summary>
                {runs.length === 0 ? (
                  <p className="ics-runs-empty">
                    Name a scenario, press Start recording, then Stop &amp; save to keep the score
                    timeline and keylog here.
                  </p>
                ) : (
                  <ul className="ics-runs-list">
                    {runs.map((run) => (
                      <li
                        key={run.id}
                        onClick={() => setTimeline(run.timeline ?? [])}
                        title={run.timeline ? 'Show this run’s timeline' : undefined}
                      >
                        <span className="ics-run-scenario">{run.scenario}</span>
                        <span className={`ics-run-band is-${run.band}`}>
                          {Math.round(run.score)} {BAND_LABEL[run.band]}
                        </span>
                        <span className="ics-run-meta">
                          {run.durationMs ? `${(run.durationMs / 1000).toFixed(0)}s · ` : ''}C{' '}
                          {Math.round(run.confidence * 100)}%
                        </span>
                        <button
                          className="ics-run-remove"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation()
                            removeRun(run.id)
                          }}
                          title="Remove run"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="ics-runs-actions">
                  <button className="icon-text-btn" onClick={copyRuns} disabled={runs.length === 0}>
                    Copy JSON
                  </button>
                  <button
                    className="icon-text-btn"
                    onClick={copyKeylog}
                    disabled={keylogCount === 0}
                  >
                    Copy keylog
                  </button>
                  <button
                    className="icon-text-btn"
                    onClick={clearRuns}
                    disabled={runs.length === 0}
                  >
                    Clear
                  </button>
                </div>
              </details>
            </div>

            <div className="ics-ledger">
              {ledger.map((row) => (
                <div key={row.key} className={`ics-ledger-row ${row.active ? 'is-active' : ''}`}>
                  <span className="ics-ledger-label">{row.label}</span>
                  <span className="ics-ledger-value">{Math.round(row.value * 100)}</span>
                  <span
                    className={`ics-ledger-contrib ${row.contribution > 0 ? 'is-up' : row.contribution < 0 ? 'is-down' : ''}`}
                  >
                    {row.contribution > 0 ? '+' : ''}
                    {row.contribution.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>

            <div className="ics-confidence">
              <div className="ics-confidence-top">
                <span>Confidence</span>
                <strong>{Math.round(evidence.confidence * 100)}%</strong>
              </div>
              <div className="ics-bar">
                <span style={{ width: `${Math.round(evidence.confidence * 100)}%` }} />
              </div>
              <span className="ics-confidence-note">
                {evidence.limited
                  ? 'Limited evidence — the band is held at Review.'
                  : 'Evidence volume is sufficient for a band.'}
              </span>
            </div>

            <div className="ics-metrics">
              {cards.map((card) => (
                <div key={card.key} className={`ics-metric ${card.active ? 'is-active' : ''}`}>
                  <div className="ics-metric-top">
                    <span>{card.label}</span>
                  </div>
                  <span className="ics-metric-value">{card.value}</span>
                  <span className="ics-metric-detail">{card.detail}</span>
                </div>
              ))}
            </div>

            <div className="ics-band-reason">
              <span className={`ics-dot is-${band}`} />
              {evidence.reason}
            </div>

            <div className={`ics-event ${activeKey ? 'is-live' : ''}`}>
              <span className="ics-event-dot" />
              {event ?? 'Waiting for your first keystroke…'}
            </div>
          </div>
        </div>

        <p className="ics-demo-note">
          Bands: <strong>Pass</strong> {metric.passThreshold}+, <strong>Review</strong>{' '}
          {metric.reviewThreshold}+, <strong>Flag</strong> below {metric.reviewThreshold}. Tests are
          quality, not integrity. Pauses are neutral; corrections and revisits raise the score,
          while line chunks and paste lower it.
        </p>
      </div>
    </div>
  )
}

function TimelineChart({
  points,
  passThreshold,
  reviewThreshold
}: {
  points: TimelinePoint[]
  passThreshold: number
  reviewThreshold: number
}): React.ReactElement {
  if (points.length < 2) {
    return <div className="ics-timeline-empty">Score samples appear while recording.</div>
  }
  const width = 100
  const height = 36
  const maxT = Math.max(points[points.length - 1].t, 1000)
  const y = (score: number): string =>
    (height - (Math.max(0, Math.min(100, score)) / 100) * height).toFixed(2)
  const line = points
    .map((point) => `${((point.t / maxT) * width).toFixed(2)},${y(point.score)}`)
    .join(' ')
  const last = points[points.length - 1]
  return (
    <div className="ics-timeline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Score over time"
      >
        <line
          x1="0"
          y1={y(passThreshold)}
          x2={width}
          y2={y(passThreshold)}
          className="ics-timeline-pass"
        />
        <line
          x1="0"
          y1={y(reviewThreshold)}
          x2={width}
          y2={y(reviewThreshold)}
          className="ics-timeline-review"
        />
        <polyline points={line} className="ics-timeline-line" />
      </svg>
      <div className="ics-timeline-meta">
        <span>
          {Math.round(maxT / 1000)}s · {points.length} samples
        </span>
        <span>
          final {Math.round(last.score)} {BAND_LABEL[last.band]}
        </span>
      </div>
    </div>
  )
}
