import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  Command,
  Download,
  FilePlus2,
  History,
  Info,
  Keyboard,
  List,
  LogIn,
  LogOut,
  Map as MapIcon,
  RefreshCw,
  WrapText
} from 'lucide-react'
import AppearancePanel from './components/AppearancePanel'
import AuthPanel from './components/AuthPanel'
import DiffViewer from './components/DiffViewer'
import EditorPane from './components/EditorPane'
import MenuBar from './components/MenuBar'
import HelpModal from './components/HelpModal'
import NewFileModal from './components/NewFileModal'
import SearchBar from './components/SearchBar'
import type { QuickOpenCommand } from './components/SearchBar'
import StatusBar from './components/StatusBar'
import TimelineRail from './components/TimelineRail'
import TitleBarControls from './components/TitleBarControls'
import { ThemeProvider } from './themes/ThemeProvider'
import { FontProvider } from './fonts/FontProvider'
import { useCodeTracker } from './hooks/useCodeTracker'
import { useSupabaseSession } from './hooks/useSupabaseSession'
import { supabase } from './lib/supabase'
import type { EditorCommands, EditorViewOptions } from './components/EditorPane'
import type { LabFile } from './types/tracker'
import './index.css'

const INITIAL_FILES: LabFile[] = [
  {
    name: 'welcome.md',
    language: 'markdown',
    initialContent: [
      '# Lab Session',
      '',
      'Welcome to Unicode Lab.',
      '',
      '- Your edits are captured as time-travel snapshots',
      '- Use the Time Travel rail below the editor to browse and diff history',
      '- Paste activity is recorded for academic-integrity analytics',
      ''
    ].join('\n')
  },
  {
    name: 'main.py',
    language: 'python',
    initialContent: '# Write your Python solution here\n\n'
  },
  {
    name: 'solution.java',
    language: 'java',
    initialContent:
      'public class Solution {\n    public static void main(String[] args) {\n        // Write your Java solution here\n    }\n}\n'
  },
  {
    name: 'hello.cpp',
    language: 'cpp',
    initialContent:
      '#include <iostream>\n\nint main() {\n    // Write your C++ solution here\n    return 0;\n}\n'
  }
]

// Sidebar Quick Start shortcuts; each opens one of the starter files above.
const QUICK_START: Array<{ label: string; target: string }> = [
  { label: 'Python Starter', target: 'main.py' },
  { label: 'Java Starter', target: 'solution.java' },
  { label: 'C++ Starter', target: 'hello.cpp' }
]

export default function App(): React.ReactElement {
  const session = useSupabaseSession()

  // The lab workspace is mutable state so File > New File… can grow it.
  const [files, setFiles] = useState<LabFile[]>(INITIAL_FILES)
  const fileNames = useMemo(() => files.map((file) => file.name), [files])
  const tracker = useCodeTracker({ session, labId: null, fileNames })

  const [activeFile, setActiveFile] = useState(INITIAL_FILES[0].name)
  const [timelineExpanded, setTimelineExpanded] = useState(true)
  const [authOpen, setAuthOpen] = useState(false)
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [helpModal, setHelpModal] = useState<'shortcuts' | 'about' | null>(null)
  const [diffId, setDiffId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ lineNumber: number; column: number } | null>(null)

  // Editor commands for the menu bar, populated when the editor mounts.
  const editorCommandsRef = useRef<EditorCommands | null>(null)

  // Quick-open search input (Ctrl+P focuses it).
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Last-known content of closed files, so re-opening one (Quick Start or
  // File > New File…) restores the user's edits instead of the skeleton.
  const closedFilesRef = useRef(new Map<string, LabFile>())

  // View-menu toggles; owned here so the menu checkmarks stay truthful.
  const [viewOptions, setViewOptions] = useState<EditorViewOptions>({
    minimap: false,
    wordWrap: false,
    lineNumbers: true
  })

  const activeFileSnapshots = tracker.snapshotsByFile[activeFile] ?? []
  const activeFilePastes = tracker.pastesByFile[activeFile] ?? []
  const activeLanguage = files.find((file) => file.name === activeFile)?.language ?? 'plaintext'
  const diffOpen = diffId !== null && activeFileSnapshots.some((s) => s.id === diffId)

  const handleSelectFile = (name: string): void => {
    setActiveFile(name)
    setDiffId(null)
    setCursor(null)
  }

  const handleCreateFile = (name: string, language: string): void => {
    setFiles((prev) =>
      prev.some((file) => file.name === name)
        ? prev
        : [...prev, { name, language, initialContent: '' }]
    )
    setNewFileOpen(false)
    setActiveFile(name)
    setDiffId(null)
    setCursor(null)
  }

  const handleCloseFile = (name: string): void => {
    // The workspace always keeps at least one file open.
    if (files.length <= 1) return
    const index = files.findIndex((file) => file.name === name)
    if (index === -1) return
    // Remember the live content so the tab can be re-opened with its
    // edits rather than the starter skeleton.
    const closing = files[index]
    closedFilesRef.current.set(name, {
      name,
      language: closing.language,
      initialContent: tracker.getModelValue(name) ?? closing.initialContent
    })
    const remaining = files.filter((file) => file.name !== name)
    setFiles(remaining)
    if (name === activeFile) {
      // Move to the adjacent tab (right neighbor, else the left one).
      const neighbor = remaining[Math.min(index, remaining.length - 1)]
      if (neighbor) {
        setActiveFile(neighbor.name)
        setDiffId(null)
        setCursor(null)
      }
    }
  }

  const handleOpenStarter = (target: string): void => {
    // Select the starter's tab if it's open; otherwise re-open it with the
    // last content from this session (or the starter skeleton).
    if (files.some((file) => file.name === target)) {
      handleSelectFile(target)
      return
    }
    const restored = closedFilesRef.current.get(target)
    const starter = INITIAL_FILES.find((file) => file.name === target)
    const file: LabFile = restored ??
      starter ?? { name: target, language: 'plaintext', initialContent: '' }
    setFiles((prev) => [...prev, file])
    handleSelectFile(target)
  }

  const handleExportFile = (): void => {
    // Download the live editor content as a file (browser download API —
    // works identically in Electron and plain browser sessions).
    const content = tracker.getModelValue(activeFile)
    const blob = new Blob([content ?? ''], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = activeFile
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
      run: () => setNewFileOpen(true)
    },
    {
      id: 'save-snapshot',
      label: 'Save Snapshot',
      shortcut: 'Ctrl+S',
      icon: <Camera size={13} />,
      run: () => tracker.captureManualSnapshot(activeFile)
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
      id: 'toggle-timeline',
      label: 'Toggle Time Travel Panel',
      icon: <History size={13} />,
      run: () => setTimelineExpanded((value) => !value)
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

  // Window-level shortcuts for menu actions monaco doesn't bind itself.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        tracker.captureManualSnapshot(activeFile)
      } else if (key === 'n' && !event.shiftKey) {
        event.preventDefault()
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
  }, [activeFile, tracker])

  const handleSignOut = (): void => {
    void supabase?.auth.signOut()
  }

  return (
    <ThemeProvider>
      <FontProvider>
        <div className="app-container">
          {/* Custom title bar / top navigation (draggable frameless region) */}
          <nav className="top-nav">
            <div className="nav-logo">
              <div className="logo-icon"></div>
              Unicode
            </div>
            <MenuBar
              commandsRef={editorCommandsRef}
              onNewFile={() => setNewFileOpen(true)}
              onSaveSnapshot={() => tracker.captureManualSnapshot(activeFile)}
              onSyncNow={() => tracker.flushNow()}
              onExportFile={handleExportFile}
              viewOptions={viewOptions}
              onToggleViewOption={handleToggleViewOption}
              timelineVisible={timelineExpanded}
              onToggleTimeline={() => setTimelineExpanded((value) => !value)}
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

            {/* Sidebar */}
            <aside className="glass-panel sidebar">
              <div className="section-title">Quick Start</div>
              <div className="file-list">
                {QUICK_START.map((item) => (
                  <div
                    key={item.target}
                    className={`file-item ${activeFile === item.target ? 'active' : ''}`}
                    onClick={() => handleOpenStarter(item.target)}
                  >
                    {item.label}
                  </div>
                ))}
              </div>

              <div className="section-title">Files</div>
              <div className="file-list">
                {files.map((file) => (
                  <div
                    key={file.name}
                    className={`file-item ${activeFile === file.name ? 'active' : ''}`}
                    onClick={() => handleSelectFile(file.name)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {file.name}
                  </div>
                ))}
              </div>
            </aside>

            {/* Editor, Timeline & Terminal */}
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
                onCloseFile={handleCloseFile}
              />

              <TimelineRail
                fileName={activeFile}
                snapshots={activeFileSnapshots}
                pasteCount={activeFilePastes.length}
                syncStatus={tracker.syncStatus}
                queuedCount={tracker.queuedCount}
                expanded={timelineExpanded}
                onToggle={() => setTimelineExpanded((value) => !value)}
                onOpenDiff={(snapshot) => setDiffId(snapshot.id)}
                onSnapshotNow={() => tracker.captureManualSnapshot(activeFile)}
                onSyncClick={() => tracker.flushNow()}
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

          <DiffViewer
            open={diffOpen}
            fileName={activeFile}
            language={activeLanguage}
            snapshots={activeFileSnapshots}
            snapshotId={diffId}
            currentContent={tracker.getModelValue(activeFile) ?? ''}
            pastes={activeFilePastes}
            onClose={() => setDiffId(null)}
            onSelect={(snapshot) => setDiffId(snapshot.id)}
            onRestore={(snapshot) => tracker.restoreSnapshot(activeFile, snapshot)}
          />

          <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} />

          {newFileOpen && (
            <NewFileModal
              existingNames={fileNames}
              onClose={() => setNewFileOpen(false)}
              onCreate={handleCreateFile}
            />
          )}

          <HelpModal mode={helpModal} onClose={() => setHelpModal(null)} />
        </div>
      </FontProvider>
    </ThemeProvider>
  )
}
