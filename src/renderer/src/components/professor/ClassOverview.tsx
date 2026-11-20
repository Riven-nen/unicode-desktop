import { useState } from 'react'
import { ArrowUpRight, Plus, Users } from 'lucide-react'
import { initialsOf } from '../../lib/initials'
import type { AssignmentSummary, RosterStudent } from '../../types/professor'

interface ClassOverviewProps {
  assignments: AssignmentSummary[]
  assignmentsLoading: boolean
  assignmentError: string | null
  roster: RosterStudent[]
  rosterLoading: boolean
  rosterError: string | null
  showArchivedAssignments: boolean
  onToggleArchivedAssignments: () => void
  onSelectAssignment: (assignmentId: string) => void
  onSelectStudent: (studentId: string) => void
  onNewAssignment: () => void
  onManageStudents: () => void
}

const formatDue = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export default function ClassOverview({
  assignments,
  assignmentsLoading,
  assignmentError,
  roster,
  rosterLoading,
  rosterError,
  showArchivedAssignments,
  onToggleArchivedAssignments,
  onSelectAssignment,
  onSelectStudent,
  onNewAssignment,
  onManageStudents
}: ClassOverviewProps): React.ReactElement {
  // Captured once so the scheduled badge is stable during a render.
  const [now] = useState(() => Date.now())

  return (
    <div className="class-overview-grid">
      <section className="overview-panel">
        <header className="panel-head">
          <h3>
            Assignments <span className="panel-count">{assignments.length}</span>
          </h3>
          <div className="panel-head-actions">
            <button className="icon-text-btn" onClick={onToggleArchivedAssignments}>
              {showArchivedAssignments ? 'Hide archived' : 'Show archived'}
            </button>
            <button className="icon-text-btn" onClick={onNewAssignment}>
              <Plus size={12} /> New
            </button>
          </div>
        </header>

        {assignmentsLoading && <div className="professor-empty">Loading assignments…</div>}
        {assignmentError && <div className="professor-error">{assignmentError}</div>}
        {!assignmentsLoading && !assignmentError && assignments.length === 0 && (
          <div className="overview-empty">
            <p>No assignments yet. Create the first one for this class.</p>
            <button className="btn-secondary" onClick={onNewAssignment}>
              <Plus size={13} /> New assignment
            </button>
          </div>
        )}

        <div className="overview-assignment-grid">
          {assignments.map((assignment) => (
            <button
              key={assignment.id}
              className="overview-assignment-card"
              onClick={() => onSelectAssignment(assignment.id)}
              aria-label={`Open ${assignment.title}`}
            >
              <span className="overview-assignment-top">
                <span className="assignment-title">{assignment.title}</span>
                <span className="assignment-count">{assignment.testCaseCount}</span>
              </span>
              <span className="assignment-meta">
                <span className="assignment-lang">{assignment.language ?? 'plaintext'}</span>
                {!assignment.published && <span className="mini-badge">Draft</span>}
                {assignment.published &&
                  assignment.publishAt &&
                  new Date(assignment.publishAt).getTime() > now && (
                    <span className="mini-badge">Scheduled</span>
                  )}
                {assignment.archivedAt && <span className="mini-badge">Archived</span>}
                {assignment.dueAt && (
                  <span className="assignment-lang">Due {formatDue(assignment.dueAt)}</span>
                )}
                {assignment.hiddenCaseCount > 0 && (
                  <span className="assignment-hidden">{assignment.hiddenCaseCount} hidden</span>
                )}
              </span>
              <span className="overview-open">
                Open assignment <ArrowUpRight size={12} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="overview-panel overview-students">
        <header className="panel-head">
          <h3>
            Students <span className="panel-count">{roster.length}</span>
          </h3>
          <button className="icon-text-btn" onClick={onManageStudents}>
            <Users size={12} /> Manage
          </button>
        </header>

        {rosterLoading && <div className="professor-empty">Loading students…</div>}
        {rosterError && <div className="professor-error">{rosterError}</div>}
        {!rosterLoading && !rosterError && roster.length === 0 && (
          <div className="overview-empty">
            <p>No students enrolled yet.</p>
            <button className="btn-secondary" onClick={onManageStudents}>
              <Users size={13} /> Manage students
            </button>
          </div>
        )}

        <div className="overview-student-list">
          {roster.map((student) => (
            <button
              key={student.studentId}
              className="overview-student-row"
              onClick={() => onSelectStudent(student.studentId)}
              aria-label={`Open ${student.name}`}
            >
              <span className="roster-avatar">{initialsOf(student.name)}</span>
              <span className="roster-who">
                <span className="roster-name">{student.name}</span>
                <span className="roster-email">{student.email}</span>
              </span>
              <ArrowUpRight size={12} className="overview-student-arrow" />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
