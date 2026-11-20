import { useEffect, useState } from 'react'
import { fetchSubmissionRuns } from '../../lib/professorQueries'
import type { CodeRunEntry } from '../../types/professor'

interface RunHistoryProps {
  submissionId: string
  version: number
}

const formatRunTime = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export default function RunHistory({ submissionId, version }: RunHistoryProps): React.ReactElement {
  const [runs, setRuns] = useState<CodeRunEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchSubmissionRuns(submissionId)
      .then((items) => {
        if (!cancelled) {
          setRuns(items)
          setError(null)
        }
      })
      .catch((runError) => {
        if (!cancelled) {
          setRuns([])
          setError(
            runError instanceof Error ? runError.message : 'Could not load execution history.'
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [submissionId, version])

  const testRuns = runs?.filter((run) => run.testCaseOrdinal !== null) ?? []
  const latestByCase = new Map<number, CodeRunEntry>()
  for (const run of testRuns) {
    if (run.testCaseOrdinal !== null && !latestByCase.has(run.testCaseOrdinal)) {
      latestByCase.set(run.testCaseOrdinal, run)
    }
  }
  const passed = Array.from(latestByCase.values()).filter((run) => run.passed).length

  return (
    <section className="run-history">
      <header className="panel-head">
        <h3>Execution history</h3>
        {testRuns.length > 0 && (
          <span className="panel-meta">
            {passed}/{latestByCase.size} latest checks passed
          </span>
        )}
      </header>

      {error && <div className="grade-error">{error}</div>}
      {runs === null && !error && <p className="ics-note">Loading executions…</p>}
      {runs !== null && runs.length === 0 && !error && (
        <p className="ics-note">No Judge0 executions recorded for this submission yet.</p>
      )}

      <div className="run-history-list">
        {runs?.map((run) => (
          <article key={run.id} className="run-history-row">
            <span
              className={`run-history-dot ${
                run.passed === true ? 'is-pass' : run.passed === false ? 'is-fail' : ''
              }`}
            />
            <div className="run-history-copy">
              <span className="run-history-title">
                {run.testCaseOrdinal !== null ? `Case ${run.testCaseOrdinal + 1}` : 'Custom run'}
                <span className="run-history-status">{run.statusDescription}</span>
              </span>
              <span className="run-history-meta">
                {formatRunTime(run.createdAt)}
                {run.timeSeconds !== null ? ` · ${run.timeSeconds.toFixed(3)}s` : ''}
                {run.memoryKb !== null ? ` · ${run.memoryKb} KB` : ''}
              </span>
            </div>
            {run.passed !== null && (
              <span className={`run-history-result ${run.passed ? 'is-pass' : 'is-fail'}`}>
                {run.passed ? 'Pass' : 'Fail'}
              </span>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
