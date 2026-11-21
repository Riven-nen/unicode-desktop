import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { fetchAssessmentEvents } from '../../lib/assessments'
import { downloadCsv } from '../../lib/csv'
import type { AssessmentEventEntry, AssessmentSessionSummary } from '../../types/assessment'

interface AssessmentEventLogProps {
  session: AssessmentSessionSummary
  onClose: () => void
}

const eventLabel = (type: AssessmentEventEntry['eventType']): string => {
  switch (type) {
    case 'tab_out':
      return 'Tab-out / window blur'
    case 'fullscreen_exit':
      return 'Fullscreen exit'
    case 'paste_blocked':
      return 'Paste blocked'
    case 'warning':
      return 'Warning shown'
    case 'focus_return':
      return 'Focus returned'
    case 'override':
      return 'Professor override'
    case 'auto_submit':
      return 'Auto-submitted'
  }
}

const formatMoment = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

export default function AssessmentEventLog({
  session,
  onClose
}: AssessmentEventLogProps): React.ReactElement {
  const [events, setEvents] = useState<AssessmentEventEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetchAssessmentEvents(session.sessionId)
      .then((items) => {
        if (cancelled) return
        setEvents(items)
        setError(null)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load events.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.sessionId, version])

  const exportCsv = (): void => {
    const rows = (events ?? []).map((event) => [
      event.occurredAt,
      session.studentName,
      session.studentEmail,
      eventLabel(event.eventType),
      JSON.stringify(event.metadata)
    ])
    downloadCsv(`assessment-events-${session.studentName.replace(/\s+/g, '-')}`, [
      ['Occurred at', 'Student', 'Email', 'Event', 'Metadata'],
      ...rows
    ])
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-modal glass-panel assessment-event-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="auth-header">
          <span className="auth-title">Exam events · {session.studentName}</span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>
        <p className="auth-sub">
          Server-recorded interruptions, blocked paste attempts, overrides, and auto-submits.
        </p>

        <div className="assessment-event-toolbar">
          <button
            className="btn-secondary"
            onClick={() => {
              setLoading(true)
              setVersion((current) => current + 1)
            }}
            disabled={loading}
          >
            <RefreshCw size={12} /> {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="btn-secondary" onClick={exportCsv} disabled={!events?.length}>
            <Download size={12} /> Export CSV
          </button>
        </div>

        {error && <div className="professor-error">{error}</div>}
        {!error && events !== null && events.length === 0 && (
          <div className="professor-empty">No exam events recorded.</div>
        )}

        <ol className="assessment-event-timeline">
          {(events ?? []).map((event) => (
            <li key={event.id} className={`assessment-event is-${event.eventType}`}>
              <span className="assessment-event-dot" />
              <div>
                <strong>{eventLabel(event.eventType)}</strong>
                <time>{formatMoment(event.occurredAt)}</time>
                {Object.keys(event.metadata).length > 0 && (
                  <code>{JSON.stringify(event.metadata)}</code>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
