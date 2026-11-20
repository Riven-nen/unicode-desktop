import { useMemo } from 'react'
import { Award, BarChart3, Clock, Users } from 'lucide-react'
import { summarizeSubmissions } from '../../lib/analytics'
import type { SubmissionSummary } from '../../types/professor'

interface AssignmentAnalyticsProps {
  submissions: SubmissionSummary[]
  dueAt: string | null
  /** Enrolled students in the class, for the submitted ratio. */
  rosterCount: number
  loading: boolean
}

const BAND_ROWS = [
  { key: 'pass', label: 'Pass', className: 'is-pass' },
  { key: 'review', label: 'Review', className: 'is-review' },
  { key: 'flag', label: 'Flag', className: 'is-flag' },
  { key: 'unscored', label: 'Not scored', className: 'is-unscored' }
] as const

const formatOneDecimal = (value: number | null): string =>
  value === null ? '—' : String(Math.round(value * 10) / 10)

const formatIcs = (value: number | null): string =>
  value === null ? '—' : String(Math.round(value))

/**
 * Class-facing summary of one assignment: participation, lateness, averages,
 * and the ICS band split. Derived entirely from the loaded submission rows,
 * so it never costs another query.
 */
export default function AssignmentAnalytics({
  submissions,
  dueAt,
  rosterCount,
  loading
}: AssignmentAnalyticsProps): React.ReactElement {
  const stats = useMemo(() => summarizeSubmissions(submissions, dueAt), [submissions, dueAt])
  const denominator = Math.max(1, stats.studentsSubmitted)

  return (
    <section className="analytics-panel">
      <header className="analytics-head">
        <h3>
          <BarChart3 size={14} /> Assignment analytics
        </h3>
        <span>Latest submission per student</span>
      </header>

      {loading ? (
        <div className="professor-empty">Loading analytics…</div>
      ) : (
        <>
          <div className="analytics-tiles">
            <div className="analytics-tile">
              <span className="analytics-tile-icon is-submitted">
                <Users size={13} />
              </span>
              <span className="analytics-tile-copy">
                <strong>
                  {rosterCount > 0
                    ? `${stats.studentsSubmitted}/${rosterCount}`
                    : stats.studentsSubmitted}
                </strong>
                <span>Submitted</span>
              </span>
            </div>
            <div className="analytics-tile">
              <span className="analytics-tile-icon is-late">
                <Clock size={13} />
              </span>
              <span className="analytics-tile-copy">
                <strong>{stats.late}</strong>
                <span>Late</span>
              </span>
            </div>
            <div className="analytics-tile">
              <span className="analytics-tile-icon is-ics">
                <BarChart3 size={13} />
              </span>
              <span className="analytics-tile-copy">
                <strong>{formatIcs(stats.averageIcs)}</strong>
                <span>Avg ICS</span>
              </span>
            </div>
            <div className="analytics-tile">
              <span className="analytics-tile-icon is-grade">
                <Award size={13} />
              </span>
              <span className="analytics-tile-copy">
                <strong>{formatOneDecimal(stats.averageGrade)}</strong>
                <span>Avg grade</span>
              </span>
            </div>
          </div>

          <div className="analytics-bands">
            {BAND_ROWS.map((row) => {
              const count = stats.bands[row.key]
              return (
                <div key={row.key} className={`analytics-band ${row.className}`}>
                  <span className="analytics-band-label">{row.label}</span>
                  <span className="analytics-band-track">
                    <span style={{ width: `${Math.round((count / denominator) * 100)}%` }} />
                  </span>
                  <span className="analytics-band-count">{count}</span>
                </div>
              )
            })}
          </div>

          <p className="analytics-note">Averages use scored and graded submissions only.</p>
        </>
      )}
    </section>
  )
}
