import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ChevronLeft,
  BookOpen,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Users
} from 'lucide-react'
import { initialsOf } from '../../lib/initials'
import AppearancePanel from '../AppearancePanel'
import TitleBarControls from '../TitleBarControls'
import AssignmentModal from './AssignmentModal'
import ClassGrid from './ClassGrid'
import ClassModal from './ClassModal'
import RosterModal from './RosterModal'
import SubmissionDetail from './SubmissionDetail'
import SubmissionTable from './SubmissionTable'
import TestCaseModal from './TestCaseModal'
import {
  fetchAssignments,
  fetchClasses,
  fetchRoster,
  fetchSubmissionDetail,
  fetchSubmissions
} from '../../lib/professorQueries'
import type {
  AssignmentSummary,
  ClassSummary,
  RosterStudent,
  SubmissionDetailData,
  SubmissionSummary
} from '../../types/professor'

interface ProfessorDashboardProps {
  session: Session
  onSignOut: () => void
}

interface ClassState {
  userId: string
  items: ClassSummary[]
  error: string | null
}

interface AssignmentState {
  classId: string
  items: AssignmentSummary[]
  error: string | null
}

interface SubmissionState {
  assignmentId: string
  items: SubmissionSummary[]
  error: string | null
}

interface DetailState {
  submissionId: string
  item: SubmissionDetailData | null
  error: string | null
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong.'

export default function ProfessorDashboard({
  session,
  onSignOut
}: ProfessorDashboardProps): React.ReactElement {
  const userId = session.user.id

  const [classes, setClasses] = useState<ClassState | null>(null)
  const [classVersion, setClassVersion] = useState(0)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)

  const [assignments, setAssignments] = useState<AssignmentState | null>(null)
  const [assignmentVersion, setAssignmentVersion] = useState(0)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)

  const [classRoster, setClassRoster] = useState<{
    classId: string
    items: RosterStudent[]
    error: string | null
  } | null>(null)
  const [rosterVersion, setRosterVersion] = useState(0)

  const [submissions, setSubmissions] = useState<SubmissionState | null>(null)
  const [submissionVersion, setSubmissionVersion] = useState(0)

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [detailVersion, setDetailVersion] = useState(0)

  // Professor CRUD modals.
  const [classModal, setClassModal] = useState<{ initial: ClassSummary | null } | null>(null)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [assignmentModal, setAssignmentModal] = useState<{
    initial: AssignmentSummary | null
  } | null>(null)
  const [testsOpen, setTestsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchClasses(userId)
      .then((items) => {
        if (!cancelled) setClasses({ userId, items, error: null })
      })
      .catch((error) => {
        if (!cancelled) setClasses({ userId, items: [], error: messageOf(error) })
      })
    return () => {
      cancelled = true
    }
  }, [userId, classVersion])

  useEffect(() => {
    if (!selectedClassId) return
    let cancelled = false
    void fetchAssignments(selectedClassId)
      .then((items) => {
        if (cancelled) return
        setAssignments({ classId: selectedClassId, items, error: null })
        setSelectedAssignmentId((current) =>
          items.some((item) => item.id === current) ? current : (items[0]?.id ?? null)
        )
      })
      .catch((error) => {
        if (!cancelled) {
          setAssignments({ classId: selectedClassId, items: [], error: messageOf(error) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedClassId, assignmentVersion])

  useEffect(() => {
    if (!selectedClassId) return
    let cancelled = false
    void fetchRoster(selectedClassId)
      .then((items) => {
        if (!cancelled) setClassRoster({ classId: selectedClassId, items, error: null })
      })
      .catch((error) => {
        if (!cancelled) {
          setClassRoster({ classId: selectedClassId, items: [], error: messageOf(error) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedClassId, rosterVersion])

  useEffect(() => {
    if (!selectedAssignmentId) return
    let cancelled = false
    void fetchSubmissions(selectedAssignmentId)
      .then((items) => {
        if (!cancelled) {
          setSubmissions({ assignmentId: selectedAssignmentId, items, error: null })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSubmissions({ assignmentId: selectedAssignmentId, items: [], error: messageOf(error) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedAssignmentId, submissionVersion])

  useEffect(() => {
    if (!selectedSubmissionId) return
    let cancelled = false
    void fetchSubmissionDetail(selectedSubmissionId)
      .then((item) => {
        if (!cancelled) setDetail({ submissionId: selectedSubmissionId, item, error: null })
      })
      .catch((error) => {
        if (!cancelled) {
          setDetail({ submissionId: selectedSubmissionId, item: null, error: messageOf(error) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedSubmissionId, detailVersion])

  const classItems = classes?.userId === userId ? classes.items : []
  const classesLoading = classes?.userId !== userId
  const classError = classes?.userId === userId ? classes.error : null

  const assignmentItems = assignments?.classId === selectedClassId ? assignments.items : []
  const assignmentsLoading = selectedClassId !== null && assignments?.classId !== selectedClassId
  const assignmentError = assignments?.classId === selectedClassId ? assignments.error : null

  const rosterItems = classRoster?.classId === selectedClassId ? classRoster.items : []
  const rosterLoading = selectedClassId !== null && classRoster?.classId !== selectedClassId
  const rosterError = classRoster?.classId === selectedClassId ? classRoster.error : null

  const submissionItems =
    submissions?.assignmentId === selectedAssignmentId ? submissions.items : []
  const submissionsLoading =
    selectedAssignmentId !== null && submissions?.assignmentId !== selectedAssignmentId
  const submissionError =
    submissions?.assignmentId === selectedAssignmentId ? submissions.error : null

  const selectedClass = classItems.find((item) => item.id === selectedClassId) ?? null
  const selectedAssignment =
    assignmentItems.find((item) => item.id === selectedAssignmentId) ?? null

  const detailItem = detail?.submissionId === selectedSubmissionId ? detail.item : null
  const detailError = detail?.submissionId === selectedSubmissionId ? detail.error : null
  const detailLoading =
    selectedSubmissionId !== null && detail?.submissionId !== selectedSubmissionId

  const openClass = (classId: string): void => {
    setSelectedClassId(classId)
    setSelectedAssignmentId(null)
    setSelectedSubmissionId(null)
  }

  const closeClass = (): void => {
    setSelectedClassId(null)
    setSelectedAssignmentId(null)
    setSelectedSubmissionId(null)
  }

  const backToTable = (): void => {
    setSelectedSubmissionId(null)
    setDetailVersion((version) => version + 1)
    setSubmissionVersion((version) => version + 1)
  }

  const refreshDetail = (): void => {
    setDetailVersion((version) => version + 1)
    setSubmissionVersion((version) => version + 1)
  }

  return (
    <div className="app-container professor-app">
      <nav className="top-nav">
        <div className="nav-logo">
          <div className="logo-icon"></div>
          Unicode
          <span className="nav-role-badge">Professor</span>
        </div>

        <div className="professor-breadcrumb">
          {selectedClass ? (
            <>
              <button className="crumb-link" onClick={closeClass}>
                Classes
              </button>
              <span>/</span>
              <span>{selectedClass.code}</span>
              {selectedAssignment && (
                <>
                  <span>/</span>
                  <span>{selectedAssignment.title}</span>
                </>
              )}
            </>
          ) : (
            <span>Dashboard</span>
          )}
        </div>

        <div className="nav-right">
          <button
            className="nav-icon-btn"
            title="Refresh classes"
            onClick={() => setClassVersion((version) => version + 1)}
          >
            <RefreshCw size={14} />
          </button>
          <span className="nav-user">{session.user.email}</span>
          <button className="nav-icon-btn" onClick={onSignOut} title="Sign out">
            <LogOut size={14} />
          </button>
          <AppearancePanel />
        </div>
        <TitleBarControls />
      </nav>

      <main className="professor-main">
        {selectedSubmissionId ? (
          detailItem ? (
            <SubmissionDetail
              key={detailItem.summary.id}
              detail={detailItem}
              professorId={userId}
              onBack={backToTable}
              onCommentAdded={refreshDetail}
            />
          ) : (
            <div className="professor-detail-loading">
              <button className="back-btn" onClick={backToTable}>
                <ChevronLeft size={14} /> All submissions
              </button>
              {detailError ? (
                <div className="professor-error">{detailError}</div>
              ) : detailLoading ? (
                <div className="professor-empty">Loading submission…</div>
              ) : null}
            </div>
          )
        ) : selectedClass ? (
          <>
            <header className="class-hero">
              <button className="back-btn" onClick={closeClass}>
                <ChevronLeft size={14} /> All classes
              </button>
              <div className="class-hero-body">
                <div className="class-hero-avatar">
                  {initialsOf(selectedClass.code.replace(/\s+/g, ''))}
                </div>
                <div className="class-hero-copy">
                  <span className="class-hero-code">{selectedClass.code}</span>
                  <h1>{selectedClass.name}</h1>
                  <div className="class-hero-stats">
                    <span className="class-stat">
                      <Users size={13} /> {selectedClass.studentCount} students
                    </span>
                    <span className="class-stat">
                      <BookOpen size={13} /> {selectedClass.assignmentCount} assignments
                    </span>
                  </div>
                </div>
                <div className="class-head-actions">
                  <button className="btn-secondary" onClick={() => setRosterOpen(true)}>
                    <Users size={13} /> Manage students
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setClassModal({ initial: selectedClass })}
                  >
                    <Pencil size={13} /> Edit class
                  </button>
                </div>
              </div>
            </header>

            <div className="assignment-layout">
              <aside className="class-sidebar">
                <section className="assignment-list">
                  <div className="panel-head">
                    <h3>Assignments</h3>
                    <button
                      className="icon-text-btn"
                      onClick={() => setAssignmentModal({ initial: null })}
                    >
                      <Plus size={12} /> New
                    </button>
                  </div>
                  {assignmentsLoading && (
                    <div className="professor-empty">Loading assignments…</div>
                  )}
                  {assignmentError && <div className="professor-error">{assignmentError}</div>}
                  {!assignmentsLoading && assignmentItems.length === 0 && (
                    <div className="professor-empty">No assignments yet.</div>
                  )}
                  {assignmentItems.map((assignment) => (
                    <button
                      key={assignment.id}
                      className={`assignment-item ${
                        assignment.id === selectedAssignmentId ? 'active' : ''
                      }`}
                      onClick={() => {
                        setSelectedAssignmentId(assignment.id)
                        setSelectedSubmissionId(null)
                      }}
                    >
                      <span className="assignment-item-top">
                        <span className="assignment-title">{assignment.title}</span>
                        <span className="assignment-count">{assignment.testCaseCount}</span>
                      </span>
                      <span className="assignment-meta">
                        <span className="assignment-lang">
                          {assignment.language ?? 'plaintext'}
                        </span>
                        {assignment.hiddenCaseCount > 0 && (
                          <span className="assignment-hidden">
                            {assignment.hiddenCaseCount} hidden
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </section>

                <section className="class-roster">
                  <div className="panel-head">
                    <h3>
                      Students <span className="panel-count">{rosterItems.length}</span>
                    </h3>
                    <button className="icon-text-btn" onClick={() => setRosterOpen(true)}>
                      <Users size={12} /> Manage
                    </button>
                  </div>
                  {rosterLoading && <div className="professor-empty">Loading students…</div>}
                  {rosterError && <div className="professor-error">{rosterError}</div>}
                  {!rosterLoading && !rosterError && rosterItems.length === 0 && (
                    <div className="professor-empty">No students yet.</div>
                  )}
                  <div className="class-roster-list">
                    {rosterItems.map((student) => (
                      <div className="class-roster-row" key={student.studentId}>
                        <span className="roster-avatar">{initialsOf(student.name)}</span>
                        <span className="roster-who">
                          <span className="roster-name">{student.name}</span>
                          <span className="roster-email">{student.email}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>

              <div className="assignment-table">
                {selectedAssignment ? (
                  <>
                    <div className="assignment-toolbar">
                      <button
                        className="btn-secondary"
                        onClick={() => setAssignmentModal({ initial: selectedAssignment })}
                      >
                        <Pencil size={13} /> Edit assignment
                      </button>
                      <button className="btn-secondary" onClick={() => setTestsOpen(true)}>
                        <ListChecks size={13} /> Test cases
                      </button>
                    </div>
                    <SubmissionTable
                      submissions={submissionItems}
                      loading={submissionsLoading}
                      error={submissionError}
                      onSelect={setSelectedSubmissionId}
                    />
                  </>
                ) : (
                  <div className="professor-empty">Select an assignment to see submissions.</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <ClassGrid
            classes={classItems}
            loading={classesLoading}
            error={classError}
            onSelect={openClass}
            onCreate={() => setClassModal({ initial: null })}
          />
        )}
      </main>

      {classModal && (
        <ClassModal
          professorId={userId}
          initial={classModal.initial}
          onClose={() => setClassModal(null)}
          onSaved={(classId) => {
            const created = classModal.initial === null
            setClassModal(null)
            setClassVersion((version) => version + 1)
            if (created) setSelectedClassId(classId)
          }}
        />
      )}

      {rosterOpen && selectedClass && (
        <RosterModal
          classId={selectedClass.id}
          className={selectedClass.name}
          onClose={() => setRosterOpen(false)}
          onChanged={() => {
            setClassVersion((version) => version + 1)
            setRosterVersion((version) => version + 1)
          }}
        />
      )}

      {assignmentModal && selectedClass && (
        <AssignmentModal
          classId={selectedClass.id}
          initial={assignmentModal.initial}
          onClose={() => setAssignmentModal(null)}
          onSaved={(assignmentId) => {
            const created = assignmentModal.initial === null
            setAssignmentModal(null)
            setAssignmentVersion((version) => version + 1)
            if (created) setSelectedAssignmentId(assignmentId)
          }}
        />
      )}

      {testsOpen && selectedAssignment && (
        <TestCaseModal
          assignmentId={selectedAssignment.id}
          assignmentTitle={selectedAssignment.title}
          onClose={() => setTestsOpen(false)}
          onChanged={() => {
            setAssignmentVersion((version) => version + 1)
            setDetailVersion((version) => version + 1)
          }}
        />
      )}
    </div>
  )
}
