import { ArrowRight, BookOpen, Plus, Users } from 'lucide-react'
import { initialsOf } from '../../lib/initials'
import type { ClassSummary } from '../../types/professor'

interface ClassGridProps {
  classes: ClassSummary[]
  loading: boolean
  error: string | null
  onSelect: (classId: string) => void
  onCreate: () => void
}

export default function ClassGrid({
  classes,
  loading,
  error,
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
        <button className="btn-primary" onClick={onCreate}>
          <Plus size={13} /> New class
        </button>
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
            <span className="class-card-wash" aria-hidden="true" />
            <span className="class-card-head">
              <span className="class-avatar">{initialsOf(klass.code.replace(/\s+/g, ''))}</span>
              <span className="class-code">{klass.code}</span>
              <span className="class-card-arrow">
                <ArrowRight size={15} />
              </span>
            </span>
            <span className="class-name">{klass.name}</span>
            <span className="class-metrics">
              <span className="class-metric">
                <Users size={12} />
                <strong>{klass.studentCount}</strong> students
              </span>
              <span className="class-metric">
                <BookOpen size={12} />
                <strong>{klass.assignmentCount}</strong> assignments
              </span>
            </span>
            <span className="class-card-foot">
              <span>Open class</span>
              <span className="class-card-line" aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
