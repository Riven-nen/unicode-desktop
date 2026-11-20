import { useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import BandBadge from './BandBadge'
import TypingHeatmap from './TypingHeatmap'
import { TERM_META, deriveRawInputs, describeIcs, termValue } from '../../lib/ics'
import type { IcsScoreRow, SnapshotEntry } from '../../types/professor'

interface IcsPanelProps {
  score: IcsScoreRow | null
  snapshots: SnapshotEntry[]
  onRecompute: () => void
  busy: boolean
  error: string | null
}

export default function IcsPanel({
  score,
  snapshots,
  onRecompute,
  busy,
  error
}: IcsPanelProps): React.ReactElement {
  const [heatmapOpen, setHeatmapOpen] = useState(false)

  return (
    <section className="ics-panel">
      <header className="panel-head">
        <h3>Integrity Score</h3>
        <BandBadge band={score?.band ?? null} />
      </header>

      {!score ? (
        <div className="ics-empty">
          <p>Not computed yet.</p>
          <button className="btn-secondary" onClick={onRecompute} disabled={busy}>
            <RefreshCw size={13} /> {busy ? 'Recomputing…' : 'Recompute'}
          </button>
          <p className="ics-note">
            Uses snapshot cadence and focus, paste events, and the newest Judge0 test result per
            case.
          </p>
        </div>
      ) : (
        <>
          <div className="ics-headline">
            <span className="ics-number">{score.ics.toFixed(1)}</span>
            <span className="ics-max">/ 100</span>
          </div>

          <div className="ics-bars">
            {TERM_META.map((term) => {
              const value = termValue(score, term.key)
              const pct = Math.max(0, Math.min(100, (value / term.max) * 100))
              const isCadence = term.key === 'cadence'
              return (
                <div
                  className={`ics-term ${isCadence ? 'is-clickable' : ''}`}
                  key={term.key}
                  role={isCadence ? 'button' : undefined}
                  tabIndex={isCadence ? 0 : undefined}
                  aria-expanded={isCadence ? heatmapOpen : undefined}
                  title={isCadence ? 'Show typing rhythm' : undefined}
                  onClick={() => {
                    if (isCadence) setHeatmapOpen((open) => !open)
                  }}
                  onKeyDown={(event) => {
                    if (!isCadence) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setHeatmapOpen((open) => !open)
                    }
                  }}
                >
                  <div className="ics-term-label">
                    <span>
                      {isCadence &&
                        (heatmapOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
                      {term.label}
                      {isCadence && <em className="ics-term-hint">typing rhythm</em>}
                    </span>
                    <span>
                      {value.toFixed(1)} / {term.max} · {Math.round(term.weight * 100)}%
                    </span>
                  </div>
                  <div className="ics-bar">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {heatmapOpen && <TypingHeatmap snapshots={snapshots} />}

          <p className="ics-explainer">{describeIcs(score)}</p>

          <div className="ics-raw" aria-label="Raw ICS inputs">
            <span>P {Math.round(deriveRawInputs(score).pasteRatio * 100)}%</span>
            <span>C {Math.round(deriveRawInputs(score).cadence)}</span>
            <span>F {Math.round(deriveRawInputs(score).focus)}</span>
            <span>K {Math.round(deriveRawInputs(score).compilation)}</span>
          </div>

          <div className="ics-actions">
            <button className="icon-text-btn" onClick={onRecompute} disabled={busy}>
              <RefreshCw size={12} /> {busy ? 'Recomputing…' : 'Recompute'}
            </button>
            <span className="ics-note">K uses the newest Judge0 result per test case.</span>
          </div>
        </>
      )}

      {error && <div className="grade-error">{error}</div>}
    </section>
  )
}
