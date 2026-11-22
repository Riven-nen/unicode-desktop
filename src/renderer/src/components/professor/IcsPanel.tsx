import { useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import BandBadge from './BandBadge'
import TypingHeatmap from './TypingHeatmap'
import type { IcsScoreRow, SnapshotEntry } from '../../types/professor'

interface IcsPanelProps {
  score: IcsScoreRow | null
  snapshots: SnapshotEntry[]
  onRecompute: () => void
  busy: boolean
  error: string | null
}

const value = (input: number | string | undefined | null): number => Number(input) || 0

export default function IcsPanel({
  score,
  snapshots,
  onRecompute,
  busy,
  error
}: IcsPanelProps): React.ReactElement {
  const [heatmapOpen, setHeatmapOpen] = useState(false)
  const evidence = score?.evidence ?? null
  const examMode = score?.examMode === true

  const ledger = evidence
    ? [
        {
          key: 'authored',
          label: 'Authorship',
          score: value(evidence.authored),
          contribution: 45 * value(evidence.authored)
        },
        {
          key: 'paste',
          label: examMode ? 'Paste (N/A)' : 'Paste',
          score: examMode ? 0 : value(evidence.paste),
          contribution: examMode ? 0 : -40.5 * value(evidence.paste)
        },
        {
          key: 'transcription',
          label: 'Transcription',
          score: value(evidence.transcription),
          contribution: -36 * value(evidence.transcription)
        },
        {
          key: 'rhythm',
          label: 'Rhythm',
          score: value(evidence.rhythm),
          contribution: -9 * value(evidence.rhythm)
        },
        {
          key: 'away',
          label: 'Away',
          score: value(evidence.away),
          contribution: -13.5 * value(evidence.away)
        },
        {
          key: 'similarity',
          label: 'Similarity',
          score: value(evidence.similarity),
          contribution: -22.5 * value(evidence.similarity)
        }
      ]
    : []

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
            Uses authored evidence (corrections, revisits), paste, typing shape, away/resume
            behaviour, and the newest Judge0 result as a separate quality signal.
          </p>
        </div>
      ) : (
        <>
          <div className="ics-headline">
            <span className="ics-number">{score.ics.toFixed(1)}</span>
            <span className="ics-max">/ 100</span>
            <span className="ics-model">{score.model ?? 'v2'}</span>
          </div>

          {evidence ? (
            <>
              <div className="ics-ledger" aria-label="Evidence ledger">
                {ledger.map((row) => (
                  <div className="ics-ledger-row" key={row.key}>
                    <span className="ics-ledger-label">{row.label}</span>
                    <span className="ics-ledger-value">{Math.round(row.score * 100)}</span>
                    <span
                      className={`ics-ledger-contrib ${row.contribution > 0 ? 'is-up' : row.contribution < 0 ? 'is-down' : ''}`}
                    >
                      {row.contribution > 0 ? '+' : ''}
                      {row.contribution.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>

              {score.confidence !== null && score.confidence !== undefined && (
                <div className="ics-confidence">
                  <div className="ics-confidence-top">
                    <span>Confidence</span>
                    <strong>{Math.round(score.confidence * 100)}%</strong>
                  </div>
                  <div className="ics-bar">
                    <span style={{ width: `${Math.round(score.confidence * 100)}%` }} />
                  </div>
                  <span className="ics-confidence-note">
                    {score.confidence < (score.settingsSnapshot?.min_confidence ?? 0.3)
                      ? 'Limited evidence — the band is held at Review.'
                      : 'Evidence volume is sufficient for a band.'}
                  </span>
                </div>
              )}

              <p className="ics-explainer">{score.bandReason ?? score.model}</p>

              <div className="ics-actions">
                <button
                  className="icon-text-btn"
                  onClick={() => setHeatmapOpen((open) => !open)}
                  aria-expanded={heatmapOpen}
                >
                  {heatmapOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Typing
                  rhythm
                </button>
                <button className="icon-text-btn" onClick={onRecompute} disabled={busy}>
                  <RefreshCw size={12} /> {busy ? 'Recomputing…' : 'Recompute'}
                </button>
                <span className="ics-note">
                  Quality only: {Math.round(score.compilationTerm * 5)}% tests (not counted in
                  integrity).
                </span>
              </div>

              {heatmapOpen && <TypingHeatmap snapshots={snapshots} />}
            </>
          ) : (
            <>
              <p className="ics-explainer">
                Legacy v2 estimate — this submission predates authorship counters. Recompute after
                new activity to score it with the v3 evidence ledger.
              </p>

              <div className="ics-actions">
                <button
                  className="icon-text-btn"
                  onClick={() => setHeatmapOpen((open) => !open)}
                  aria-expanded={heatmapOpen}
                >
                  {heatmapOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Typing
                  rhythm
                </button>
                <button className="icon-text-btn" onClick={onRecompute} disabled={busy}>
                  <RefreshCw size={12} /> {busy ? 'Recomputing…' : 'Recompute'}
                </button>
                <span className="ics-note">
                  Quality only: {Math.round(score.compilationTerm * 5)}% tests (not counted in
                  integrity).
                </span>
              </div>

              {heatmapOpen && <TypingHeatmap snapshots={snapshots} />}

              {score.bandReason && <p className="ics-note">{score.bandReason}</p>}
            </>
          )}
        </>
      )}

      {error && <div className="grade-error">{error}</div>}
    </section>
  )
}
