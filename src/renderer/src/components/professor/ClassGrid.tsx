import { Activity, ArrowUpRight, BookOpen, Plus, Users } from 'lucide-react'
import type { ClassSummary } from '../../types/professor'

interface ClassGridProps {
  classes: ClassSummary[]
  loading: boolean
  error: string | null
  showArchived: boolean
  /** New student replies per class since the professor last opened it. */
  unreadReplies?: Record<string, number>
  /** New submissions per class since the professor last opened it. */
  unreadSubmissions?: Record<string, number>
  onToggleArchived: () => void
  onOpenLiveLab: () => void
  onSelect: (classId: string) => void
  onCreate: () => void
}

export default function ClassGrid({
  classes,
  loading,
  error,
  showArchived,
  unreadReplies = {},
  unreadSubmissions = {},
  onToggleArchived,
  onOpenLiveLab,
  onSelect,
  onCreate
}: ClassGridProps): React.ReactElement {
  const totalStudents = classes.reduce((total, klass) => total + klass.studentCount, 0)
  const totalAssignments = classes.reduce((total, klass) => total + klass.assignmentCount, 0)

  return (
    <section className="class-section">
      <header className="professor-section-head">
        <div>
          <h1>Your classes</h1>
          <p className="professor-sub">
            {classes.length > 0
              ? `${classes.length} ${classes.length === 1 ? 'class' : 'classes'} · ${totalStudents} students · ${totalAssignments} assignments`
              : 'Review submissions, integrity signals, and feedback.'}
          </p>
        </div>
        <div className="section-head-actions">
          <button className="icon-text-btn" onClick={onOpenLiveLab}>
            <Activity size={12} /> Live lab
          </button>
          <button className="icon-text-btn" onClick={onToggleArchived}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button className="btn-primary" onClick={onCreate}>
            <Plus size={13} /> New class
          </button>
        </div>
      </header>

      {loading && <div className="professor-empty">Loading classes…</div>}
      {error && <div className="professor-error">{error}</div>}
      {!loading && !error && classes.length === 0 && (
        <div className="professor-empty">No classes are assigned to this account yet.</div>
      )}

      <div className="class-grid">
        {classes.map((klass) => (
          <button
            key={klass.id}
            className="class-card"
            onClick={() => onSelect(klass.id)}
            aria-label={`Open ${klass.name}`}
          >
            <span className="class-card-watermark" aria-hidden="true">
              {klass.code}
            </span>
            <span className="class-card-top">
              <span className="class-code">{klass.code}</span>
              {klass.archivedAt && <span className="archived-badge">Archived</span>}
              <span className="class-card-arrow">
                <ArrowUpRight size={15} />
              </span>
            </span>
            <span className="class-name">{klass.name}</span>
            {(klass.yearSection || klass.academicYear) && (
              <span className="class-card-meta">
                {klass.yearSection && <span>{klass.yearSection}</span>}
                {klass.academicYear && <span>AY {klass.academicYear}</span>}
              </span>
            )}
            {(unreadSubmissions[klass.id] ?? 0) > 0 && (
              <span className="class-card-replies class-card-submissions">
                {unreadSubmissions[klass.id]} new{' '}
                {unreadSubmissions[klass.id] === 1 ? 'submission' : 'submissions'}
              </span>
            )}
            {(unreadReplies[klass.id] ?? 0) > 0 && (
              <span className="class-card-replies">
                {unreadReplies[klass.id]} new{' '}
                {unreadReplies[klass.id] === 1 ? 'student reply' : 'student replies'}
              </span>
            )}
            <span className="class-card-stats">
              <span className="class-card-stat">
                <Users size={12} />
                <strong>{klass.studentCount}</strong> students
              </span>
              <span className="class-card-stat-sep" aria-hidden="true" />
              <span className="class-card-stat">
                <BookOpen size={12} />
                <strong>{klass.assignmentCount}</strong> assignments
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
