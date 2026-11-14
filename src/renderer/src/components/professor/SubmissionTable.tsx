import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, ClipboardPaste, MessageSquare } from 'lucide-react'
import BandBadge from './BandBadge'
import { initialsOf } from '../../lib/initials'
import type { IcsBand, SubmissionSummary } from '../../types/professor'

type SortKey = 'ics' | 'submittedAt'
type BandFilter = 'all' | IcsBand

interface SubmissionTableProps {
  submissions: SubmissionSummary[]
  loading: boolean
  error: string | null
  onSelect: (submissionId: string) => void
}

const BAND_FILTERS: Array<{ key: BandFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pass', label: 'Pass' },
  { key: 'review', label: 'Review' },
  { key: 'flag', label: 'Flag' }
]

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export default function SubmissionTable({
  submissions,
  loading,
  error,
  onSelect
}: SubmissionTableProps): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>('ics')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [bandFilter, setBandFilter] = useState<BandFilter>('all')

  const rows = useMemo(() => {
    const filtered = submissions.filter(
      (submission) => bandFilter === 'all' || submission.band === bandFilter
    )
    return [...filtered].sort((a, b) => {
      const left =
        sortKey === 'ics' ? (a.ics ?? Number.NEGATIVE_INFINITY) : Date.parse(a.submittedAt)
      const right =
        sortKey === 'ics' ? (b.ics ?? Number.NEGATIVE_INFINITY) : Date.parse(b.submittedAt)
      return sortDir === 'asc' ? left - right : right - left
    })
  }, [submissions, bandFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'ics' ? 'desc' : 'asc')
  }

  const sortIcon = (key: SortKey): React.ReactNode =>
    sortKey === key ? sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null

  return (
    <section className="submissions-section">
      <header className="submissions-head">
        <div>
          <h2>Submissions</h2>
          <p className="professor-sub">
            {submissions.length} submission{submissions.length === 1 ? '' : 's'} · sorted by{' '}
            {sortKey === 'ics' ? 'ICS' : 'submitted time'}
          </p>
        </div>
        <div className="band-filter" role="group" aria-label="Filter by integrity band">
          {BAND_FILTERS.map((filter) => (
            <button
              key={filter.key}
              className={`band-filter-btn ${bandFilter === filter.key ? 'active' : ''}`}
              onClick={() => setBandFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>

      {loading && <div className="professor-empty">Loading submissions…</div>}
      {error && <div className="professor-error">{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="professor-empty">No submissions match this view.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="submission-table-wrap">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>
                  <button className="table-sort" onClick={() => toggleSort('submittedAt')}>
                    Submitted {sortIcon('submittedAt')}
                  </button>
                </th>
                <th>
                  <button className="table-sort" onClick={() => toggleSort('ics')}>
                    ICS {sortIcon('ics')}
                  </button>
                </th>
                <th>Band</th>
                <th>Pastes</th>
                <th>Comments</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {rows.map((submission) => (
                <tr
                  key={submission.id}
                  className={`submission-row ${
                    submission.band ? `band-row-${submission.band}` : ''
                  }`}
                  tabIndex={0}
                  onClick={() => onSelect(submission.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(submission.id)
                    }
                  }}
                >
                  <td>
                    <div className="student-cell">
                      <span className="student-avatar">{initialsOf(submission.studentName)}</span>
                      <span className="student-who">
                        <span className="student-name">{submission.studentName}</span>
                        <span className="student-email">{submission.studentEmail}</span>
                      </span>
                    </div>
                  </td>
                  <td className="mono-cell">{formatDateTime(submission.submittedAt)}</td>
                  <td>
                    {submission.ics === null ? (
                      <span className="cell-muted">—</span>
                    ) : (
                      <div className="ics-cell">
                        <span className="ics-cell-value">{submission.ics.toFixed(1)}</span>
                        <span className="ics-cell-bar">
                          <i
                            style={{
                              width: `${Math.max(0, Math.min(100, submission.ics))}%`
                            }}
                          />
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    <BandBadge band={submission.band} />
                  </td>
                  <td>
                    <span className={`count-chip ${submission.pasteCount > 0 ? 'has-count' : ''}`}>
                      <ClipboardPaste size={11} /> {submission.pasteCount}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`count-chip ${submission.commentCount > 0 ? 'has-count' : ''}`}
                    >
                      <MessageSquare size={11} /> {submission.commentCount}
                    </span>
                  </td>
                  <td className="row-arrow" aria-hidden="true">
                    <ChevronRight size={14} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
