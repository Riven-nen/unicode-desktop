import BandBadge from './BandBadge'
import { TERM_META, deriveRawInputs, describeIcs, termValue } from '../../lib/ics'
import type { IcsScoreRow } from '../../types/professor'

export default function IcsPanel({ score }: { score: IcsScoreRow | null }): React.ReactElement {
  if (!score) {
    return (
      <section className="ics-panel">
        <header className="panel-head">
          <h3>Integrity Score</h3>
          <BandBadge band={null} />
        </header>
        <div className="ics-empty">
          <p>Not yet computed.</p>
          <button
            className="btn-secondary"
            disabled
            title="The Chapter 3 signal pipeline is not implemented yet."
          >
            Recompute
          </button>
          <p className="ics-note">
            Recomputation needs the Chapter 3 signal pipeline; seeded scores are shown when present.
          </p>
        </div>
      </section>
    )
  }

  const raw = deriveRawInputs(score)

  return (
    <section className="ics-panel">
      <header className="panel-head">
        <h3>Integrity Score</h3>
        <BandBadge band={score.band} />
      </header>

      <div className="ics-headline">
        <span className="ics-number">{score.ics.toFixed(1)}</span>
        <span className="ics-max">/ 100</span>
      </div>

      <div className="ics-bars">
        {TERM_META.map((term) => {
          const value = termValue(score, term.key)
          const pct = Math.max(0, Math.min(100, (value / term.max) * 100))
          return (
            <div className="ics-term" key={term.key}>
              <div className="ics-term-label">
                <span>{term.label}</span>
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

      <p className="ics-explainer">{describeIcs(score)}</p>

      <div className="ics-raw" aria-label="Raw ICS inputs">
        <span>P {Math.round(raw.pasteRatio * 100)}%</span>
        <span>C {Math.round(raw.cadence)}</span>
        <span>F {Math.round(raw.focus)}</span>
        <span>K {Math.round(raw.compilation)}</span>
      </div>
    </section>
  )
}
