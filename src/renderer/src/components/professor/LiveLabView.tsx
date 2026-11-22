import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, AlertTriangle, ChevronLeft, RefreshCw, WifiOff } from 'lucide-react'
import { fetchLiveLabStatus } from '../../lib/professorQueries'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import type { LiveLabStatus, LiveLabStudent } from '../../types/professor'

interface LiveLabViewProps {
  session: Session
  onBack: () => void
}

const LIVE_LAB_TABLES = ['student_presence'] as const
const OFFLINE_AFTER_MS = 90_000

const STATUS_LABEL: Record<LiveLabStatus, string> = {
  active: 'Active',
  idle: 'Idle',
  flagged: 'Flagged',
  offline: 'Offline'
}

const STATUS_ORDER: Record<LiveLabStatus, number> = {
  active: 0,
  flagged: 1,
  idle: 2,
  offline: 3
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  if (minutes < 60) return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

const formatSeen = (iso: string, now: number): string => {
  const age = now - (Date.parse(iso) || 0)
  if (age < 10_000) return 'just now'
  if (age < 60_000) return `${Math.round(age / 1000)}s ago`
  if (age < 3_600_000) return `${Math.round(age / 60_000)}m ago`
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function LiveLabView({ session, onBack }: LiveLabViewProps): React.ReactElement {
  const [rows, setRows] = useState<LiveLabStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback((): void => {
    setVersion((current) => current + 1)
  }, [])

  useRealtimeRefresh(session, LIVE_LAB_TABLES, load)

  useEffect(() => {
    let cancelled = false
    void fetchLiveLabStatus()
      .then((students) => {
        if (cancelled) return
        setRows(students)
        setError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load Live Lab.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [version])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const students = useMemo(
    () =>
      rows
        .map((student) => {
          const age = now - (Date.parse(student.lastSeenAt) || 0)
          const status: LiveLabStatus = age > OFFLINE_AFTER_MS ? 'offline' : student.storedStatus
          return { ...student, status }
        })
        .sort(
          (a, b) =>
            STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
            Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt)
        ),
    [rows, now]
  )

  const counts = useMemo(
    () => ({
      active: students.filter((student) => student.status === 'active').length,
      flagged: students.filter((student) => student.status === 'flagged').length,
      idle: students.filter((student) => student.status === 'idle').length,
      offline: students.filter((student) => student.status === 'offline').length
    }),
    [students]
  )

  return (
    <div className="live-lab">
      <header className="live-lab-head">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={14} /> Dashboard
        </button>
        <div className="live-lab-copy">
          <span className="class-hero-code">
            <Activity size={12} /> Live Lab
          </span>
          <h1>Who is writing right now</h1>
          <p className="professor-sub">
            Heartbeats arrive every 30 seconds. A green dot is active, red is idle, yellow means a
            recent paste, and grey is offline.
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            setRefreshing(true)
            load()
          }}
          disabled={refreshing}
        >
          <RefreshCw size={13} className={refreshing ? 'is-spinning' : undefined} />{' '}
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section className="live-lab-summary">
        <span className="live-summary is-active">{counts.active} active</span>
        <span className="live-summary is-idle">{counts.idle} idle</span>
        <span className="live-summary is-flagged">{counts.flagged} flagged</span>
        <span className="live-summary is-offline">{counts.offline} offline</span>
      </section>

      {error && <div className="professor-error">{error}</div>}
      {loading && rows.length === 0 && (
        <div className="professor-empty">Loading student activity…</div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="live-lab-empty">
          <WifiOff size={20} />
          <h2>No student heartbeats yet</h2>
          <p>Ask a student to sign in and open the workspace. Their status appears here.</p>
        </div>
      )}

      {students.length > 0 && (
        <section className="live-lab-grid">
          {students.map((student) => (
            <article key={student.studentId} className={`live-card is-${student.status}`}>
              <header>
                <span className={`live-dot is-${student.status}`} />
                <span className="live-name">
                  <strong>{student.name}</strong>
                  <span className="live-email">{student.email}</span>
                </span>
                <span className={`live-status is-${student.status}`}>
                  {student.status === 'flagged' && <AlertTriangle size={10} />}
                  {STATUS_LABEL[student.status]}
                </span>
              </header>

              <p className="live-file">
                {student.currentFile ? (
                  <code>{student.currentFile}</code>
                ) : (
                  <span className="cell-muted">No file open</span>
                )}
              </p>

              <footer>
                <span>
                  {student.status === 'offline'
                    ? `Last seen ${formatSeen(student.lastSeenAt, now)}`
                    : student.status === 'idle'
                      ? `Idle for ${formatDuration(student.idleSeconds)}`
                      : student.status === 'flagged'
                        ? 'Recent paste activity'
                        : 'Typing now'}
                </span>
                <span className="cell-muted">Seen {formatSeen(student.lastSeenAt, now)}</span>
              </footer>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
