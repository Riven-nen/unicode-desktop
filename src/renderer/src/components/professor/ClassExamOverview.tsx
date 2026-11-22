import { useEffect, useState } from 'react'
import { Activity, RefreshCw, ShieldAlert } from 'lucide-react'
import { fetchClassExamOverview } from '../../lib/examTemplates'
import type { ClassExamOverviewRow } from '../../lib/examTemplates'

interface ClassExamOverviewProps {
  classId: string
  /** Re-render when assignments/sessions change. */
  refreshSignal: number
}

export default function ClassExamOverview({
  classId,
  refreshSignal
}: ClassExamOverviewProps): React.ReactElement | null {
  const [rows, setRows] = useState<ClassExamOverviewRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    void fetchClassExamOverview(classId)
      .then((items) => {
        if (!cancelled) {
          setRows(items)
          setError(null)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Could not load exam analytics.'
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [classId, version, refreshSignal])

  if (error) {
    return <div className="professor-error">Exam overview: {error}</div>
  }
  if (rows === null) return null
  if (rows.length === 0) return null

  const totals = rows.reduce(
    (sum, row) => ({
      sessions: sum.sessions + row.sessions,
      active: sum.active + row.active,
      autoSubmitted: sum.autoSubmitted + row.autoSubmitted,
      interruptions: sum.interruptions + row.interruptions,
      blockedPastes: sum.blockedPastes + row.blockedPastes,
      overrides: sum.overrides + row.overrides
    }),
    { sessions: 0, active: 0, autoSubmitted: 0, interruptions: 0, blockedPastes: 0, overrides: 0 }
  )

  return (
    <section className="class-exam-overview">
      <header className="class-exam-overview-head">
        <h3>
          <Activity size={13} /> Exam overview
        </h3>
        <button
          className="icon-text-btn"
          onClick={() => setVersion((current) => current + 1)}
          title="Refresh exam overview"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </header>
      <div className="class-exam-totals">
        <span>{totals.sessions} attempts</span>
        <span>{totals.active} active</span>
        <span>{totals.autoSubmitted} auto-submitted</span>
        <span>{totals.interruptions} interruptions</span>
        <span>{totals.blockedPastes} blocked pastes</span>
        <span>{totals.overrides} overrides</span>
      </div>
      <div className="class-exam-rows">
        {rows.map((row) => (
          <div key={row.assignmentId} className="class-exam-row">
            <span className="class-exam-title">
              <ShieldAlert size={11} /> {row.title}
            </span>
            <span>{row.sessions} attempts</span>
            <span>{row.active} active</span>
            <span>{row.autoSubmitted} auto</span>
            <span>{row.interruptions} interruptions</span>
            <span>{row.blockedPastes} blocked</span>
            <span>{row.overrides} overrides</span>
          </div>
        ))}
      </div>
    </section>
  )
}
