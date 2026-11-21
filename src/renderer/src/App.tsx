import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Command,
  Download,
  FilePlus2,
  FileText,
  Info,
  Keyboard,
  LayoutDashboard,
  List,
  LogOut,
  Map as MapIcon,
  MessageSquare,
  RefreshCw,
  Save,
  SaveAll,
  WrapText
} from 'lucide-react'
import AppearancePanel from './components/AppearancePanel'
import AssessmentBar from './components/AssessmentBar'
import AssessmentWarningModal from './components/AssessmentWarningModal'
import ConfirmDialog from './components/ConfirmDialog'
import EditorPane from './components/EditorPane'
import MenuBar from './components/MenuBar'
import HelpModal from './components/HelpModal'
import NewFileModal from './components/NewFileModal'
import NewFolderModal from './components/NewFolderModal'
import BottomPanel from './components/BottomPanel'
import SearchBar from './components/SearchBar'
import SignInScreen from './components/SignInScreen'
import StudentDashboard from './components/StudentDashboard'
import StudentFeedbackModal from './components/StudentFeedbackModal'
import AdminConsoleNotice from './components/AdminConsoleNotice'
import ProfessorDashboard from './components/professor/ProfessorDashboard'
import type { QuickOpenCommand } from './components/SearchBar'
import StatusBar from './components/StatusBar'
import TitleBarControls from './components/TitleBarControls'
import WorkspacePanel from './components/WorkspacePanel'
import { ThemeProvider } from './themes/ThemeProvider'
import { FontProvider } from './fonts/FontProvider'
import { useCodeTracker } from './hooks/useCodeTracker'
import { useToolchainStatus } from './hooks/useToolchainStatus'
import { useEnrolledCourses } from './hooks/useEnrolledCourses'
import { useProfileRole } from './hooks/useProfileRole'
import { useSupabaseSession } from './hooks/useSupabaseSession'
import { useStudentAssignments } from './hooks/useStudentAssignments'
import { useStudentPresence } from './hooks/useStudentPresence'
import { useTimedAssessment } from './hooks/useTimedAssessment'
import { professorInviteClaimInProgress, redeemProfessorInvite } from './lib/professorInvites'
import { supabase } from './lib/supabase'
import { languageFromName } from './lib/languages'
import { fileNameForAssignment } from './lib/assignments'
import {
  enqueueSubmission,
  isNetworkError,
  listPendingSubmissions,
  recordPendingFailure,
  removePendingSubmission
} from './lib/submissionQueue'
import { submitAssignment } from './lib/studentAssignments'
import { defaultSavePath, fileDisplayName, workspaceNameFor } from './lib/workspace'
import type { EditorCommands, EditorViewOptions } from './components/EditorPane'
import type { CodeAnalysis } from './lib/codeAnalysis'
import type { LabFile } from './types/tracker'
import type { AssessmentSubmissionResult } from './types/assessment'
import type { StudentAssignment } from './types/student'
import type { AssignmentFileResult, WorkspaceListing } from '../../shared/workspace'
import './index.css'

// Persisted sidebar width and student view.
const SIDEBAR_WIDTH_KEY = 'unicode-lab.sidebarWidth'

// Which student surface is visible. The dashboard owns the first paint after
// sign-in; the editor is opened explicitly (or by opening an assignment).
type StudentView = 'dashboard' | 'workspace'

interface StudentViewState {
  userId: string
  view: StudentView
}

// The first-launch tab. It lives only in memory until the student saves it,
// which teaches the workspace flow without writing files behind their back.
const INITIAL_FILES: LabFile[] = [
  {
    name: 'welcome.md',
    language: 'markdown',
    initialContent: [
      '# Welcome to Unicode Lab',
      '',
      'This editor works on real files in your workspace folder.',
      '',
      '- Sign in and a folder appears for every class you are enrolled in',
      '- Open a file from the sidebar, or use File > Open File…',
      '- Ctrl+S saves the active file to disk',
      '- Your workspace lives in Documents\\Unicode Lab',
      '- The folder icon at the top of the sidebar collapses it to icons',
      '',
      'Your edits are still captured as time-travel snapshots, and paste',
      'activity is recorded for academic-integrity analytics.',
      ''
    ].join('\n')
  }
]

/** Human-readable message from an IPC rejection. */
function fsErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Electron wraps main-process errors with this prefix; strip it so the
    // sidebar shows just the useful sentence.
    const match = error.message.match(/Error: (.+)$/)
    return match ? match[1] : error.message
  }
  return 'Something went wrong while working with the filesystem.'
}

/** Keeps tab keys unique when two different paths share a basename. */
function uniqueFileName(base: string, files: LabFile[]): string {
  if (!files.some((file) => file.name === base)) return base
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const extension = dot > 0 ? base.slice(dot) : ''
  let index = 2
  while (files.some((file) => file.name === `${stem} (${index})${extension}`)) index += 1
  return `${stem} (${index})${extension}`
}

/** Windows paths are case-insensitive; compare them that way. */
function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase()
}

export default function App(): React.ReactElement {
  const { session, loading: sessionLoading } = useSupabaseSession()
  const {
    role: profileRole,
    loading: roleLoading,
    reload: reloadProfileRole
  } = useProfileRole(session)
  const attemptedInviteRef = useRef<string | null>(null)

  // A production sign-up may need email confirmation before the invite can be
  // redeemed. The registration form stores the code in user metadata; claim it
  // once the confirmed user signs in.
  useEffect(() => {
    const pendingInvite = session?.user.user_metadata?.professor_invite_code
    if (
      !session ||
      profileRole !== 'student' ||
      typeof pendingInvite !== 'string' ||
      !pendingInvite.trim() ||
      professorInviteClaimInProgress() ||
      attemptedInviteRef.current === pendingInvite
    ) {
      return
    }

    attemptedInviteRef.current = pendingInvite
    let cancelled = false
    void redeemProfessorInvite(pendingInvite)
      .then(async () => {
        if (cancelled) return
        await supabase?.auth
          .updateUser({ data: { professor_invite_code: null } })
          .catch(() => undefined)
        reloadProfileRole()
      })
      .catch((error) => {
        console.warn('[invite] deferred redemption failed:', error)
      })
    return () => {
      cancelled = true
    }
  }, [session, profileRole, reloadProfileRole])

  // The open tabs. Files opened from the workspace carry their absolute
  // path; New File… tabs are untitled until the first save.
  const [files, setFiles] = useState<LabFile[]>(INITIAL_FILES)
  const fileNames = useMemo(() => files.map((file) => file.name), [files])

  // Dirties a tab on the first edit after a save. Returning `prev` when the
  // tab is already dirty keeps keystrokes from re-rendering the app tree.
  const markFileDirty = useCallback((name: string): void => {
    setFiles((prev) => {
      const target = prev.find((file) => file.name === name)
      if (!target || target.dirty) return prev
      return prev.map((file) => (file.name === name ? { ...file, dirty: true } : file))
    })
  }, [])

  const tracker = useCodeTracker({
    session,
    labId: null,
    fileNames,
    onModelChange: markFileDirty
  })

  // Timed assessment state. The server owns the deadline; this only displays
  // the countdown, autosaves drafts, and asks the server to finalize on time.
  const [activeAssessment, setActiveAssessment] = useState<StudentAssignment | null>(null)
  const [assessmentWarning, setAssessmentWarning] = useState<string | null>(null)
  const activeAssessmentRef = useRef<StudentAssignment | null>(null)
  const assessmentFileRef = useRef<{ key: string | null; path: string | null }>({
    key: null,
    path: null
  })
  const pendingAssessmentDraftRef = useRef<{ key: string; content: string } | null>(null)
  const lastAssessmentContentRef = useRef<string | null>(null)

  // Workspace state: the chosen root folder and its current listing.
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceListing | null>(null)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)

  // Enrolled classes drive the course folders — no manual folder setup.
  const enrolled = useEnrolledCourses(session)
  // Assignments power the dashboard, the active-assignment panel, and submit.
  const studentAssignments = useStudentAssignments(session)
  const reloadAssignments = studentAssignments.reload
  const enrollmentNames = useMemo(
    () =>
      enrolled.courses
        .map((course) => course.code?.trim() || course.title.trim())
        .filter((name) => name.length > 0),
    [enrolled.courses]
  )

  const [activeFile, setActiveFile] = useState(INITIAL_FILES[0].name)
  const lastPasteAt = useMemo(() => {
    let latest = 0
    for (const pastes of Object.values(tracker.pastesByFile)) {
      for (const paste of pastes) {
        const at = Date.parse(paste.created_at) || 0
        if (at > latest) latest = at
      }
    }
    return latest > 0 ? latest : null
  }, [tracker.pastesByFile])

  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [submitConfirmation, setSubmitConfirmation] = useState<StudentAssignment | null>(null)
  const submitConfirmationResolver = useRef<((confirmed: boolean) => void) | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [studentViewState, setStudentViewState] = useState<StudentViewState | null>(null)

  const sessionUserId = session?.user.id ?? null
  // Transient confirmation ("Assignment submitted.") shared by both views.
  const showToast = useCallback((message: string): void => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  const requestSubmitConfirmation = useCallback(
    (assignment: StudentAssignment): Promise<boolean> => {
      if (submitConfirmationResolver.current) return Promise.resolve(false)
      return new Promise<boolean>((resolve) => {
        submitConfirmationResolver.current = resolve
        setSubmitConfirmation(assignment)
      })
    },
    []
  )

  const finishSubmitConfirmation = useCallback((confirmed: boolean): void => {
    const resolve = submitConfirmationResolver.current
    submitConfirmationResolver.current = null
    setSubmitConfirmation(null)
    resolve?.(confirmed)
  }, [])

  const readAssessmentContent = useCallback(async (): Promise<string | null> => {
    const target = assessmentFileRef.current
    let content: string | null = null
    if (target.key) {
      content = tracker.getModelValue(target.key)
    }
    // If the student closed the tab, the last synced content is closer to the
    // truth than the possibly stale file on disk.
    if (content === null) content = lastAssessmentContentRef.current
    if (content === null && target.path) {
      try {
        content = await window.api.fs.readFile(target.path)
      } catch {
        return null
      }
    }
    if (content !== null) lastAssessmentContentRef.current = content
    return content
  }, [tracker])

  const handleAssessmentSubmitted = useCallback(
    (result: AssessmentSubmissionResult, reason: 'manual' | 'auto'): void => {
      setActiveAssessment(null)
      activeAssessmentRef.current = null
      assessmentFileRef.current = { key: null, path: null }
      lastAssessmentContentRef.current = null
      setAssessmentWarning(null)
      showToast(
        result.status === 'auto_submitted' || reason === 'auto'
          ? 'Time is up — the latest saved draft was submitted.'
          : 'Seatwork submitted.'
      )
      reloadAssignments()
    },
    [showToast, reloadAssignments]
  )

  const timedAssessment = useTimedAssessment({
    readContent: readAssessmentContent,
    onSubmitted: handleAssessmentSubmitted,
    onWarning: setAssessmentWarning
  })

  useEffect(() => {
    activeAssessmentRef.current = activeAssessment
  }, [activeAssessment])

  // Monaco models are created one render after a tab is added. If a draft was
  // restored before the model existed, retry on each render until it lands.
  useEffect(() => {
    const pending = pendingAssessmentDraftRef.current
    if (!pending) return
    if (tracker.setModelValue(pending.key, pending.content)) {
      pendingAssessmentDraftRef.current = null
    }
  })

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  // Opening feedback clears the unread badge for every entry point.
  const openStudentFeedback = (): void => {
    setFeedbackOpen(true)
  }
  // A new sign-in always starts on the dashboard. The stored view is scoped
  // to the user, so switching accounts never reopens the previous workspace.
  const studentView: StudentView =
    sessionUserId !== null && studentViewState?.userId === sessionUserId
      ? studentViewState.view
      : 'dashboard'

  const showStudentView = (view: StudentView): void => {
    if (!sessionUserId) return
    // Monaco keeps focus behind the dashboard overlay; drop it so keystrokes
    // cannot edit a hidden file.
    if (view === 'dashboard') (document.activeElement as HTMLElement | null)?.blur()
    setStudentViewState({ userId: sessionUserId, view })
    if (view === 'workspace') {
      requestAnimationFrame(() => editorCommandsRef.current?.focus())
    }
  }

  useStudentPresence(session, profileRole, activeFile, lastPasteAt, studentView === 'workspace')
  const [newFileOpen, setNewFileOpen] = useState(false)
  // Course/project folder the pending New File dialog targets (null = untitled tab).
  const [newFileDir, setNewFileDir] = useState<string | null>(null)
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null)
  const [previewRefreshToken, setPreviewRefreshToken] = useState(0)
  const [helpModal, setHelpModal] = useState<'shortcuts' | 'about' | null>(null)
  const [cursor, setCursor] = useState<{ lineNumber: number; column: number } | null>(null)
  const [activeAnalysis, setActiveAnalysis] = useState<CodeAnalysis | null>(null)

  // Editor commands for the menu bar, populated when the editor mounts.
  const editorCommandsRef = useRef<EditorCommands | null>(null)

  // Quick-open search input (Ctrl+P focuses it).
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // View-menu toggles; owned here so the menu checkmarks stay truthful.
  const [viewOptions, setViewOptions] = useState<EditorViewOptions>({
    minimap: false,
    wordWrap: false,
    lineNumbers: true
  })

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
    return Number.isFinite(stored) && stored >= 190 ? Math.min(460, stored) : 250
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('unicode-lab.sidebarCollapsed') === '1'
  )
  const [focusedCourse, setFocusedCourse] = useState<string | null>(null)

  const toggleSidebar = (): void => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      localStorage.setItem('unicode-lab.sidebarCollapsed', next ? '1' : '0')
      return next
    })
  }

  const openClassFiles = (course: { code: string | null; title: string }): void => {
    setFocusedCourse(course.code?.trim() || course.title)
    setSidebarCollapsed(false)
    localStorage.setItem('unicode-lab.sidebarCollapsed', '0')
    showStudentView('workspace')
  }

  const handleJoinedClass = (): void => {
    enrolled.reload()
    studentAssignments.reload()
    void refreshWorkspace()
    showToast('Joined class.')
  }

  const startSidebarResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    document.body.classList.add('sidebar-resizing')
    const startX = event.clientX
    const startWidth = sidebarWidth
    let latestWidth = startWidth
    const handleMove = (moveEvent: PointerEvent): void => {
      latestWidth = Math.min(460, Math.max(190, startWidth + (moveEvent.clientX - startX)))
      setSidebarWidth(latestWidth)
    }
    const handleUp = (): void => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      document.body.classList.remove('sidebar-resizing')
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(latestWidth))
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const activeFileSnapshots = tracker.snapshotsByFile[activeFile] ?? []
  const activeFilePastes = tracker.pastesByFile[activeFile] ?? []
  const activeLanguage = files.find((file) => file.name === activeFile)?.language ?? 'plaintext'
  const toolchain = useToolchainStatus(activeLanguage)

  // The bottom panel uses the assignment whose workspace file is active.
  const activeAssignment = useMemo(() => {
    const key = activeFile.toLowerCase()
    const base = fileDisplayName(activeFile).toLowerCase()
    const exact = studentAssignments.assignments.find((assignment) => {
      const folder = (assignment.classCode || assignment.className).toLowerCase()
      const fileName = fileNameForAssignment(assignment).toLowerCase()
      return key === `${folder}/${fileName}`
    })
    if (exact) return exact
    return (
      studentAssignments.assignments.find(
        (assignment) => fileNameForAssignment(assignment).toLowerCase() === base
      ) ?? null
    )
  }, [activeFile, studentAssignments.assignments])

  const handleSelectFile = (name: string): void => {
    setActiveFile(name)
    setCursor(null)
    setActiveAnalysis(null)
  }

  const refreshWorkspace = useCallback(
    async (root: string | null = workspaceRoot): Promise<void> => {
      if (!root) return
      try {
        setWorkspace(await window.api.fs.listWorkspace(root))
        setWorkspaceError(null)
      } catch (error) {
        setWorkspaceError(fsErrorMessage(error))
      }
    },
    [workspaceRoot]
  )

  // Read a file from disk into a new tab (or focus its existing tab).
  const openFileFromDisk = async (filePath: string): Promise<string | null> => {
    const existing = files.find((file) => file.path === filePath)
    if (existing) {
      handleSelectFile(existing.name)
      return existing.name
    }
    try {
      const content = await window.api.fs.readFile(filePath)
      const base = workspaceNameFor(workspaceRoot, filePath)
      const name = uniqueFileName(base, files)
      setFiles((prev) =>
        prev.some((file) => file.name === name)
          ? prev
          : [
              ...prev,
              {
                name,
                path: filePath,
                language: languageFromName(name),
                initialContent: content
              }
            ]
      )
      handleSelectFile(name)
      setWorkspaceError(null)
      return name
    } catch (error) {
      setWorkspaceError(fsErrorMessage(error))
      return null
    }
  }

  const handleOpenFileDialog = async (): Promise<void> => {
    try {
      const picked = await window.api.fs.pickFile()
      if (picked) await openFileFromDisk(picked)
    } catch (error) {
      setWorkspaceError(fsErrorMessage(error))
    }
  }

  // A submission and an "open file" both need the assignment's workspace
  // file to exist; starter code only seeds files that don't exist yet.
  const prepareAssignmentFile = async (
    assignment: StudentAssignment
  ): Promise<AssignmentFileResult> => {
    if (!workspaceRoot) {
      throw new Error('The workspace is still loading. Try again in a moment.')
    }
    try {
      const file = await window.api.fs.ensureAssignmentFile(
        workspaceRoot,
        assignment.classCode.trim() || assignment.className,
        fileNameForAssignment(assignment),
        assignment.starterCode ?? ''
      )
      await refreshWorkspace()
      return file
    } catch (error) {
      throw new Error(fsErrorMessage(error), { cause: error })
    }
  }

  const handleStartAssessment = async (assignment: StudentAssignment): Promise<void> => {
    if (!session) throw new Error('Sign in to start this assessment.')

    // Fullscreen needs to be requested inside the click gesture before any
    // awaited work. Failure is reported by the bar, not a hard start blocker.
    if (assignment.kind === 'seatwork' && assignment.fullscreenRequired) {
      void timedAssessment.enterFullscreen()
    }

    const current = activeAssessmentRef.current
    if (current && current.id !== assignment.id) {
      throw new Error(`Finish or submit “${current.title}” before starting another assessment.`)
    }
    const otherActive = studentAssignments.assignments.find(
      (item) => item.id !== assignment.id && item.session?.status === 'active'
    )
    if (otherActive) {
      throw new Error(`Finish or submit “${otherActive.title}” before starting another assessment.`)
    }

    const started = await timedAssessment.start(assignment.id)
    if (started.status !== 'active') {
      throw new Error('This assessment is no longer active.')
    }

    const file = await prepareAssignmentFile(assignment)
    // The server draft is authoritative after a crash. Mirror it to disk so a
    // newly opened tab starts on the same content the session will submit.
    await window.api.fs.writeFile(file.path, started.draftContent)

    const existing = files.find((item) => item.path && samePath(item.path, file.path))
    let key: string
    if (existing) {
      if (!tracker.setModelValue(existing.name, started.draftContent)) {
        pendingAssessmentDraftRef.current = {
          key: existing.name,
          content: started.draftContent
        }
      }
      setFiles((previous) =>
        previous.map((item) =>
          item.name === existing.name ? { ...item, initialContent: started.draftContent } : item
        )
      )
      handleSelectFile(existing.name)
      key = existing.name
    } else {
      const opened = await openFileFromDisk(file.path)
      if (!opened) throw new Error('Could not open the assessment file.')
      key = opened
    }

    assessmentFileRef.current = { key, path: file.path }
    lastAssessmentContentRef.current = started.draftContent
    setActiveAssessment(assignment)
    reloadAssignments()
    showStudentView('workspace')
    showToast(assignment.session ? 'Assessment resumed.' : 'Assessment started — timer running.')
  }

  const handleSubmitTimedAssessment = async (): Promise<void> => {
    try {
      await timedAssessment.submit('manual')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not submit the assessment.')
    }
  }

  const handleOpenAssignmentFile = async (assignment: StudentAssignment): Promise<void> => {
    const file = await prepareAssignmentFile(assignment)
    const key = await openFileFromDisk(file.path)
    if (!key) throw new Error('Could not open the assignment file.')
    showStudentView('workspace')
  }

  const handleSubmitAssignment = async (assignment: StudentAssignment): Promise<void> => {
    if (!session) throw new Error('Sign in to submit an assignment.')
    const confirmed = await requestSubmitConfirmation(assignment)
    if (!confirmed) return
    const file = await prepareAssignmentFile(assignment)
    const openTab = files.find((item) => item.path && samePath(item.path, file.path))
    const key = openTab?.name ?? file.fileName

    let content: string
    if (openTab) {
      // Submit the live editor content, and capture it immediately so the
      // trailing edits are part of this submission's snapshot set.
      const live = tracker.getModelValue(openTab.name)
      if (live === null) throw new Error('The assignment file is still opening. Try again.')
      content = live
      tracker.captureCurrent(openTab.name)
      await tracker.flush(openTab.name)
    } else {
      try {
        content = await window.api.fs.readFile(file.path)
      } catch (error) {
        throw new Error(fsErrorMessage(error), { cause: error })
      }
      await tracker.flush()
    }

    const clientToken = crypto.randomUUID()
    try {
      await submitAssignment({
        assignmentId: assignment.id,
        fileName: key,
        content,
        clientToken
      })
      showToast(`Submitted ${assignment.title}`)
    } catch (error) {
      if (isNetworkError(error)) {
        const queued = enqueueSubmission({
          token: clientToken,
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          fileName: key,
          content,
          createdAt: new Date().toISOString(),
          attempts: 1,
          lastError: error instanceof Error ? error.message : null
        })
        if (queued) {
          showToast('Submission queued — it will send when you are back online.')
          return
        }
      }
      throw error
    }
  }

  // Retry queued submissions when the app restarts or the network returns.
  const retryingQueued = useRef(false)
  const trackerRef = useRef(tracker)
  useEffect(() => {
    trackerRef.current = tracker
  })

  const retryQueuedSubmissions = useCallback(async (): Promise<void> => {
    if (!session || retryingQueued.current) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const pending = listPendingSubmissions()
    if (pending.length === 0) return

    retryingQueued.current = true
    let sent = false
    try {
      // Upload any snapshots captured while offline first, so the server can
      // attach them to this submission instead of the next one.
      try {
        await trackerRef.current.flush()
      } catch {
        // Snapshots retry on their own; the queued content is still enough.
      }

      for (const entry of pending) {
        if (entry.attempts >= 3) continue
        try {
          await submitAssignment({
            assignmentId: entry.assignmentId,
            fileName: entry.fileName,
            content: entry.content,
            clientToken: entry.token
          })
          removePendingSubmission(entry.token)
          sent = true
          showToast(`Queued submission sent: ${entry.assignmentTitle}`)
        } catch (error) {
          if (isNetworkError(error)) break
          const message = error instanceof Error ? error.message : 'Unknown error'
          recordPendingFailure(entry.token, message)
          showToast(`Queued submission needs attention: ${message}`)
        }
      }
    } finally {
      retryingQueued.current = false
      if (sent) reloadAssignments()
    }
  }, [session, showToast, reloadAssignments])

  useEffect(() => {
    void retryQueuedSubmissions()
    const handleOnline = (): void => {
      void retryQueuedSubmissions()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [retryQueuedSubmissions])

  // Save As runs first so Save can fall back to it for untitled files.
  const saveFileAs = async (name: string = activeFile): Promise<boolean> => {
    const file = files.find((item) => item.name === name)
    if (!file) return false
    const content = tracker.getModelValue(name) ?? file.initialContent
    let target: string | null = null
    try {
      target = await window.api.fs.saveFileAs(
        defaultSavePath(workspaceRoot, file.path, name),
        content
      )
    } catch (error) {
      setWorkspaceError(fsErrorMessage(error))
      return false
    }
    if (!target) return false

    const newName = workspaceNameFor(workspaceRoot, target)
    if (newName === name) {
      // Saved over itself: keep the tab (and its undo stack) in place.
      setFiles((prev) =>
        prev.map((item) =>
          item.name === name
            ? { ...item, path: target, initialContent: content, dirty: false }
            : item
        )
      )
    } else {
      setFiles((prev) => [
        // Drop the old entry, and any tab that already owned the target name.
        ...prev.filter((item) => item.name !== name && item.name !== newName),
        {
          ...file,
          name: newName,
          path: target,
          language: languageFromName(newName),
          initialContent: content,
          dirty: false
        }
      ])
      setActiveFile(newName)
    }
    setWorkspaceError(null)
    void refreshWorkspace()
    return true
  }

  const saveFile = async (name: string = activeFile): Promise<boolean> => {
    const file = files.find((item) => item.name === name)
    if (!file) return false
    const content = tracker.getModelValue(name)
    if (content === null) return false
    // Untitled tab: the first save is a Save As.
    if (!file.path) return saveFileAs(name)
    try {
      await window.api.fs.writeFile(file.path, content)
      setFiles((prev) =>
        prev.map((item) => (item.name === name ? { ...item, dirty: false } : item))
      )
      setWorkspaceError(null)
      return true
    } catch (error) {
      setWorkspaceError(fsErrorMessage(error))
      return false
    }
  }

  const handleCloseFile = async (name: string): Promise<void> => {
    // The workspace always keeps at least one tab open.
    if (files.length <= 1) return
    const file = files.find((item) => item.name === name)
    if (file?.dirty) {
      const choice = await window.api.fs.confirmClose(file.name)
      if (choice === 'cancel') return
      if (choice === 'save' && !(await saveFile(name))) return
    }
    const index = files.findIndex((item) => item.name === name)
    const remaining = files.filter((item) => item.name !== name)
    setFiles(remaining)
    if (name === activeFile) {
      // Move to the adjacent tab (right neighbor, else the left one).
      const neighbor = remaining[Math.min(index, remaining.length - 1)]
      if (neighbor) handleSelectFile(neighbor.name)
    }
  }

  const openNewFileDialog = (dir: string | null = null): void => {
    setNewFileDir(dir)
    setNewFileOpen(true)
  }

  const openNewFolderDialog = (parent: string): void => {
    setNewFolderParent(parent)
  }

  // Renaming keeps the tab open: the model is rebuilt from its live content
  // under the new key, and its on-disk path is replaced.
  const handleRenameFile = async (filePath: string, nextName: string): Promise<void> => {
    if (!workspaceRoot) return
    const target = files.find((file) => file.path && samePath(file.path, filePath))
    try {
      const liveContent = target ? tracker.getModelValue(target.name) : null
      const newPath = await window.api.fs.renameFile(filePath, nextName)
      await refreshWorkspace()
      if (target) {
        const base = workspaceNameFor(workspaceRoot, newPath)
        const others = files.filter((file) => file.name !== target.name)
        const newKey = uniqueFileName(base, others)
        setFiles((prev) =>
          prev.map((file) =>
            file.name === target.name
              ? {
                  ...file,
                  name: newKey,
                  path: newPath,
                  language: languageFromName(newKey),
                  initialContent: liveContent ?? file.initialContent
                }
              : file
          )
        )
        if (activeFile === target.name) setActiveFile(newKey)
      }
      setWorkspaceError(null)
      showToast(`Renamed to ${nextName.trim()}`)
    } catch (error) {
      setWorkspaceError(fsErrorMessage(error))
    }
  }

  const handleDeleteFile = async (filePath: string): Promise<void> => {
    const displayName = fileDisplayName(filePath)
    const openTab = files.find((file) => file.path && samePath(file.path, filePath))
    if (openTab && files.length <= 1) {
      setWorkspaceError('Open another file before deleting the last open tab.')
      return
    }
    try {
      const confirmed = await window.api.ui.confirm({
        title: 'Delete File',
        message: `Delete "${displayName}"?`,
        detail: openTab?.dirty
          ? 'The file is permanently removed and the unsaved changes in its open tab will be lost.'
          : 'The file is permanently removed from your workspace. This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true
      })
      if (!confirmed) return

      await window.api.fs.deleteFile(filePath)
      if (openTab) {
        const index = files.findIndex((file) => file.name === openTab.name)
        const remaining = files.filter((file) => file.name !== openTab.name)
        setFiles(remaining)
        if (openTab.name === activeFile) {
          const neighbor = remaining[Math.min(index, remaining.length - 1)]
          if (neighbor) handleSelectFile(neighbor.name)
        }
      }
      await refreshWorkspace()
      setWorkspaceError(null)
      showToast(`Deleted ${displayName}`)
    } catch (error) {
      setWorkspaceError(fsErrorMessage(error))
    }
  }

  const handleCreateFile = async (name: string, language: string): Promise<string | null> => {
    if (newFileDir) {
      // Course folders get a real file immediately, so the Explorer stays
      // the source of truth for what exists on disk.
      try {
        const filePath = await window.api.fs.createFile(newFileDir, name)
        setNewFileOpen(false)
        setNewFileDir(null)
        await refreshWorkspace()
        await openFileFromDisk(filePath)
        return null
      } catch (error) {
        const message = fsErrorMessage(error)
        if (/exist/i.test(message)) return `"${name}" already exists in that folder.`
        return message
      }
    }
    // No destination folder: create an in-memory tab for the first save.
    const key = uniqueFileName(name, files)
    setFiles((prev) => [...prev, { name: key, language, initialContent: '' }])
    setNewFileOpen(false)
    handleSelectFile(key)
    return null
  }

  const handleCreateFolder = async (name: string): Promise<string | null> => {
    if (!newFolderParent) return null
    try {
      await window.api.fs.createFolder(newFolderParent, name)
      setNewFolderParent(null)
      await refreshWorkspace()
      setWorkspaceError(null)
      showToast(`Created folder ${name.trim()}.`)
      return null
    } catch (error) {
      const message = fsErrorMessage(error)
      if (/exist/i.test(message)) return `"${name.trim()}" already exists here.`
      return message
    }
  }

  const handleAddImages = async (dir: string): Promise<void> => {
    try {
      const imported = await window.api.fs.importImages(dir)
      if (imported.length === 0) return
      await refreshWorkspace()
      setPreviewRefreshToken((token) => token + 1)
      setWorkspaceError(null)
      showToast(
        imported.length === 1 ? `Added ${imported[0].name}.` : `Added ${imported.length} images.`
      )
    } catch (error) {
      setWorkspaceError(fsErrorMessage(error))
    }
  }

  const handleOpenImage = async (filePath: string): Promise<void> => {
    try {
      await window.api.fs.openPath(filePath)
    } catch (error) {
      setWorkspaceError(fsErrorMessage(error))
    }
  }

  const handleExportFile = (): void => {
    // Download the live editor content as a file (browser download API —
    // works identically in Electron and plain browser sessions).
    const content = tracker.getModelValue(activeFile)
    const blob = new Blob([content ?? ''], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileDisplayName(activeFile)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleToggleViewOption = (key: keyof EditorViewOptions): void => {
    setViewOptions((prev) => {
      if (key === 'minimap') return { ...prev, minimap: !prev.minimap }
      if (key === 'wordWrap') return { ...prev, wordWrap: !prev.wordWrap }
      return { ...prev, lineNumbers: !prev.lineNumbers }
    })
  }

  const handleReportIssue = (): void => {
    const url = 'https://github.com/Riven-nen/unicode-desktop/issues/new'
    // Prefer the OS browser via the preload bridge; fall back for plain
    // browser sessions where the bridge doesn't exist.
    if (window.api?.openExternal) void window.api.openExternal(url)
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Commands surfaced by the quick-open search (Ctrl+P). Only real
  // actions that exist today — no stubs.
  const searchCommands: QuickOpenCommand[] = [
    {
      id: 'new-file',
      label: 'New File…',
      shortcut: 'Ctrl+N',
      icon: <FilePlus2 size={13} />,
      run: () => openNewFileDialog()
    },
    {
      id: 'open-file',
      label: 'Open File…',
      shortcut: 'Ctrl+O',
      icon: <FileText size={13} />,
      run: () => void handleOpenFileDialog()
    },
    {
      id: 'refresh-workspace',
      label: 'Refresh Workspace',
      icon: <RefreshCw size={13} />,
      run: () => void refreshWorkspace()
    },
    {
      id: 'save-file',
      label: 'Save',
      shortcut: 'Ctrl+S',
      icon: <Save size={13} />,
      run: () => void saveFile()
    },
    {
      id: 'save-file-as',
      label: 'Save As…',
      shortcut: 'Ctrl+Shift+S',
      icon: <SaveAll size={13} />,
      run: () => void saveFileAs()
    },
    {
      id: 'dashboard',
      label: 'Student Dashboard',
      icon: <LayoutDashboard size={13} />,
      run: () => showStudentView('dashboard')
    },
    {
      id: 'sync-now',
      label: 'Sync Now',
      icon: <RefreshCw size={13} />,
      run: () => tracker.flushNow()
    },
    {
      id: 'export-file',
      label: 'Export File…',
      icon: <Download size={13} />,
      run: handleExportFile
    },
    {
      id: 'toggle-minimap',
      label: 'Toggle Minimap',
      icon: <MapIcon size={13} />,
      run: () => handleToggleViewOption('minimap')
    },
    {
      id: 'toggle-word-wrap',
      label: 'Toggle Word Wrap',
      shortcut: 'Alt+Z',
      icon: <WrapText size={13} />,
      run: () => handleToggleViewOption('wordWrap')
    },
    {
      id: 'toggle-line-numbers',
      label: 'Toggle Line Numbers',
      icon: <List size={13} />,
      run: () => handleToggleViewOption('lineNumbers')
    },
    {
      id: 'command-palette',
      label: 'Command Palette',
      shortcut: 'Ctrl+Shift+P',
      icon: <Command size={13} />,
      run: () => editorCommandsRef.current?.commandPalette()
    },
    {
      id: 'keyboard-shortcuts',
      label: 'Keyboard Shortcuts…',
      icon: <Keyboard size={13} />,
      run: () => setHelpModal('shortcuts')
    },
    {
      id: 'about',
      label: 'About Unicode Lab',
      icon: <Info size={13} />,
      run: () => setHelpModal('about')
    }
  ]

  // Latest save/open callbacks for the window-level shortcut handler. The
  // ref indirection keeps the keydown listener from re-binding on every
  // keystroke (saveFile closes over live tab content).
  const shortcutsRef = useRef({
    save: (): void => undefined,
    saveAs: (): void => undefined,
    openFile: (): void => undefined
  })
  useEffect(() => {
    shortcutsRef.current = {
      save: () => void saveFile(),
      saveAs: () => void saveFileAs(),
      openFile: () => void handleOpenFileDialog()
    }
  })

  // Resolve the fixed student workspace (Documents/Unicode Lab) once.
  useEffect(() => {
    let cancelled = false
    void window.api.fs
      .bootstrapWorkspace()
      .then(async (root) => {
        if (cancelled) return
        setWorkspaceRoot(root)
        try {
          const listing = await window.api.fs.listWorkspace(root)
          if (!cancelled) setWorkspace(listing)
        } catch (error) {
          if (!cancelled) setWorkspaceError(fsErrorMessage(error))
        }
      })
      .catch((error) => {
        if (!cancelled) setWorkspaceError(fsErrorMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Create/refresh one folder per enrolled course whenever the student signs
  // in or switches workspace. Idempotent: existing folders are reused.
  useEffect(() => {
    if (!workspaceRoot || enrollmentNames.length === 0) return
    let cancelled = false
    void window.api.fs
      .ensureCourses(workspaceRoot, enrollmentNames)
      .then((listing) => {
        if (cancelled) return
        setWorkspace(listing)
        setWorkspaceError(null)
      })
      .catch((error) => {
        if (!cancelled) setWorkspaceError(fsErrorMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [workspaceRoot, enrollmentNames])

  // Window-level shortcuts only apply to the student editor — never to the
  // sign-in screen, student dashboard, or professor dashboard.
  const editorActive =
    session !== null && !roleLoading && profileRole !== 'professor' && studentView === 'workspace'

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!editorActive) return
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 's' && event.shiftKey) {
        event.preventDefault()
        shortcutsRef.current.saveAs()
      } else if (key === 's') {
        event.preventDefault()
        shortcutsRef.current.save()
      } else if (key === 'o') {
        event.preventDefault()
        shortcutsRef.current.openFile()
      } else if (key === 'n' && !event.shiftKey) {
        event.preventDefault()
        setNewFileDir(null)
        setNewFileOpen(true)
      } else if (key === 'p' && !event.shiftKey) {
        // Ctrl+P opens the quick-open search.
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      } else if (key === 'p' && event.shiftKey) {
        event.preventDefault()
        editorCommandsRef.current?.commandPalette()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editorActive])

  const handleSignOut = (): void => {
    void timedAssessment.saveNow()
    timedAssessment.reset()
    setActiveAssessment(null)
    activeAssessmentRef.current = null
    setAssessmentWarning(null)
    assessmentFileRef.current = { key: null, path: null }
    lastAssessmentContentRef.current = null
    setStudentViewState(null)
    void supabase?.auth.signOut()
  }

  return (
    <ThemeProvider>
      <FontProvider>
        {sessionLoading || (session !== null && roleLoading) ? (
          <SignInScreen loading onProfessorInviteRedeemed={reloadProfileRole} />
        ) : !session ? (
          <SignInScreen onProfessorInviteRedeemed={reloadProfileRole} />
        ) : profileRole === 'admin' ? (
          <AdminConsoleNotice onSignOut={handleSignOut} />
        ) : profileRole === 'professor' ? (
          <ProfessorDashboard session={session} onSignOut={handleSignOut} />
        ) : (
          <>
            <div className="app-container">
              {/* Custom title bar / top navigation (draggable frameless region) */}
              <nav className="top-nav">
                <div className="nav-logo">
                  <div className="logo-icon"></div>
                  Unicode
                </div>
                <MenuBar
                  commandsRef={editorCommandsRef}
                  onNewFile={() => openNewFileDialog()}
                  onOpenFile={() => void handleOpenFileDialog()}
                  onRefreshWorkspace={() => void refreshWorkspace()}
                  onSave={() => void saveFile()}
                  onSaveAs={() => void saveFileAs()}
                  onSyncNow={() => tracker.flushNow()}
                  onExportFile={handleExportFile}
                  viewOptions={viewOptions}
                  onToggleViewOption={handleToggleViewOption}
                  onShowShortcuts={() => setHelpModal('shortcuts')}
                  onShowAbout={() => setHelpModal('about')}
                  onReportIssue={handleReportIssue}
                />

                <SearchBar
                  files={files}
                  onSelectFile={handleSelectFile}
                  commands={searchCommands}
                  inputRef={searchInputRef}
                />

                <div className="nav-right">
                  {session && (
                    <button
                      className="nav-dashboard-btn"
                      onClick={() => showStudentView('dashboard')}
                      title="Back to your classes dashboard"
                    >
                      <LayoutDashboard size={13} />
                      Dashboard
                    </button>
                  )}
                  <div
                    className="tracking-indicator"
                    title="Editing and paste activity is being recorded for this lab."
                  >
                    <span className="status-dot recording"></span>
                    Tracking active
                  </div>
                  {session && (
                    <button
                      className="nav-icon-btn"
                      onClick={openStudentFeedback}
                      title="Feedback from your professor"
                    >
                      <MessageSquare size={14} />
                    </button>
                  )}
                  {session && (
                    <>
                      <span className="nav-user">{session.user.email}</span>
                      <button className="nav-icon-btn" onClick={handleSignOut} title="Sign out">
                        <LogOut size={14} />
                      </button>
                    </>
                  )}
                  <AppearancePanel />
                </div>
                {/* Direct child of the bar (outside .nav-right) so the controls sit
              flush against the window's right edge and the close button's
              red hover fills the top-right corner like a native title bar. */}
                <TitleBarControls />
              </nav>

              <div className="main-layout">
                {/* Sidebar: real workspace tree */}
                <WorkspacePanel
                  width={sidebarWidth}
                  collapsed={sidebarCollapsed}
                  onToggleCollapsed={toggleSidebar}
                  focusCourse={focusedCourse}
                  root={workspaceRoot}
                  listing={workspace}
                  error={workspaceError}
                  activeFile={activeFile}
                  onOpenFile={(filePath) => void openFileFromDisk(filePath)}
                  onOpenImage={(filePath) => void handleOpenImage(filePath)}
                  onNewFileInFolder={(folderPath) => openNewFileDialog(folderPath)}
                  onNewFolder={openNewFolderDialog}
                  onAddImages={(folderPath) => void handleAddImages(folderPath)}
                  onRenameFile={handleRenameFile}
                  onDeleteFile={handleDeleteFile}
                  onRefresh={() => void refreshWorkspace()}
                  signedIn={session !== null}
                  coursesLoading={enrolled.loading}
                  outline={activeAnalysis}
                  onRevealSymbol={(line, column) => editorCommandsRef.current?.reveal(line, column)}
                />

                {!sidebarCollapsed && (
                  <div
                    className="sidebar-resizer"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize workspace sidebar"
                    onPointerDown={startSidebarResize}
                  />
                )}

                {/* Editor & Terminal */}
                <main className="editor-area">
                  {activeAssessment && (
                    <AssessmentBar
                      assignment={activeAssessment}
                      session={timedAssessment.session}
                      remainingMs={timedAssessment.remainingMs}
                      saving={timedAssessment.saving}
                      submitting={timedAssessment.submitting}
                      error={timedAssessment.error}
                      onOpenFile={() => void handleOpenAssignmentFile(activeAssessment)}
                      onSubmit={() => void handleSubmitTimedAssessment()}
                      onEnterFullscreen={() => void timedAssessment.enterFullscreen()}
                    />
                  )}
                  {toolchain.status?.required && !toolchain.status.available && (
                    <div className="toolchain-banner" role="status">
                      <AlertTriangle size={14} />
                      <div className="toolchain-banner-copy">
                        <strong>{toolchain.status.label} not found</strong>
                        <span>
                          Missing {toolchain.status.missing.join(', ')}. {toolchain.status.hint} You
                          can still edit this file and run tests through Judge0.
                        </span>
                      </div>
                      <button className="icon-text-btn" onClick={toolchain.recheck}>
                        Recheck
                      </button>
                    </div>
                  )}
                  <EditorPane
                    files={files}
                    activeFile={activeFile}
                    onSelectFile={handleSelectFile}
                    onCursorChange={setCursor}
                    tracker={tracker}
                    commandsRef={editorCommandsRef}
                    viewOptions={viewOptions}
                    onToggleWordWrap={() => handleToggleViewOption('wordWrap')}
                    onCloseFile={(name) => void handleCloseFile(name)}
                    onAnalysisChange={setActiveAnalysis}
                    blockPaste={timedAssessment.session?.blockPaste ?? false}
                    onBlockedPaste={() => {
                      void timedAssessment.recordEvent('paste_blocked')
                      showToast('Paste is blocked during this seatwork.')
                    }}
                  />

                  <BottomPanel
                    workspaceRoot={workspaceRoot}
                    activeFile={activeFile}
                    filePath={files.find((file) => file.name === activeFile)?.path ?? null}
                    language={activeLanguage}
                    toolchain={toolchain.status}
                    onRecheckToolchain={toolchain.recheck}
                    readSource={() => tracker.getModelValue(activeFile)}
                    assignment={activeAssignment}
                    previewRefreshToken={previewRefreshToken}
                    runOnlyTerminal={timedAssessment.session?.runOnlyTerminal ?? false}
                    onSubmit={async () => {
                      if (!activeAssignment) return
                      if (activeAssignment.timingMode !== 'none') {
                        if (activeAssessment?.id !== activeAssignment.id) {
                          await handleStartAssessment(activeAssignment)
                          return
                        }
                        await handleSubmitTimedAssessment()
                        return
                      }
                      await handleSubmitAssignment(activeAssignment)
                    }}
                    onSubmitted={() => studentAssignments.reload()}
                  />
                </main>
              </div>

              <StatusBar
                fileName={activeFile}
                language={activeLanguage}
                cursor={cursor}
                snapshotCount={activeFileSnapshots.length}
                pasteCount={activeFilePastes.length}
                syncStatus={tracker.syncStatus}
                analysisErrors={activeAnalysis?.diagnostics.length ?? null}
                toolchain={toolchain.status}
              />

              {newFileOpen && (
                <NewFileModal
                  existingNames={fileNames}
                  folderLabel={newFileDir ? fileDisplayName(newFileDir) : undefined}
                  onClose={() => {
                    setNewFileOpen(false)
                    setNewFileDir(null)
                  }}
                  onCreate={handleCreateFile}
                />
              )}

              {newFolderParent && (
                <NewFolderModal
                  parentLabel={fileDisplayName(newFolderParent)}
                  onClose={() => setNewFolderParent(null)}
                  onCreate={handleCreateFolder}
                />
              )}

              <HelpModal mode={helpModal} onClose={() => setHelpModal(null)} />

              <StudentFeedbackModal
                open={feedbackOpen}
                studentId={session?.user.id ?? null}
                onClose={() => setFeedbackOpen(false)}
              />
            </div>

            {session && (
              <StudentDashboard
                active={studentView === 'dashboard'}
                session={session}
                courses={enrolled.courses}
                coursesLoading={enrolled.loading}
                assignments={studentAssignments.assignments}
                loading={studentAssignments.loading}
                error={studentAssignments.error}
                reload={studentAssignments.reload}
                onOpenClassFiles={openClassFiles}
                onOpenAssignment={handleOpenAssignmentFile}
                onSubmitAssignment={handleSubmitAssignment}
                onStartAssessment={handleStartAssessment}
                onJoinedClass={handleJoinedClass}
                onOpenWorkspace={() => showStudentView('workspace')}
                onOpenFeedback={openStudentFeedback}
                onSignOut={handleSignOut}
              />
            )}

            {submitConfirmation && (
              <ConfirmDialog
                title="Submit Assignment"
                message={`Submit "${submitConfirmation.title}"?`}
                detail={`Your saved file content and snapshot history for ${submitConfirmation.classCode} will be sent to your professor.`}
                confirmLabel="Submit"
                onConfirm={() => finishSubmitConfirmation(true)}
                onCancel={() => finishSubmitConfirmation(false)}
              />
            )}

            {assessmentWarning && (
              <AssessmentWarningModal
                message={assessmentWarning}
                onClose={() => setAssessmentWarning(null)}
              />
            )}

            {toast && (
              <div className="app-toast" role="status" aria-live="polite">
                <CheckCircle2 size={14} />
                {toast}
              </div>
            )}
          </>
        )}
      </FontProvider>
    </ThemeProvider>
  )
}
