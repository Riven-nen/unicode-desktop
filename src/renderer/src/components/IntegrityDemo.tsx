import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import { RotateCcw, ShieldCheck, X } from 'lucide-react'
import { computeIcs } from '../lib/ics'
import { useTheme } from '../themes/useTheme'
import { defineMonacoThemes } from '../themes/themes'
import { useFont } from '../fonts/useFont'

interface IntegrityDemoProps {
  open: boolean
  onClose: () => void
}

interface LiveStats {
  typedChars: number
  pastedChars: number
  /** Gaps between typing bursts, used for cadence consistency. */
  intervals: number[]
  startedAt: number
  lastEventAt: number
  lastKeyAt: number
  /** Time already lost to idle gaps beyond the grace period. */
  idleMs: number
}

const IDLE_GRACE = 5000
const NEUTRAL_COMPILATION = 50
const STARTER = [
  '# Integrity demo playground',
  '# Type or paste Python below.',
  '',
  'def fib(n):',
  '    a, b = 0, 1',
  '    for _ in range(n):',
  '        a, b = b, a + b',
  '    return a',
  ''
].join('\n')

const initialStats = (): LiveStats => ({
  typedChars: 0,
  pastedChars: 0,
  intervals: [],
  startedAt: 0,
  lastEventAt: 0,
  lastKeyAt: 0,
  idleMs: 0
})

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** Consistent gaps score high; erratic gaps score low. */
function cadenceFrom(intervals: number[]): number {
  if (intervals.length < 4) return 60
  const recent = intervals.slice(-16)
  const mean = recent.reduce((total, value) => total + value, 0) / recent.length
  if (mean <= 0) return 60
  const variance = recent.reduce((total, value) => total + (value - mean) ** 2, 0) / recent.length
  const coefficient = Math.sqrt(variance) / mean
  return Math.round(clamp(100 * (1 - coefficient / 1.6), 0, 100))
}

const BAND_LABEL = { pass: 'PASS', review: 'REVIEW', flag: 'FLAG' } as const
const RADIUS = 56
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Live integrity-score playground: typing and pasting in the demo editor feed
 * the same weighted terms as the real pipeline, and the metric that just
 * changed is highlighted.
 */
export default function IntegrityDemo({
  open,
  onClose
}: IntegrityDemoProps): React.ReactElement | null {
  const [text, setText] = useState(STARTER)
  const [stats, setStats] = useState<LiveStats>(initialStats)
  const [now, setNow] = useState(() => Date.now())
  const [active, setActive] = useState<{
    key: 'paste' | 'cadence' | 'focus'
    at: number
  } | null>(null)
  const [event, setEvent] = useState<string | null>(null)
  const pastePending = useRef(0)
  const statsRef = useRef(stats)
  const idleFlag = useRef(false)
  const pasteDisposer = useRef<(() => void) | null>(null)
  const resetIgnore = useRef(false)
  const { monacoTheme } = useTheme()
  const { font, fontSize, ligatures } = useFont()

  useEffect(() => {
    statsRef.current = stats
  }, [stats])

  useEffect(() => {
    return () => {
      pasteDisposer.current?.()
      pasteDisposer.current = null
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (keyboardEvent: KeyboardEvent): void => {
      if (keyboardEvent.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // One-second tick keeps focus cooling visibly while the demo is idle.
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
          setEvent('Idle gap detected — focus retention is dropping.')
        }
        // Keep focus highlighted while the idle penalty is actually moving.
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
  const cadence = cadenceFrom(stats.intervals)
  const elapsed = stats.startedAt === 0 ? 0 : Math.max(now - stats.startedAt, 1000)
  const liveIdle =
    stats.idleMs + (stats.startedAt === 0 ? 0 : Math.max(0, now - stats.lastEventAt - IDLE_GRACE))
  const focus =
    stats.startedAt === 0 ? 100 : Math.round(clamp(100 * (1 - liveIdle / elapsed), 0, 100))
  const breakdown = computeIcs({
    pasteRatio,
    cadence,
    focus,
    compilation: NEUTRAL_COMPILATION
  })
  const score = Math.round(breakdown.ics)
  const band = breakdown.band
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
      const keyGap = previous.lastKeyAt === 0 ? 0 : Math.max(0, at - previous.lastKeyAt)
      const intervals =
        typedNow > 0 && previous.lastKeyAt > 0
          ? [...previous.intervals, Math.min(keyGap, 10000)].slice(-24)
          : previous.intervals

      return {
        typedChars: previous.typedChars + typedNow,
        pastedChars: previous.pastedChars + pastedNow,
        intervals,
        startedAt: firstEvent ? at : previous.startedAt,
        lastEventAt: at,
        lastKeyAt: typedNow > 0 ? at : previous.lastKeyAt,
        idleMs: previous.idleMs + idleAdded
      }
    })
  }

  const handleChange = (value: string): void => {
    if (resetIgnore.current) {
      resetIgnore.current = false
      setText(value)
      return
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
      setEvent(`Typing burst — cadence is being measured.`)
    } else {
      markActive('focus')
      setEvent('Editing activity — focus window updated.')
    }
  }

  const handleMount: OnMount = (editor) => {
    pasteDisposer.current?.()
    const dom = editor.getDomNode()
    if (!dom) return
    const onPaste = (event: ClipboardEvent): void => {
      pastePending.current = event.clipboardData?.getData('text').length ?? 0
    }
    dom.addEventListener('paste', onPaste, true)
    pasteDisposer.current = () => dom.removeEventListener('paste', onPaste, true)
  }

  const reset = (): void => {
    resetIgnore.current = true
    setText(STARTER)
    setStats(initialStats())
    setNow(Date.now())
    setActive(null)
    setEvent(null)
    pastePending.current = 0
    idleFlag.current = false
    window.setTimeout(() => {
      resetIgnore.current = false
    }, 1000)
  }

  const metrics = [
    {
      key: 'paste' as const,
      label: 'Paste',
      max: 35,
      value: `${Math.round(pasteRatio * 100)}%`,
      detail: `${stats.pastedChars} pasted of ${stats.typedChars + stats.pastedChars} inserted`,
      points: breakdown.pasteTerm
    },
    {
      key: 'cadence' as const,
      label: 'Cadence',
      max: 25,
      value: `${cadence}`,
      detail:
        stats.intervals.length < 4
          ? 'warming up — type a little more'
          : `${stats.intervals.length} typing gaps measured`,
      points: breakdown.cadenceTerm
    },
    {
      key: 'focus' as const,
      label: 'Focus',
      max: 20,
      value: `${focus}%`,
      detail: 'idle gaps beyond 5s lower this',
      points: breakdown.focusTerm
    },
    {
      key: 'compilation' as const,
      label: 'Tests',
      max: 20,
      value: 'Neutral',
      detail: 'Judge0 updates this after a run',
      points: breakdown.compilationTerm
    }
  ]

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-modal glass-panel integrity-demo"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <header className="auth-header">
          <span className="auth-title">
            <ShieldCheck size={15} /> Live integrity demo
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>

        <p className="auth-sub">
          Type or paste in the playground. The score recalculates on every edit and flashes the
          signal that just changed.
        </p>

        <div className="ics-live">
          <div className="ics-live-editor">
            <div className="ics-editor-head">
              <span>Playground</span>
              <button className="icon-text-btn" onClick={reset}>
                <RotateCcw size={11} /> Reset
              </button>
            </div>
            <div className="ics-code-host">
              <Editor
                height="100%"
                language="python"
                path="inmemory://ics-demo/playground.py"
                theme={monacoTheme}
                value={text}
                beforeMount={defineMonacoThemes}
                onMount={handleMount}
                onChange={(value) => handleChange(value ?? '')}
                loading={<div className="ics-editor-loading">Loading editor…</div>}
                options={{
                  ariaLabel: 'Integrity demo playground',
                  minimap: { enabled: false },
                  lineNumbers: 'off',
                  glyphMargin: false,
                  folding: false,
                  lineDecorationsWidth: 8,
                  lineNumbersMinChars: 0,
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  fontSize,
                  fontFamily: font.family,
                  fontLigatures: ligatures,
                  padding: { top: 10, bottom: 10 },
                  renderLineHighlight: 'none',
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  automaticLayout: true
                }}
              />
            </div>
            <p className="ics-editor-hint">
              Nothing here is saved or submitted. Paste a block after typing to see the paste term
              react immediately.
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

            <div className="ics-summary">
              <div className="ics-stack" aria-hidden="true">
                <span className="is-paste" style={{ width: `${breakdown.pasteTerm}%` }} />
                <span className="is-cadence" style={{ width: `${breakdown.cadenceTerm}%` }} />
                <span className="is-focus" style={{ width: `${breakdown.focusTerm}%` }} />
                <span
                  className="is-compilation"
                  style={{ width: `${breakdown.compilationTerm}%` }}
                />
              </div>
              <ul className="ics-legend">
                {metrics.map((metric) => (
                  <li key={metric.key} className={activeKey === metric.key ? 'is-active' : ''}>
                    <span className={`ics-dot is-${metric.key}`} /> {metric.label}{' '}
                    <strong>{metric.points.toFixed(1)}</strong>/{metric.max}
                  </li>
                ))}
              </ul>
            </div>

            <div className="ics-metrics">
              {metrics.map((metric) => (
                <div
                  key={metric.key}
                  className={`ics-metric ${activeKey === metric.key ? 'is-active' : ''}`}
                >
                  <div className="ics-metric-top">
                    <span>{metric.label}</span>
                    <strong>
                      {metric.points.toFixed(1)}
                      <small>/{metric.max}</small>
                    </strong>
                  </div>
                  <span className="ics-metric-value">{metric.value}</span>
                  <span className="ics-metric-detail">{metric.detail}</span>
                </div>
              ))}
            </div>

            <div className={`ics-event ${activeKey ? 'is-live' : ''}`}>
              <span className="ics-event-dot" />
              {event ?? 'Waiting for your first keystroke…'}
            </div>
          </div>
        </div>

        <p className="ics-demo-note">
          Bands: <strong>Pass</strong> 80+, <strong>Review</strong> 60+, <strong>Flag</strong> below
          60. Real scores use the same weights on your actual submission telemetry.
        </p>
      </div>
    </div>
  )
}
