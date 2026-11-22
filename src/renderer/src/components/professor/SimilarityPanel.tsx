import { useEffect, useMemo, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { fetchSubmissionContents } from '../../lib/professorQueries'
import { findSimilarPairs } from '../../lib/similarity'
import type { SimilarityEntry } from '../../lib/similarity'

interface SimilarityPanelProps {
  assignmentId: string
  onOpenSubmission: (submissionId: string) => void
}

const THRESHOLDS = [0.6, 0.75, 0.9] as const

const scoreClass = (score: number): string => {
  if (score >= 0.9) return 'is-flag'
  if (score >= 0.75) return 'is-warn'
  return 'is-review'
}

/**
 * Compares the final snapshot of every student's latest submission. Loaded on
 * demand per assignment; the token comparison runs locally in the renderer.
 */
export default function SimilarityPanel({
  assignmentId,
  onOpenSubmission
}: SimilarityPanelProps): React.ReactElement {
  const [entries, setEntries] = useState<SimilarityEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState<number>(0.6)
  const [version, setVersion] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchSubmissionContents(assignmentId)
      .then((rows) => {
        if (!cancelled) {
          setEntries(rows)
          setError(null)
        }
      })
      .catch((loadError) => {
        if (cancelled) return
        setEntries([])
        setError(loadError instanceof Error ? loadError.message : 'Could not compare submissions.')
      })
      .finally(() => {
        if (!cancelled) setRunning(false)
      })
    return () => {
      cancelled = true
    }
  }, [assignmentId, version])

  const pairs = useMemo(
    () => (entries ? findSimilarPairs(entries, threshold) : []),
    [entries, threshold]
  )
  const busy = running || entries === null

  return (
    <section className="similarity-panel">
      <header className="similarity-head">
        <h3>
          <Copy size={14} /> Cross-student similarity
        </h3>
        <div className="similarity-controls">
          <label className="similarity-threshold">
            Threshold
            <select
              value={String(threshold)}
              onChange={(event) => setThreshold(Number(event.target.value))}
            >
              {THRESHOLDS.map((value) => (
                <option key={value} value={value}>
                  {Math.round(value * 100)}%
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn-secondary"
            onClick={() => {
              setRunning(true)
              setVersion((current) => current + 1)
            }}
            disabled={busy}
            title="Compare the final snapshot of every student's latest submission"
          >
            <RefreshCw size={12} className={busy ? 'is-spinning' : undefined} />{' '}
            {busy ? 'Comparing…' : 'Run similarity'}
          </button>
        </div>
      </header>

      {error && <div className="professor-error">{error}</div>}
      {entries === null && !error && (
        <div className="professor-empty">Comparing final snapshots…</div>
      )}
      {entries !== null && entries.length < 2 && !error && (
        <div className="professor-empty">At least two submissions are needed to compare work.</div>
      )}
      {entries !== null && entries.length >= 2 && pairs.length === 0 && !error && (
        <div className="professor-empty">
          No pairs above {Math.round(threshold * 100)}% shared token sequences.
        </div>
      )}

      {pairs.length > 0 && (
        <div className="similarity-list">
          {pairs.slice(0, 6).map((pair) => (
            <div className="similarity-row" key={`${pair.a.submissionId}:${pair.b.submissionId}`}>
              <div className="similarity-row-head">
                <span className="similarity-pair">
                  {pair.a.studentName} ↔ {pair.b.studentName}
                </span>
                <span className={`similarity-score ${scoreClass(pair.score)}`}>
                  {Math.round(pair.score * 100)}%
                </span>
              </div>
              <div className="similarity-track">
                <span
                  className={scoreClass(pair.score)}
                  style={{ width: `${Math.round(pair.score * 100)}%` }}
                />
              </div>
              <div className="similarity-row-foot">
                <span>
                  {pair.a.studentName} · {pair.b.studentName}
                </span>
                <button
                  className="icon-text-btn"
                  onClick={() => onOpenSubmission(pair.a.submissionId)}
                >
                  Inspect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="similarity-note">
        Final snapshot of each student’s latest submission · shared 6-token sequences.
      </p>
    </section>
  )
}
