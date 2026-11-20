import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Award,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderOpen,
  GraduationCap,
  Info,
  KeyRound,
  LogOut,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  WifiOff
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import AppearancePanel from './AppearancePanel'
import AssignmentDetailModal from './AssignmentDetailModal'
import IntegrityDemo from './IntegrityDemo'
import JoinClassModal from './JoinClassModal'
import ProfessorInviteModal from './ProfessorInviteModal'
import TitleBarControls from './TitleBarControls'
import { useStudentFeedback } from '../hooks/useStudentFeedback'
import { usePendingSubmissions } from '../hooks/usePendingSubmissions'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import type { EnrolledCourse } from '../hooks/useEnrolledCourses'
import {
  classSeenAt,
  countNewer,
  feedbackSeenAt,
  gradesSeenAt,
  markClassSeen,
  markFeedbackSeen,
  markGradesSeen
} from '../lib/notifications'
import type { StudentAssignment } from '../types/student'

interface StudentDashboardProps {
  /** False while the editor workspace is showing; the dashboard stays mounted. */
  active: boolean
  session: Session
  courses: EnrolledCourse[]
  coursesLoading: boolean
  assignments: StudentAssignment[]
  loading: boolean
  error: string | null
  reload: () => void
  onOpenClassFiles: (course: EnrolledCourse) => void
  /** Opens (and seeds, if needed) the workspace file for an assignment. */
  onOpenAssignment: (assignment: StudentAssignment) => Promise<void>
  /** Submits the current content of the assignment file. */
  onSubmitAssignment: (assignment: StudentAssignment) => Promise<void>
  /** Reloads enrollments, assignments, and the workspace after joining. */
  onJoinedClass: () => void
  onOpenWorkspace: () => void
  onOpenFeedback: () => void
  /** Re-reads the profile role after a professor invite is redeemed. */
  onProfessorInviteRedeemed: () => void
  onSignOut: () => void
}

interface ClassSummary {
  course: EnrolledCourse
  assignments: StudentAssignment[]
  submitted: number
  graded: number
  newGrades: number
  feedbackCount: number
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const formatDue = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const STUDENT_REALTIME_TABLES = ['comments', 'submissions', 'assignments'] as const

export default function StudentDashboard({
  active,
  session,
  courses,
  coursesLoading,
  assignments,
  loading,
  error,
  reload,
  onOpenClassFiles,
  onOpenAssignment,
  onSubmitAssignment,
  onJoinedClass,
  onOpenWorkspace,
  onOpenFeedback,
  onProfessorInviteRedeemed,
  onSignOut
}: StudentDashboardProps): React.ReactElement {
  const feedback = useStudentFeedback(session)
  const reloadFeedback = feedback.reload
  const pendingSubmissions = usePendingSubmissions()
  const queuedAssignmentIds = new Set(
    pendingSubmissions.map((submission) => submission.assignmentId)
  )
  useRealtimeRefresh(session, STUDENT_REALTIME_TABLES, () => {
    reload()
    reloadFeedback()
  })
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  // Re-renders after marking feedback or a class as seen.
  const [, bumpSeenVersion] = useState(0)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const hasBeenActive = useRef(false)

  useEffect(() => {
    if (!active) return
    rootRef.current?.focus()
    if (hasBeenActive.current) {
      reload()
      reloadFeedback()
    } else {
      hasBeenActive.current = true
    }
  }, [active, reload, reloadFeedback])

  const displayName = useMemo(() => {
    const metadata = session.user.user_metadata as Record<string, unknown> | undefined
    const raw = metadata?.display_name
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
    const email = session.user.email ?? ''
    return email.includes('@') ? email.split('@')[0] : email || 'there'
  }, [session.user.email, session.user.user_metadata])

  const userId = session.user.id
  const seenGradesAt = gradesSeenAt(userId)
  const classSummaries = useMemo<ClassSummary[]>(() => {
    return courses.map((course) => {
      const classAssignments = assignments.filter((assignment) => assignment.classId === course.id)
      const submitted = classAssignments.filter(
        (assignment) => assignment.latestSubmission !== null
      ).length
      const graded = classAssignments.filter((assignment) => {
        const latest = assignment.latestSubmission
        return latest !== null && latest.grade !== null
      }).length
      const newGrades = classAssignments.filter((assignment) => {
        const releasedAt = assignment.latestSubmission?.gradeReleasedAt
        return releasedAt !== null && releasedAt !== undefined
          ? (Date.parse(releasedAt) || 0) > seenGradesAt
          : false
      }).length
      const feedbackCount = feedback.items.filter(
        (item) => item.classCode === course.code && item.authorRole === 'professor'
      ).length
      return {
        course,
        assignments: classAssignments,
        submitted,
        graded,
        newGrades,
        feedbackCount
      }
    })
  }, [assignments, courses, feedback.items, seenGradesAt])

  const seenFeedbackAt = feedbackSeenAt(userId)
  const professorFeedback = feedback.items.filter((item) => item.authorRole === 'professor')
  const unreadFeedback = countNewer(professorFeedback, seenFeedbackAt)
  const unreadForClass = (classCode: string | null): number =>
    countNewer(
      professorFeedback.filter((item) => item.classCode === (classCode ?? '')),
      seenFeedbackAt
    )

  const openFeedbackPanel = (): void => {
    const newest = professorFeedback.reduce(
      (latest, item) => Math.max(latest, Date.parse(item.createdAt) || 0),
      0
    )
    markFeedbackSeen(userId, newest)
    bumpSeenVersion((version) => version + 1)
    onOpenFeedback()
  }

  const openClassDetail = (courseId: string): void => {
    const summary = classSummaries.find((item) => item.course.id === courseId)
    const newest = (summary?.assignments ?? []).reduce(
      (latest, assignment) =>
        Math.max(
          latest,
          Date.parse(assignment.publishAt ?? assignment.createdAt) || 0,
          Date.parse(assignment.createdAt) || 0
        ),
      0
    )
    markClassSeen(courseId, newest)
    bumpSeenVersion((version) => version + 1)
    setSelectedClassId(courseId)
  }

  const openAssignmentDetail = (assignment: StudentAssignment): void => {
    const releasedAt = assignment.latestSubmission?.gradeReleasedAt
    if (releasedAt) {
      markGradesSeen(userId, Date.parse(releasedAt) || 0)
      bumpSeenVersion((version) => version + 1)
    }
    setDetailId(assignment.id)
  }

  const selectedClass =
    classSummaries.find((summary) => summary.course.id === selectedClassId) ?? null
  const detailAssignment =
    selectedClass?.assignments.find((assignment) => assignment.id === detailId) ?? null
  // Captured once per dashboard visit so "past due" flags stay stable during a render.
  const [now] = useState(() => Date.now())
  const totalFeedback = classSummaries.reduce((total, summary) => total + summary.feedbackCount, 0)
  const totalSubmitted = classSummaries.reduce((total, summary) => total + summary.submitted, 0)
  const totalGraded = classSummaries.reduce((total, summary) => total + summary.graded, 0)
  const initialLoading = coursesLoading || loading

  const statCards = [
    {
      label: 'Classes',
      value: courses.length,
      icon: <GraduationCap size={15} />,
      className: 'is-classes'
    },
    {
      label: 'Assignments',
      value: assignments.length,
      icon: <ClipboardList size={15} />,
      className: 'is-assignments'
    },
    {
      label: 'Submitted',
      value: totalSubmitted,
      icon: <CheckCircle2 size={15} />,
      className: 'is-submitted'
    },
    {
      label: 'Graded',
      value: totalGraded,
      icon: <Award size={15} />,
      className: 'is-graded'
    },
    {
      label: 'Feedback',
      value: totalFeedback,
      icon: <MessageSquare size={15} />,
      className: 'is-feedback'
    }
  ]

  const refreshAll = (): void => {
    reload()
    reloadFeedback()
  }

  const openAssignmentFile = async (assignment: StudentAssignment): Promise<void> => {
    setActionError(null)
    try {
      await onOpenAssignment(assignment)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not open the assignment file.')
    }
  }

  const submitAssignment = async (assignment: StudentAssignment): Promise<void> => {
    setSubmittingId(assignment.id)
    setActionError(null)
    try {
      await onSubmitAssignment(assignment)
      reload()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not submit this assignment.')
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={`app-container student-app student-dashboard-overlay ${active ? '' : 'is-hidden'}`}
    >
      <nav className="top-nav">
        <div className="nav-logo">
          <div className="logo-icon"></div>
          Unicode
          <span className="nav-role-badge">Student</span>
        </div>
        <div className="nav-right">
          <button className="nav-icon-btn" onClick={refreshAll} title="Refresh classes">
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

      <main className="student-main">
        <div className="student-inner">
          {selectedClass ? (
            <>
              <header className="student-class-detail-head">
                <button className="back-btn" onClick={() => setSelectedClassId(null)}>
                  <ChevronLeft size={14} /> All classes
                </button>
                <div className="student-class-detail-copy">
                  <span className="student-class-code">
                    {selectedClass.course.code || selectedClass.course.title}
                  </span>
                  <h1>{selectedClass.course.title}</h1>
                  <p className="student-class-detail-meta">
                    {selectedClass.course.yearSection && (
                      <span>
                        <GraduationCap size={12} /> {selectedClass.course.yearSection}
                      </span>
                    )}
                    {selectedClass.course.academicYear && (
                      <span>
                        <Calendar size={12} /> AY {selectedClass.course.academicYear}
                      </span>
                    )}
                  </p>
                </div>
                <div className="student-class-detail-actions">
                  <button className="btn-secondary" onClick={() => setDemoOpen(true)}>
                    <ShieldCheck size={13} /> ICS demo
                  </button>
                  <button className="btn-secondary" onClick={openFeedbackPanel}>
                    <MessageSquare size={13} /> Feedback
                    {unreadForClass(selectedClass.course.code) > 0 && (
                      <span className="student-count">
                        {unreadForClass(selectedClass.course.code)}
                      </span>
                    )}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => onOpenClassFiles(selectedClass.course)}
                  >
                    <FolderOpen size={13} /> Open class files
                  </button>
                </div>
              </header>

              {(error || actionError) && (
                <div className="professor-error student-notice">{actionError ?? error}</div>
              )}

              <section className="student-stat-grid" aria-label="Class summary">
                <div className="student-stat">
                  <span className="student-stat-icon is-assignments">
                    <GraduationCap size={15} />
                  </span>
                  <span className="student-stat-copy">
                    <span className="student-stat-value">{selectedClass.assignments.length}</span>
                    <span className="student-stat-label">Assignments</span>
                  </span>
                </div>
                <div className="student-stat">
                  <span className="student-stat-icon is-submitted">
                    <FolderOpen size={15} />
                  </span>
                  <span className="student-stat-copy">
                    <span className="student-stat-value">{selectedClass.submitted}</span>
                    <span className="student-stat-label">Submitted</span>
                  </span>
                </div>
                <div className="student-stat">
                  <span className="student-stat-icon is-graded">
                    <ChevronRight size={15} />
                  </span>
                  <span className="student-stat-copy">
                    <span className="student-stat-value">{selectedClass.graded}</span>
                    <span className="student-stat-label">Graded</span>
                  </span>
                </div>
                <div className="student-stat">
                  <span className="student-stat-icon is-feedback">
                    <MessageSquare size={15} />
                  </span>
                  <span className="student-stat-copy">
                    <span className="student-stat-value">{selectedClass.feedbackCount}</span>
                    <span className="student-stat-label">Feedback</span>
                  </span>
                </div>
              </section>

              <div className="student-content-grid">
                <div className="student-class-list">
                  <section className="student-panel">
                    <header className="student-panel-head">
                      <h3>Assignments</h3>
                      <span className="student-panel-meta">
                        {selectedClass.submitted}/{selectedClass.assignments.length} submitted
                      </span>
                    </header>

                    {selectedClass.assignments.length === 0 && (
                      <p className="student-panel-empty">No assignments for this class yet.</p>
                    )}

                    <div className="student-assignment-list">
                      {selectedClass.assignments.map((assignment) => {
                        const latest = assignment.latestSubmission
                        const queued = queuedAssignmentIds.has(assignment.id)
                        const status = queued
                          ? 'queued'
                          : latest === null
                            ? 'new'
                            : latest.grade !== null
                              ? 'graded'
                              : 'submitted'
                        const newGrade = latest?.gradeReleasedAt
                          ? (Date.parse(latest.gradeReleasedAt) || 0) > seenGradesAt
                          : false
                        const due = assignment.dueAt ? new Date(assignment.dueAt) : null
                        const late =
                          due !== null && latest !== null
                            ? new Date(latest.submittedAt).getTime() > due.getTime()
                            : false
                        const overdue = due !== null && latest === null && due.getTime() < now
                        return (
                          <article key={assignment.id} className={`assignment-card is-${status}`}>
                            <div className="assignment-card-head">
                              <span className="assignment-card-title">{assignment.title}</span>
                              <span className={`assignment-status is-${status}`}>
                                <span className="assignment-status-dot" />
                                {status === 'queued'
                                  ? 'Queued'
                                  : status === 'graded' && latest
                                    ? `Graded · ${latest.grade}`
                                    : status === 'submitted'
                                      ? 'Submitted'
                                      : 'Not submitted'}
                              </span>
                            </div>

                            <div className="assignment-card-meta">
                              {assignment.fileName && (
                                <span className="assignment-file">
                                  <FileText size={10} />
                                  {assignment.fileName}
                                </span>
                              )}
                              {assignment.language && (
                                <span className="assignment-language">{assignment.language}</span>
                              )}
                              {due && (
                                <span
                                  className={`assignment-due ${late || overdue ? 'is-late' : ''}`}
                                >
                                  Due {formatDue(due.toISOString())}
                                </span>
                              )}
                              {late && <span className="assignment-flag is-late">Late</span>}
                              {overdue && (
                                <span className="assignment-flag is-overdue">Past due</span>
                              )}
                              {newGrade && (
                                <span className="assignment-flag is-grade">New grade</span>
                              )}
                            </div>

                            {assignment.description && (
                              <p className="assignment-card-description">
                                {assignment.description}
                              </p>
                            )}

                            <div className="assignment-card-actions">
                              <button
                                className="btn-secondary"
                                onClick={() => openAssignmentDetail(assignment)}
                              >
                                <Info size={12} /> Details
                              </button>
                              <button
                                className="btn-secondary"
                                onClick={() => void openAssignmentFile(assignment)}
                              >
                                <FolderOpen size={12} /> Open file
                              </button>
                              <button
                                className="btn-primary"
                                disabled={submittingId === assignment.id || queued}
                                onClick={() => void submitAssignment(assignment)}
                              >
                                {queued
                                  ? 'Queued'
                                  : submittingId === assignment.id
                                    ? 'Submitting…'
                                    : 'Submit'}
                              </button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                </div>

                <aside className="student-aside">
                  <section className="student-panel">
                    <header className="student-panel-head">
                      <h3>Class progress</h3>
                      <span className="student-panel-meta">
                        {selectedClass.submitted}/{selectedClass.assignments.length} submitted
                      </span>
                    </header>
                    <div className="student-progress-track">
                      <span
                        style={{
                          width: `${
                            selectedClass.assignments.length === 0
                              ? 0
                              : Math.round(
                                  (selectedClass.submitted / selectedClass.assignments.length) * 100
                                )
                          }%`
                        }}
                      />
                    </div>
                    <p className="student-panel-empty student-progress-note">
                      {selectedClass.assignments.length === 0
                        ? 'No assignments for this class yet.'
                        : `${selectedClass.assignments.length - selectedClass.submitted} ${
                            selectedClass.assignments.length - selectedClass.submitted === 1
                              ? 'assignment'
                              : 'assignments'
                          } left to submit.`}
                    </p>
                  </section>

                  <section className="student-panel">
                    <header className="student-panel-head">
                      <h3>Recent feedback</h3>
                      <button className="student-panel-link" onClick={openFeedbackPanel}>
                        View all
                      </button>
                    </header>
                    {feedback.loading && <p className="student-panel-empty">Loading feedback…</p>}
                    {!feedback.loading &&
                      feedback.items.filter(
                        (item) =>
                          item.classCode === selectedClass.course.code &&
                          item.authorRole === 'professor'
                      ).length === 0 && (
                        <p className="student-panel-empty">No feedback for this class yet.</p>
                      )}
                    {feedback.items
                      .filter(
                        (item) =>
                          item.classCode === selectedClass.course.code &&
                          item.authorRole === 'professor'
                      )
                      .slice(0, 3)
                      .map((item) => (
                        <article key={item.id} className="student-feedback-item">
                          <header>
                            <span>{item.assignmentTitle}</span>
                            {item.anchorLine !== null && <span>Line {item.anchorLine}</span>}
                          </header>
                          <p>{item.body}</p>
                          <time>{formatDate(item.createdAt)}</time>
                        </article>
                      ))}
                  </section>
                </aside>
              </div>
            </>
          ) : (
            <>
              <header className="student-hero">
                <div className="student-hero-copy">
                  <span className="student-eyebrow">Student dashboard</span>
                  <h1>
                    Welcome back, <span>{displayName}</span>
                  </h1>
                  <p>
                    {initialLoading
                      ? 'Loading your classes…'
                      : `${totalSubmitted} of ${assignments.length} submitted across ${
                          courses.length
                        } ${courses.length === 1 ? 'class' : 'classes'}. Pick a class below.`}
                  </p>
                </div>
                <div className="student-hero-actions">
                  <button className="btn-secondary" onClick={() => setJoinOpen(true)}>
                    <UserPlus size={13} /> Join class
                  </button>
                  <button className="btn-secondary" onClick={() => setInviteOpen(true)}>
                    <KeyRound size={13} /> Redeem invite
                  </button>
                  <button className="btn-secondary" onClick={() => setDemoOpen(true)}>
                    <ShieldCheck size={13} /> ICS demo
                  </button>
                  <button className="btn-secondary" onClick={openFeedbackPanel}>
                    <MessageSquare size={13} />
                    Feedback
                    {unreadFeedback > 0 && <span className="student-count">{unreadFeedback}</span>}
                  </button>
                  <button className="btn-primary" onClick={onOpenWorkspace}>
                    <FolderOpen size={13} /> Open workspace
                  </button>
                </div>
              </header>

              <section className="student-stat-grid" aria-label="Assignment summary">
                {statCards.map((stat) => (
                  <div key={stat.label} className="student-stat">
                    <span className={`student-stat-icon ${stat.className}`}>{stat.icon}</span>
                    <span className="student-stat-copy">
                      <span className="student-stat-value">{stat.value}</span>
                      <span className="student-stat-label">{stat.label}</span>
                    </span>
                  </div>
                ))}
              </section>

              {error && <div className="professor-error student-notice">{error}</div>}
              {pendingSubmissions.length > 0 && (
                <div className="student-queued-note">
                  <WifiOff size={13} />
                  {pendingSubmissions.length}{' '}
                  {pendingSubmissions.length === 1 ? 'submission is' : 'submissions are'} queued and
                  will send when you are back online.
                </div>
              )}
              {initialLoading && <div className="professor-empty">Loading your classes…</div>}

              {!initialLoading && !error && courses.length === 0 && (
                <div className="student-empty-card">
                  <span className="student-empty-icon">
                    <GraduationCap size={22} />
                  </span>
                  <h2>No classes yet</h2>
                  <p>
                    Classes appear here when your professor enrolls you. You can also join with a
                    class code.
                  </p>
                  <div className="student-empty-actions">
                    <button className="btn-primary" onClick={() => setJoinOpen(true)}>
                      <UserPlus size={13} /> Join class
                    </button>
                    <button className="btn-secondary" onClick={onOpenWorkspace}>
                      <FolderOpen size={13} /> Open workspace
                    </button>
                  </div>
                </div>
              )}

              {!initialLoading && courses.length > 0 && (
                <div className="student-content-grid">
                  <div className="student-class-list">
                    <div className="student-class-grid">
                      {classSummaries.map((summary) => {
                        const total = summary.assignments.length
                        const percent =
                          total === 0 ? 0 : Math.round((summary.submitted / total) * 100)
                        const newAssignments = countNewer(
                          summary.assignments.map((assignment) => ({
                            createdAt: assignment.publishAt ?? assignment.createdAt
                          })),
                          classSeenAt(summary.course.id)
                        )
                        return (
                          <button
                            key={summary.course.id}
                            className="student-class-card"
                            onClick={() => openClassDetail(summary.course.id)}
                          >
                            <span className="student-class-card-top">
                              <span className="student-class-code">
                                {summary.course.code || summary.course.title}
                              </span>
                              <ChevronRight size={15} />
                            </span>
                            <span className="student-class-card-name">{summary.course.title}</span>
                            {(summary.course.yearSection || summary.course.academicYear) && (
                              <span className="student-class-card-meta">
                                {summary.course.yearSection && (
                                  <span>
                                    <GraduationCap size={11} /> {summary.course.yearSection}
                                  </span>
                                )}
                                {summary.course.academicYear && (
                                  <span>
                                    <Calendar size={11} /> AY {summary.course.academicYear}
                                  </span>
                                )}
                              </span>
                            )}
                            {newAssignments > 0 && (
                              <span className="student-class-card-new">
                                {newAssignments} new{' '}
                                {newAssignments === 1 ? 'assignment' : 'assignments'}
                              </span>
                            )}
                            {summary.newGrades > 0 && (
                              <span className="student-class-card-new is-grade">
                                {summary.newGrades} new{' '}
                                {summary.newGrades === 1 ? 'grade' : 'grades'}
                              </span>
                            )}
                            <span className="student-class-card-stats">
                              <span>
                                {total === 0
                                  ? 'No assignments yet'
                                  : `${summary.submitted}/${total} submitted`}
                              </span>
                              <span>{summary.feedbackCount} feedback</span>
                            </span>
                            <span className="student-class-card-track">
                              <span style={{ width: `${percent}%` }} />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <aside className="student-aside">
                    <section className="student-panel">
                      <header className="student-panel-head">
                        <h3>Class progress</h3>
                      </header>
                      <div className="student-progress-list">
                        {classSummaries.map((summary) => {
                          const total = summary.assignments.length
                          const percent =
                            total === 0 ? 0 : Math.round((summary.submitted / total) * 100)
                          return (
                            <div key={summary.course.id} className="student-progress-row">
                              <div className="student-progress-top">
                                <span className="student-progress-code">
                                  {summary.course.code || summary.course.title}
                                </span>
                                <span>
                                  {summary.submitted}/{total}
                                </span>
                              </div>
                              <div className="student-progress-track">
                                <span style={{ width: `${percent}%` }} />
                              </div>
                              <span className="student-progress-name">{summary.course.title}</span>
                            </div>
                          )
                        })}
                      </div>
                    </section>

                    <section className="student-panel">
                      <header className="student-panel-head">
                        <h3>Recent feedback</h3>
                        <button className="student-panel-link" onClick={openFeedbackPanel}>
                          View all
                        </button>
                      </header>
                      {feedback.loading && <p className="student-panel-empty">Loading feedback…</p>}
                      {!feedback.loading && professorFeedback.length === 0 && (
                        <p className="student-panel-empty">No feedback yet.</p>
                      )}
                      {professorFeedback.slice(0, 3).map((item) => (
                        <article key={item.id} className="student-feedback-item">
                          <header>
                            <span>
                              {item.classCode} · {item.assignmentTitle}
                            </span>
                            {item.anchorLine !== null && <span>Line {item.anchorLine}</span>}
                          </header>
                          <p>{item.body}</p>
                          <time>{formatDate(item.createdAt)}</time>
                        </article>
                      ))}
                    </section>
                  </aside>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <AssignmentDetailModal
        assignment={detailAssignment}
        now={now}
        queued={detailAssignment !== null && queuedAssignmentIds.has(detailAssignment.id)}
        submitting={detailAssignment !== null && submittingId === detailAssignment.id}
        onClose={() => setDetailId(null)}
        onOpenFile={(assignment) => {
          setDetailId(null)
          void openAssignmentFile(assignment)
        }}
        onSubmit={(assignment) => void submitAssignment(assignment)}
      />

      <IntegrityDemo open={demoOpen} onClose={() => setDemoOpen(false)} />

      {joinOpen && (
        <JoinClassModal onClose={() => setJoinOpen(false)} onJoined={() => onJoinedClass()} />
      )}

      {inviteOpen && (
        <ProfessorInviteModal
          onClose={() => setInviteOpen(false)}
          onRedeemed={onProfessorInviteRedeemed}
        />
      )}
    </div>
  )
}
