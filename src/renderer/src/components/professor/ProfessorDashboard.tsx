import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Activity,
  Archive,
  ArchiveRestore,
  BookOpen,
  Calendar,
  ChevronLeft,
  Copy,
  Download,
  GraduationCap,
  KeyRound,
  LogOut,
  Pencil,
  RefreshCw,
  RotateCw,
  Trash2,
  Users
} from 'lucide-react'
import { initialsOf } from '../../lib/initials'
import { downloadCsv } from '../../lib/csv'
import { buildGradebookRows } from '../../lib/gradebook'
import {
  countNewer,
  markRepliesSeen,
  markSubmissionsSeen,
  repliesSeenAt,
  submissionsSeenAt
} from '../../lib/notifications'
import { writeClipboardText } from '../../lib/clipboard'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import AppearancePanel from '../AppearancePanel'
import TitleBarControls from '../TitleBarControls'
import AssignmentModal from './AssignmentModal'
import AssignmentView from './AssignmentView'
import ClassGrid from './ClassGrid'
import ClassModal from './ClassModal'
import ClassOverview from './ClassOverview'
import LiveLabView from './LiveLabView'
import RosterModal from './RosterModal'
import StudentView from './StudentView'
import SubmissionDetail from './SubmissionDetail'
import TestCaseModal from './TestCaseModal'
import {
  archiveAssignment,
  archiveClass,
  deleteAssignment,
  deleteClass,
  fetchAssignments,
  fetchClassSubmissions,
  fetchClasses,
  fetchRoster,
  fetchStudentReplyEvents,
  fetchStudentSubmissions,
  fetchSubmissionDetail,
  fetchSubmissionEvents,
  fetchSubmissions,
  rotateClassJoinCode
} from '../../lib/professorQueries'
import type { StudentReplyEvent, SubmissionEvent } from '../../lib/professorQueries'
import type { AssessmentKind } from '../../types/assessment'
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

const PROFESSOR_REALTIME_TABLES = ['submissions', 'comments', 'assignments'] as const

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
  const [showArchivedClasses, setShowArchivedClasses] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [liveLabOpen, setLiveLabOpen] = useState(false)

  const [assignments, setAssignments] = useState<AssignmentState | null>(null)
  const [assignmentVersion, setAssignmentVersion] = useState(0)
  const [showArchivedAssignments, setShowArchivedAssignments] = useState(false)
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
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [studentSubmissions, setStudentSubmissions] = useState<{
    studentId: string
    items: SubmissionSummary[]
    error: string | null
  } | null>(null)
  const [studentVersion, setStudentVersion] = useState(0)
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [detailVersion, setDetailVersion] = useState(0)

  // Professor CRUD modals.
  const [classModal, setClassModal] = useState<{ initial: ClassSummary | null } | null>(null)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [assignmentModal, setAssignmentModal] = useState<{
    initial: AssignmentSummary | null
    defaultKind: AssessmentKind
  } | null>(null)
  const [testsOpen, setTestsOpen] = useState(false)
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [lifecycleError, setLifecycleError] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [joinCodeBusy, setJoinCodeBusy] = useState(false)
  const [joinCodeNotice, setJoinCodeNotice] = useState<string | null>(null)
  const [replyEvents, setReplyEvents] = useState<StudentReplyEvent[]>([])
  const [submissionEvents, setSubmissionEvents] = useState<SubmissionEvent[]>([])
  const [replyVersion, setReplyVersion] = useState(0)
  const [, refreshSeenReplies] = useState(0)

  useRealtimeRefresh(session, PROFESSOR_REALTIME_TABLES, () => {
    setClassVersion((version) => version + 1)
    setAssignmentVersion((version) => version + 1)
    setSubmissionVersion((version) => version + 1)
    setDetailVersion((version) => version + 1)
    setReplyVersion((version) => version + 1)
  })

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

  // Student replies are optional context: a failed fetch just hides badges.
  useEffect(() => {
    let cancelled = false
    void fetchStudentReplyEvents()
      .then((events) => {
        if (!cancelled) setReplyEvents(events)
      })
      .catch(() => {
        if (!cancelled) setReplyEvents([])
      })
    return () => {
      cancelled = true
    }
  }, [userId, replyVersion, classVersion])

  // New-submission badges follow the same optional-fetch pattern as replies.
  useEffect(() => {
    let cancelled = false
    void fetchSubmissionEvents()
      .then((events) => {
        if (!cancelled) setSubmissionEvents(events)
      })
      .catch(() => {
        if (!cancelled) setSubmissionEvents([])
      })
    return () => {
      cancelled = true
    }
  }, [userId, replyVersion, classVersion])

  useEffect(() => {
    if (!selectedClassId) return
    let cancelled = false
    void fetchAssignments(selectedClassId)
      .then((items) => {
        if (cancelled) return
        setAssignments({ classId: selectedClassId, items, error: null })
        setSelectedAssignmentId((current) =>
          items.some((item) => item.id === current) ? current : null
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

  const classItems = useMemo(
    () => (classes?.userId === userId ? classes.items : []),
    [classes, userId]
  )
  const classesLoading = classes?.userId !== userId
  const classError = classes?.userId === userId ? classes.error : null

  const unreadRepliesByClass: Record<string, number> = {}
  const unreadSubmissionsByClass: Record<string, number> = {}
  for (const klass of classItems) {
    unreadRepliesByClass[klass.id] = countNewer(
      replyEvents.filter((event) => event.classId === klass.id),
      repliesSeenAt(userId, klass.id)
    )
    unreadSubmissionsByClass[klass.id] = countNewer(
      submissionEvents
        .filter((event) => event.classId === klass.id)
        .map((event) => ({ createdAt: event.submittedAt })),
      submissionsSeenAt(userId, klass.id)
    )
  }

  const assignmentItems = useMemo(
    () => (assignments?.classId === selectedClassId ? assignments.items : []),
    [assignments, selectedClassId]
  )
  const assignmentsLoading = selectedClassId !== null && assignments?.classId !== selectedClassId
  const assignmentError = assignments?.classId === selectedClassId ? assignments.error : null

  const visibleClassItems = useMemo(
    () =>
      showArchivedClasses ? classItems : classItems.filter((item) => item.archivedAt === null),
    [classItems, showArchivedClasses]
  )
  const visibleAssignmentItems = useMemo(
    () =>
      showArchivedAssignments
        ? assignmentItems
        : assignmentItems.filter((item) => item.archivedAt === null),
    [assignmentItems, showArchivedAssignments]
  )

  const rosterItems = classRoster?.classId === selectedClassId ? classRoster.items : []
  const rosterLoading = selectedClassId !== null && classRoster?.classId !== selectedClassId
  const rosterError = classRoster?.classId === selectedClassId ? classRoster.error : null

  const assignmentIds = useMemo(
    () => assignmentItems.map((assignment) => assignment.id),
    [assignmentItems]
  )

  useEffect(() => {
    if (!selectedStudentId || assignmentIds.length === 0) return
    let cancelled = false
    void fetchStudentSubmissions(assignmentIds, selectedStudentId)
      .then((items) => {
        if (!cancelled) {
          setStudentSubmissions({ studentId: selectedStudentId, items, error: null })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStudentSubmissions({
            studentId: selectedStudentId,
            items: [],
            error: messageOf(error)
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedStudentId, assignmentIds, studentVersion])

  const submissionItems =
    submissions?.assignmentId === selectedAssignmentId ? submissions.items : []
  const submissionsLoading =
    selectedAssignmentId !== null && submissions?.assignmentId !== selectedAssignmentId
  const submissionError =
    submissions?.assignmentId === selectedAssignmentId ? submissions.error : null

  const selectedClass = classItems.find((item) => item.id === selectedClassId) ?? null
  const selectedAssignment =
    assignmentItems.find((item) => item.id === selectedAssignmentId) ?? null
  const selectedStudent =
    rosterItems.find((student) => student.studentId === selectedStudentId) ?? null

  const studentSubmissionItems =
    studentSubmissions?.studentId === selectedStudentId ? studentSubmissions.items : []
  const studentSubmissionsLoading =
    selectedStudentId !== null &&
    assignmentIds.length > 0 &&
    studentSubmissions?.studentId !== selectedStudentId
  const studentSubmissionError =
    studentSubmissions?.studentId === selectedStudentId ? studentSubmissions.error : null

  const detailItem = detail?.submissionId === selectedSubmissionId ? detail.item : null
  const detailError = detail?.submissionId === selectedSubmissionId ? detail.error : null
  const detailLoading =
    selectedSubmissionId !== null && detail?.submissionId !== selectedSubmissionId

  const openClass = (classId: string): void => {
    const newestReply = replyEvents
      .filter((event) => event.classId === classId)
      .reduce((latest, event) => Math.max(latest, Date.parse(event.createdAt) || 0), 0)
    if (newestReply > 0) markRepliesSeen(userId, classId, newestReply)

    const newestSubmission = submissionEvents
      .filter((event) => event.classId === classId)
      .reduce((latest, event) => Math.max(latest, Date.parse(event.submittedAt) || 0), 0)
    if (newestSubmission > 0) {
      markSubmissionsSeen(userId, classId, newestSubmission)
    }

    refreshSeenReplies((version) => version + 1)
    setJoinCodeNotice(null)
    setSelectedClassId(classId)
    setSelectedAssignmentId(null)
    setSelectedStudentId(null)
    setSelectedSubmissionId(null)
  }

  const closeClass = (): void => {
    setSelectedClassId(null)
    setSelectedAssignmentId(null)
    setSelectedStudentId(null)
    setSelectedSubmissionId(null)
    setLifecycleError(null)
    setExportError(null)
    setJoinCodeNotice(null)
  }

  const exportGrades = async (): Promise<void> => {
    if (!selectedClass) return
    setExportBusy(true)
    setExportError(null)
    try {
      if (rosterItems.length === 0) {
        throw new Error('This class has no enrolled students to export yet.')
      }
      const submissions = await fetchClassSubmissions(
        assignmentItems.map((assignment) => assignment.id)
      )
      const rows = buildGradebookRows(assignmentItems, rosterItems, submissions)
      const stem = (selectedClass.code || selectedClass.name).replace(/[^A-Za-z0-9._-]+/g, '-')
      downloadCsv(`${stem}-gradebook`, rows)
    } catch (error) {
      setExportError(messageOf(error))
    } finally {
      setExportBusy(false)
    }
  }

  const copyJoinCode = async (): Promise<void> => {
    if (!selectedClass) return
    try {
      await writeClipboardText(selectedClass.joinCode)
      setJoinCodeNotice('Join code copied. Share it with your students.')
    } catch (error) {
      setJoinCodeNotice(messageOf(error))
    }
  }

  const rotateJoinCode = async (): Promise<void> => {
    if (!selectedClass) return
    const confirmed = await window.api.ui.confirm({
      title: 'Rotate Join Code',
      message: `Rotate the join code for ${selectedClass.code}?`,
      detail:
        'The current code stops working immediately. Students already enrolled are unaffected.',
      confirmLabel: 'Rotate',
      danger: true
    })
    if (!confirmed) return

    setJoinCodeBusy(true)
    setJoinCodeNotice(null)
    try {
      const nextCode = await rotateClassJoinCode(selectedClass.id)
      setClassVersion((version) => version + 1)
      setJoinCodeNotice(`New join code: ${nextCode}`)
    } catch (error) {
      setJoinCodeNotice(messageOf(error))
    } finally {
      setJoinCodeBusy(false)
    }
  }

  const backToClassOverview = (): void => {
    setSelectedAssignmentId(null)
    setSelectedStudentId(null)
    setSelectedSubmissionId(null)
  }

  const openAssignment = (assignmentId: string): void => {
    setSelectedAssignmentId(assignmentId)
    setSelectedStudentId(null)
    setSelectedSubmissionId(null)
    setLifecycleError(null)
  }

  const openStudent = (studentId: string): void => {
    setSelectedStudentId(studentId)
    setSelectedAssignmentId(null)
    setSelectedSubmissionId(null)
  }

  const backToTable = (): void => {
    setSelectedSubmissionId(null)
    setDetailVersion((version) => version + 1)
    setSubmissionVersion((version) => version + 1)
    setStudentVersion((version) => version + 1)
  }

  const refreshDetail = (): void => {
    setDetailVersion((version) => version + 1)
    setSubmissionVersion((version) => version + 1)
  }

  const toggleClassArchive = async (): Promise<void> => {
    if (!selectedClass) return
    setLifecycleBusy(true)
    setLifecycleError(null)
    try {
      await archiveClass(selectedClass.id, selectedClass.archivedAt === null)
      setClassVersion((version) => version + 1)
    } catch (archiveError) {
      setLifecycleError(
        archiveError instanceof Error ? archiveError.message : 'Could not archive the class.'
      )
    } finally {
      setLifecycleBusy(false)
    }
  }

  const removeSelectedClass = async (): Promise<void> => {
    if (!selectedClass) return
    if (
      !window.confirm(
        `Delete ${selectedClass.code} – ${selectedClass.name}? This permanently deletes its assignments, submissions, comments, and integrity scores. Student workspace files are not touched.`
      )
    ) {
      return
    }
    setLifecycleBusy(true)
    setLifecycleError(null)
    try {
      await deleteClass(selectedClass.id)
      setClassVersion((version) => version + 1)
      closeClass()
    } catch (deleteError) {
      setLifecycleError(
        deleteError instanceof Error ? deleteError.message : 'Could not delete the class.'
      )
    } finally {
      setLifecycleBusy(false)
    }
  }

  const toggleAssignmentArchive = async (): Promise<void> => {
    if (!selectedAssignment) return
    setLifecycleBusy(true)
    setLifecycleError(null)
    try {
      await archiveAssignment(selectedAssignment.id, selectedAssignment.archivedAt === null)
      setAssignmentVersion((version) => version + 1)
      setClassVersion((version) => version + 1)
    } catch (archiveError) {
      setLifecycleError(
        archiveError instanceof Error ? archiveError.message : 'Could not archive the assignment.'
      )
    } finally {
      setLifecycleBusy(false)
    }
  }

  const removeSelectedAssignment = async (): Promise<void> => {
    if (!selectedAssignment) return
    if (
      !window.confirm(
        `Delete “${selectedAssignment.title}”? This permanently deletes its submissions, comments, integrity scores, and run history. Student workspace files are not touched.`
      )
    ) {
      return
    }
    setLifecycleBusy(true)
    setLifecycleError(null)
    try {
      await deleteAssignment(selectedAssignment.id)
      setAssignmentVersion((version) => version + 1)
      setClassVersion((version) => version + 1)
      setSelectedAssignmentId(null)
    } catch (deleteError) {
      setLifecycleError(
        deleteError instanceof Error ? deleteError.message : 'Could not delete the assignment.'
      )
    } finally {
      setLifecycleBusy(false)
    }
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
          {liveLabOpen ? (
            <span>Live lab</span>
          ) : selectedClass ? (
            <>
              <button className="crumb-link" onClick={closeClass}>
                Classes
              </button>
              <span>/</span>
              {selectedAssignment || selectedStudent || selectedSubmissionId ? (
                <button className="crumb-link" onClick={backToClassOverview}>
                  {selectedClass.code}
                </button>
              ) : (
                <span>{selectedClass.code}</span>
              )}
              {selectedAssignment && (
                <>
                  <span>/</span>
                  <span>{selectedAssignment.title}</span>
                </>
              )}
              {selectedStudent && (
                <>
                  <span>/</span>
                  <span>{selectedStudent.name}</span>
                </>
              )}
            </>
          ) : (
            <span>Dashboard</span>
          )}
        </div>

        <div className="nav-right">
          <button className="nav-icon-btn" title="Live lab" onClick={() => setLiveLabOpen(true)}>
            <Activity size={14} />
          </button>
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
        {lifecycleError && <div className="professor-error">{lifecycleError}</div>}
        {liveLabOpen ? (
          <LiveLabView session={session} onBack={() => setLiveLabOpen(false)} />
        ) : selectedSubmissionId ? (
          detailItem ? (
            <SubmissionDetail
              key={detailItem.summary.id}
              detail={detailItem}
              professorId={userId}
              onBack={backToTable}
              onCommentAdded={refreshDetail}
              onRecomputed={refreshDetail}
            />
          ) : (
            <div className="professor-detail-loading">
              <button className="back-btn" onClick={backToTable}>
                <ChevronLeft size={14} /> Back
              </button>
              {detailError ? (
                <div className="professor-error">{detailError}</div>
              ) : detailLoading ? (
                <div className="professor-empty">Loading submission…</div>
              ) : null}
            </div>
          )
        ) : selectedStudentId && selectedStudent ? (
          <StudentView
            student={selectedStudent}
            submissions={studentSubmissionItems}
            assignments={assignmentItems}
            loading={studentSubmissionsLoading}
            error={studentSubmissionError}
            onBack={backToClassOverview}
            onOpenSubmission={setSelectedSubmissionId}
          />
        ) : selectedAssignment ? (
          <AssignmentView
            assignment={selectedAssignment}
            submissions={submissionItems}
            rosterCount={rosterItems.length}
            loading={submissionsLoading}
            error={submissionError}
            onBack={backToClassOverview}
            onEdit={() =>
              setAssignmentModal({
                initial: selectedAssignment,
                defaultKind: selectedAssignment.kind
              })
            }
            onManageTests={() => setTestsOpen(true)}
            onOpenSubmission={setSelectedSubmissionId}
            onRefresh={() => {
              setSubmissionVersion((version) => version + 1)
              setDetailVersion((version) => version + 1)
            }}
            onArchive={() => void toggleAssignmentArchive()}
            onDelete={() => void removeSelectedAssignment()}
            archiveBusy={lifecycleBusy}
          />
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
                    {selectedClass.yearSection && (
                      <span className="class-stat">
                        <GraduationCap size={13} /> {selectedClass.yearSection}
                      </span>
                    )}
                    {selectedClass.academicYear && (
                      <span className="class-stat">
                        <Calendar size={13} /> AY {selectedClass.academicYear}
                      </span>
                    )}
                    <span className="class-join-code" title="Students can join with this code">
                      <KeyRound size={13} />
                      Join code <code>{selectedClass.joinCode}</code>
                      <button
                        className="class-join-action"
                        onClick={() => void copyJoinCode()}
                        title="Copy join code"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        className="class-join-action"
                        onClick={() => void rotateJoinCode()}
                        disabled={joinCodeBusy}
                        title="Rotate join code"
                      >
                        <RotateCw size={11} />
                      </button>
                    </span>
                    {selectedClass.archivedAt && <span className="archived-badge">Archived</span>}
                  </div>
                </div>
                <div className="class-head-actions">
                  <button className="btn-secondary" onClick={() => setRosterOpen(true)}>
                    <Users size={13} /> Manage students
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => void exportGrades()}
                    disabled={exportBusy}
                  >
                    <Download size={13} /> {exportBusy ? 'Exporting…' : 'Export grades'}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setClassModal({ initial: selectedClass })}
                  >
                    <Pencil size={13} /> Edit class
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => void toggleClassArchive()}
                    disabled={lifecycleBusy}
                  >
                    {selectedClass.archivedAt ? (
                      <ArchiveRestore size={13} />
                    ) : (
                      <Archive size={13} />
                    )}
                    {selectedClass.archivedAt ? 'Restore' : 'Archive'}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => void removeSelectedClass()}
                    disabled={lifecycleBusy}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </header>

            {exportError && <div className="professor-error">{exportError}</div>}
            {joinCodeNotice && <div className="auth-info">{joinCodeNotice}</div>}

            <ClassOverview
              assignments={visibleAssignmentItems}
              assignmentsLoading={assignmentsLoading}
              assignmentError={assignmentError}
              roster={rosterItems}
              rosterLoading={rosterLoading}
              rosterError={rosterError}
              showArchivedAssignments={showArchivedAssignments}
              onToggleArchivedAssignments={() => setShowArchivedAssignments((current) => !current)}
              onSelectAssignment={openAssignment}
              onSelectStudent={openStudent}
              onNewAssignment={(kind) => setAssignmentModal({ initial: null, defaultKind: kind })}
              onManageStudents={() => setRosterOpen(true)}
            />
          </>
        ) : (
          <ClassGrid
            classes={visibleClassItems}
            loading={classesLoading}
            error={classError}
            showArchived={showArchivedClasses}
            unreadReplies={unreadRepliesByClass}
            unreadSubmissions={unreadSubmissionsByClass}
            onToggleArchived={() => setShowArchivedClasses((current) => !current)}
            onOpenLiveLab={() => setLiveLabOpen(true)}
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
          defaultKind={assignmentModal.defaultKind}
          onClose={() => setAssignmentModal(null)}
          onSaved={(assignmentId) => {
            const created = assignmentModal.initial === null
            setAssignmentModal(null)
            setAssignmentVersion((version) => version + 1)
            setClassVersion((version) => version + 1)
            if (created) {
              setSelectedAssignmentId(assignmentId)
              setSelectedStudentId(null)
              setSelectedSubmissionId(null)
            }
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
