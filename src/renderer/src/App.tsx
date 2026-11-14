import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Command,
  Download,
  FilePlus2,
  FileText,
  FolderOpen,
  Info,
  Keyboard,
  List,
  LogIn,
  LogOut,
  Map as MapIcon,
  MessageSquare,
  RefreshCw,
  Save,
  SaveAll,
  WrapText
} from 'lucide-react'
import AppearancePanel from './components/AppearancePanel'
import AuthPanel from './components/AuthPanel'
import EditorPane from './components/EditorPane'
import MenuBar from './components/MenuBar'
import HelpModal from './components/HelpModal'
import NewFileModal from './components/NewFileModal'
import SearchBar from './components/SearchBar'
import SignInScreen from './components/SignInScreen'
import StudentFeedbackModal from './components/StudentFeedbackModal'
import ProfessorDashboard from './components/professor/ProfessorDashboard'
import type { QuickOpenCommand } from './components/SearchBar'
import StatusBar from './components/StatusBar'
import TitleBarControls from './components/TitleBarControls'
import WorkspacePanel from './components/WorkspacePanel'
import { ThemeProvider } from './themes/ThemeProvider'
import { FontProvider } from './fonts/FontProvider'
import { useCodeTracker } from './hooks/useCodeTracker'
import { useEnrolledCourses } from './hooks/useEnrolledCourses'
import { useProfileRole } from './hooks/useProfileRole'
import { useSupabaseSession } from './hooks/useSupabaseSession'
import { supabase } from './lib/supabase'
import { languageFromName } from './lib/languages'
import { defaultSavePath, fileDisplayName, workspaceNameFor } from './lib/workspace'
import type { EditorCommands, EditorViewOptions } from './components/EditorPane'
import type { LabFile } from './types/tracker'
import type { WorkspaceListing } from '../../shared/workspace'
import './index.css'

// Persisted workspace root so restarts reopen the same folder.
const WORKSPACE_KEY = 'unicode-lab.workspace'

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
      '- Open a file from the Explorer, or use File > Open File…',
      '- Ctrl+S saves the active file to disk',
      '- File > Open Workspace… points the app at a different folder',
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

export default function App(): React.ReactElement {
  const { session, loading: sessionLoading } = useSupabaseSession()
  const { role: profileRole, loading: roleLoading } = useProfileRole(session)

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

  // Workspace state: the chosen root folder and its current listing.
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceListing | null>(null)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)

  // Enrolled classes drive the course folders — no manual folder setup.
  const enrolled = useEnrolledCourses(session)
  const enrollmentNames = useMemo(
    () =>
      enrolled.courses
        .map((course) => course.code?.trim() || course.title.trim())
        .filter((name) => name.length > 0),
    [enrolled.courses]
  )

  const [activeFile, setActiveFile] = useState(INITIAL_FILES[0].name)
  const [authOpen, setAuthOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [guestMode, setGuestMode] = useState(false)
  const [newFileOpen, setNewFileOpen] = useState(false)
  // Course folder the pending New File dialog targets (null = untitled tab).
  const [newFileDir, setNewFileDir] = useState<string | null>(null)
  const [helpModal, setHelpModal] = useState<'shortcuts' | 'about' | null>(null)
  const [cursor, setCursor] = useState<{ lineNumber: number; column: number } | null>(null)

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

  const activeFileSnapshots = tracker.snapshotsByFile[activeFile] ?? []
  const activeFilePastes = tracker.pastesByFile[activeFile] ?? []
  const activeLanguage = files.find((file) => file.name === activeFile)?.language ?? 'plaintext'

  const handleSelectFile = (name: string): void => {
    setActiveFile(name)
    setCursor(null)
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
  const openFileFromDisk = async (filePath: string): Promise<void> => {
    const existing = files.find((file) => file.path === filePath)
    if (existing) {
      handleSelectFile(existing.name)
      return
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
    } catch (error) {
      setWorkspaceError(fsErrorMessage(error))
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

  const handleOpenWorkspace = async (): Promise<void> => {
    try {
      const root = await window.api.fs.pickWorkspace()
      if (!root) return
      localStorage.setItem(WORKSPACE_KEY, root)
      setWorkspaceRoot(root)
      setWorkspaceError(null)
      await refreshWorkspace(root)
    } catch (error) {
      setWorkspaceError(fsErrorMessage(error))
    }
  }

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
        if (/exist/i.test(message)) return `"${name}" already exists in that course folder.`
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
      id: 'open-workspace',
      label: 'Open Workspace…',
      icon: <FolderOpen size={13} />,
      run: () => void handleOpenWorkspace()
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

  // Resolve the workspace once: reuse the remembered root when it still
  // exists, otherwise create/use Documents/Unicode Lab.
  useEffect(() => {
    let cancelled = false
    const preferred = localStorage.getItem(WORKSPACE_KEY)
    void window.api.fs
      .bootstrapWorkspace(preferred)
      .then(async (root) => {
        if (cancelled) return
        localStorage.setItem(WORKSPACE_KEY, root)
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

  // Window-level shortcuts only apply to the student editor (signed in or
  // local guest mode) — never to the sign-in screen or professor dashboard.
  const editorActive =
    (session !== null || guestMode) && !roleLoading && profileRole !== 'professor'

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
    setGuestMode(false)
    void supabase?.auth.signOut()
  }

  return (
    <ThemeProvider>
      <FontProvider>
        {sessionLoading || (session !== null && roleLoading) ? (
          <SignInScreen loading onGuest={() => undefined} />
        ) : !session && !guestMode ? (
          <SignInScreen onGuest={() => setGuestMode(true)} />
        ) : profileRole === 'professor' && session ? (
          <ProfessorDashboard session={session} onSignOut={handleSignOut} />
        ) : (
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
                onOpenWorkspace={() => void handleOpenWorkspace()}
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
                <div
                  className="tracking-indicator"
                  title="Editing and paste activity is being recorded for this lab."
                >
                  <span className="status-dot recording"></span>
                  Tracking active
                </div>
                {session && profileRole !== 'professor' && (
                  <button
                    className="nav-icon-btn"
                    onClick={() => setFeedbackOpen(true)}
                    title="Feedback from your professor"
                  >
                    <MessageSquare size={14} />
                  </button>
                )}
                {session ? (
                  <>
                    <span className="nav-user">{session.user.email}</span>
                    <button className="nav-icon-btn" onClick={handleSignOut} title="Sign out">
                      <LogOut size={14} />
                    </button>
                  </>
                ) : (
                  <button className="nav-signin" onClick={() => setAuthOpen(true)}>
                    <LogIn size={12} /> Sign in
                  </button>
                )}
                <AppearancePanel />
              </div>
              {/* Direct child of the bar (outside .nav-right) so the controls sit
              flush against the window's right edge and the close button's
              red hover fills the top-right corner like a native title bar. */}
              <TitleBarControls />
            </nav>

            <div className="main-layout">
              {/* Activity Bar */}
              <div className="activity-bar">
                <div className="activity-icon active" title="Explorer">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="activity-icon" title="Search">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <div className="activity-icon" title="Source Control">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="18" cy="18" r="3" />
                    <circle cx="6" cy="6" r="3" />
                    <path d="M6 21V9a9 9 0 0 0 9 9" />
                  </svg>
                </div>
                <div className="activity-icon" title="Extensions">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
              </div>

              {/* Sidebar: real workspace tree */}
              <WorkspacePanel
                root={workspaceRoot}
                listing={workspace}
                error={workspaceError}
                activeFile={activeFile}
                onOpenFile={(filePath) => void openFileFromDisk(filePath)}
                onNewFileInCourse={(coursePath) => openNewFileDialog(coursePath)}
                onOpenWorkspace={() => void handleOpenWorkspace()}
                onRefresh={() => void refreshWorkspace()}
                signedIn={session !== null}
                coursesLoading={enrolled.loading}
              />

              {/* Editor & Terminal */}
              <main className="editor-area">
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
                />

                <div className="glass-panel terminal-window">
                  <div className="terminal-header">
                    <span>Terminal</span>
                    <span>Type and press Enter</span>
                  </div>
                  <div className="terminal-content">
                    $ Welcome to Unicode terminal mock
                    <br />
                    <br />
                    <span className="term-user">user@unicode</span>:
                    <span className="term-path">~</span>${' '}
                    <span className="term-hint">run command...</span>
                  </div>
                </div>
              </main>
            </div>

            <StatusBar
              fileName={activeFile}
              language={activeLanguage}
              cursor={cursor}
              snapshotCount={activeFileSnapshots.length}
              pasteCount={activeFilePastes.length}
              syncStatus={tracker.syncStatus}
            />

            <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} />

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

            <HelpModal mode={helpModal} onClose={() => setHelpModal(null)} />

            <StudentFeedbackModal
              open={feedbackOpen}
              studentId={session?.user.id ?? null}
              onClose={() => setFeedbackOpen(false)}
            />
          </div>
        )}
      </FontProvider>
    </ThemeProvider>
  )
}
