import { useEffect, useState } from 'react'
import { CalendarClock, PlayCircle, Timer, X } from 'lucide-react'
import { formatCountdown, timingSummary } from '../lib/assessmentTime'
import type { StudentAssignment } from '../types/student'

interface SeatworkCountdownModalProps {
  assignment: StudentAssignment
  starting: boolean
  onClose: () => void
  onStart: (assignment: StudentAssignment) => void
}

const formatMoment = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

export default function SeatworkCountdownModal({
  assignment,
  starting,
  onClose,
  onStart
}: SeatworkCountdownModalProps): React.ReactElement {
  const [now, setNow] = useState(() => Date.now())
  const [openedAt] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const parsedOpensAt = assignment.opensAt ? Date.parse(assignment.opensAt) : null
  const parsedClosesAt = assignment.closesAt ? Date.parse(assignment.closesAt) : null
  const opensAtMs = parsedOpensAt !== null && Number.isFinite(parsedOpensAt) ? parsedOpensAt : null
  const closesAtMs =
    parsedClosesAt !== null && Number.isFinite(parsedClosesAt) ? parsedClosesAt : null
  const remaining = opensAtMs === null ? null : opensAtMs - now
  const closed = closesAtMs !== null && closesAtMs <= now
  const ready = !closed && remaining !== null && remaining <= 0

  const totalWait = opensAtMs === null ? 1 : Math.max(opensAtMs - openedAt, 1)
  const progress =
    opensAtMs === null || remaining === null
      ? 1
      : Math.min(1, Math.max(0, (now - openedAt) / totalWait))

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-modal glass-panel seatwork-countdown-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="auth-header">
          <span className="auth-title">
            <Timer size={15} /> {assignment.title}
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>

        <p className="auth-sub">{timingSummary(assignment)}</p>

        <div
          className={`seatwork-countdown-body ${closed ? 'is-closed' : ready ? 'is-ready' : ''}`}
        >
          <span className="seatwork-countdown-kicker">
            {closed ? 'Closed' : ready ? 'Opening now' : 'Starts in'}
          </span>
          <strong className="seatwork-countdown-value" aria-live="polite">
            {closed ? '—' : remaining === null ? 'Soon' : formatCountdown(Math.max(remaining, 0))}
          </strong>
          <span className="seatwork-countdown-opens">
            <CalendarClock size={12} />
            {assignment.opensAt ? formatMoment(assignment.opensAt) : 'Scheduled start'}
          </span>
          <div className="seatwork-countdown-track" aria-hidden="true">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="seatwork-countdown-note">
            {closed
              ? 'This seatwork has closed.'
              : ready
                ? 'The window is open. Start when you are ready; the server starts the timer.'
                : 'Keep this window open. The button unlocks when the countdown reaches zero.'}
          </p>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={starting}>
            Close
          </button>
          <button
            className="btn-primary"
            onClick={() => onStart(assignment)}
            disabled={!ready || starting}
          >
            <PlayCircle size={12} />{' '}
            {starting ? 'Starting…' : ready ? 'Start seatwork' : 'Waiting…'}
          </button>
        </div>
      </div>
    </div>
  )
}
