import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  RefreshCw,
  TimerReset,
  Users
} from 'lucide-react'
import { applyAssessmentOverride, fetchAssessmentSessions } from '../../lib/assessments'
import { initialsOf } from '../../lib/initials'
import { sessionStatusLabel, type AssessmentSessionSummary } from '../../types/assessment'
import AssessmentEventLog from './AssessmentEventLog'
import AssessmentOverrideModal from './AssessmentOverrideModal'
import OverrideCodeModal from './OverrideCodeModal'

interface AssessmentMonitorProps {
  assignmentId: string
  /** Enrolled students, used to show who has not started yet. */
  rosterCount: number
  /** Bumped by Realtime so the monitor reloads without waiting for the poll. */
  refreshSignal: number
  onOpenSubmission: (submissionId: string) => void
}

const formatMoment = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—'

const formatRemaining = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number): string => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export default function AssessmentMonitor({
  assignmentId,
  rosterCount,
  refreshSignal,
  onOpenSubmission
}: AssessmentMonitorProps): React.ReactElement {
  const [items, setItems] = useState<AssessmentSessionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [overrideBusy, setOverrideBusy] = useState<string | null>(null)
  const [overrideSession, setOverrideSession] = useState<AssessmentSessionSummary | null>(null)
  const [eventSession, setEventSession] = useState<AssessmentSessionSummary | null>(null)
  const [codeSession, setCodeSession] = useState<AssessmentSessionSummary | null>(null)
  const [version, setVersion] = useState(0)
  const [clock, setClock] = useState(() => Date.now())
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [interruptionsOnly, setInterruptionsOnly] = useState(false)
  const [overridesOnly, setOverridesOnly] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchAssessmentSessions(assignmentId)
      .then((sessions) => {
        if (cancelled) return
        setItems(sessions)
        setError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(
          loadError instanceof Error ? loadError.message : 'Could not load assessment sessions.'
        )
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false)
      })
    return () => {
      cancelled = true
    }
  }, [assignmentId, version, refreshSignal])

  // The monitor is live-ish: expiry runs on every fetch, and the refresh keeps
  // last-saved times current without hammering the database.
  useEffect(() => {
    const timer = window.setInterval(() => setVersion((current) => current + 1), 15_000)
    return () => window.clearInterval(timer)
  }, [assignmentId])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const sessions = items ?? []
  const activeCount = sessions.filter((session) => session.status === 'active').length
  const submittedCount = sessions.filter(
    (session) => session.status === 'submitted' || session.status === 'auto_submitted'
  ).length
  const distinctStudents = new Set(sessions.map((session) => session.studentId)).size
  const notStarted = Math.max(0, rosterCount - distinctStudents)
  const visibleSessions = sessions.filter((session) => {
    if (statusFilter !== 'all' && session.status !== statusFilter) return false
    const query = search.trim().toLowerCase()
    if (
      query &&
      !session.studentName.toLowerCase().includes(query) &&
      !session.studentEmail.toLowerCase().includes(query)
    ) {
      return false
    }
    if (interruptionsOnly && session.interruptionCount === 0) return false
    if (overridesOnly && !session.overrideNote && session.reopenCount === 0) return false
    return true
  })

  const applyOverride = async (
    sessionId: string,
    action: 'extend_time' | 'excuse_interruption'
  ): Promise<void> => {
    setOverrideBusy(sessionId)
    try {
      await applyAssessmentOverride({
        sessionId,
        action,
        minutes: action === 'extend_time' ? 5 : undefined,
        reason:
          action === 'extend_time'
            ? 'Professor extended time from the session monitor.'
            : 'Professor excused interruptions from the session monitor.'
      })
      setVersion((current) => current + 1)
      setError(null)
    } catch (overrideError) {
      setError(
        overrideError instanceof Error ? overrideError.message : 'Could not apply the override.'
      )
    } finally {
      setOverrideBusy(null)
    }
  }

  return (
    <section className="assessment-monitor">
      <header className="assessment-monitor-head">
        <div>
          <h3>
            <Clock size={14} /> Session monitor
          </h3>
          <p>Deadlines are server-owned. Auto-submit runs when the deadline passes.</p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            setRefreshing(true)
            setVersion((current) => current + 1)
          }}
          disabled={refreshing}
        >
          <RefreshCw size={13} className={refreshing ? 'is-spinning' : undefined} />{' '}
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="assessment-monitor-stats">
        <span className="assessment-stat is-active">
          <PlayCircle size={13} /> {activeCount} in progress
        </span>
        <span className="assessment-stat is-done">
          <CheckCircle2 size={13} /> {submittedCount} submitted
        </span>
        <span className="assessment-stat">
          <Users size={13} /> {notStarted} not started
        </span>
      </div>

      <div className="assessment-monitor-filters">
        <input
          value={search}
          placeholder="Search student…"
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">In progress</option>
          <option value="submitted">Submitted</option>
          <option value="auto_submitted">Auto-submitted</option>
        </select>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={interruptionsOnly}
            onChange={(event) => setInterruptionsOnly(event.target.checked)}
          />
          <span>Interruptions</span>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={overridesOnly}
            onChange={(event) => setOverridesOnly(event.target.checked)}
          />
          <span>Overrides</span>
        </label>
      </div>

      {error && <div className="professor-error">{error}</div>}
      {!error && items === null && (
        <div className="professor-empty">Loading assessment sessions…</div>
      )}
      {!error && items !== null && sessions.length === 0 && (
        <div className="professor-empty">No student has started this assessment yet.</div>
      )}

      {sessions.length > 0 && visibleSessions.length === 0 && (
        <div className="professor-empty">No sessions match these filters.</div>
      )}

      {visibleSessions.length > 0 && (
        <div className="assessment-monitor-table-wrap">
          <table className="assessment-monitor-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Attempt</th>
                <th>Status</th>
                <th>Started</th>
                <th>Deadline</th>
                <th>Last saved</th>
                <th>Draft</th>
                <th>Interruptions</th>
                <th>Exam events</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleSessions.map((session) => {
                const deadline = session.expiresAt ? Date.parse(session.expiresAt) : null
                const remaining =
                  deadline !== null ? deadline - (clock + session.serverOffsetMs) : null
                const running = session.status === 'active'
                const expired = running && remaining !== null && remaining <= 0
                return (
                  <tr key={session.sessionId}>
                    <td>
                      <span className="assessment-student">
                        <span className="roster-avatar">{initialsOf(session.studentName)}</span>
                        <span>
                          <strong>{session.studentName}</strong>
                          <span>{session.studentEmail}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      {session.attemptNumber}/{session.maxAttempts}
                      {session.reopenCount > 0 && (
                        <span className="assessment-muted"> · reopens {session.reopenCount}</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`assessment-status is-${session.status}${
                          expired ? ' is-expired' : ''
                        }`}
                      >
                        {expired ? 'Finalizing' : sessionStatusLabel(session.status)}
                      </span>
                    </td>
                    <td>{formatMoment(session.startedAt)}</td>
                    <td>
                      {session.expiresAt ? formatMoment(session.expiresAt) : '—'}
                      {running && remaining !== null && (
                        <span className={`assessment-remaining ${expired ? 'is-expired' : ''}`}>
                          {expired ? 'Time is up' : `${formatRemaining(remaining)} left`}
                        </span>
                      )}
                    </td>
                    <td>{formatMoment(session.lastSavedAt)}</td>
                    <td>rev {session.draftRevision}</td>
                    <td>
                      {session.examMode ? (
                        <span
                          className={`assessment-interruptions ${
                            session.interruptionCount > session.allowedTabOuts ? 'is-over' : ''
                          }`}
                        >
                          {session.interruptionCount}/{session.allowedTabOuts}
                        </span>
                      ) : (
                        <span className="assessment-muted">—</span>
                      )}
                    </td>
                    <td>
                      {session.examMode ? (
                        <span className="assessment-event-list">
                          <span title="Tab-outs">Tab {session.tabOutCount}</span>
                          <span title="Fullscreen exits">Full {session.fullscreenExitCount}</span>
                          <span title="Blocked pastes">Paste {session.blockedPasteCount}</span>
                        </span>
                      ) : (
                        <span className="assessment-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="assessment-row-actions">
                        {session.finalSubmissionId ? (
                          <button
                            className="icon-text-btn"
                            onClick={() => onOpenSubmission(session.finalSubmissionId as string)}
                          >
                            Review
                          </button>
                        ) : expired ? (
                          <span className="assessment-pending">
                            <AlertTriangle size={12} /> Pending
                          </span>
                        ) : null}
                        {session.examMode && (
                          <button
                            className="icon-text-btn"
                            onClick={() => setEventSession(session)}
                            title="Show the exam event timeline"
                          >
                            Events
                          </button>
                        )}
                        {running && session.examMode && (
                          <button
                            className="icon-text-btn"
                            disabled={overrideBusy === session.sessionId}
                            onClick={() => void applyOverride(session.sessionId, 'extend_time')}
                            title="Extend this session by 5 minutes"
                          >
                            <TimerReset size={11} /> +5m
                          </button>
                        )}
                        {session.examMode && (
                          <button
                            className="icon-text-btn"
                            onClick={() => setOverrideSession(session)}
                            title="Custom override or reopen"
                          >
                            Override
                          </button>
                        )}
                        {session.examMode && (
                          <button
                            className="icon-text-btn"
                            onClick={() => setCodeSession(session)}
                            title="Generate a one-time student code"
                          >
                            Code
                          </button>
                        )}
                      </span>
                      {session.overrideNote && (
                        <span className="assessment-override-note" title={session.overrideNote}>
                          Override
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {overrideSession && (
        <AssessmentOverrideModal
          session={overrideSession}
          onClose={() => setOverrideSession(null)}
          onApplied={() => {
            setOverrideSession(null)
            setVersion((current) => current + 1)
          }}
        />
      )}

      {eventSession && (
        <AssessmentEventLog session={eventSession} onClose={() => setEventSession(null)} />
      )}

      {codeSession && (
        <OverrideCodeModal session={codeSession} onClose={() => setCodeSession(null)} />
      )}
    </section>
  )
}
