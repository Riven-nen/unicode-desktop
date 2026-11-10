import { useMemo, useState } from 'react'
import { LogIn, LogOut } from 'lucide-react'
import AppearancePanel from './components/AppearancePanel'
import AuthPanel from './components/AuthPanel'
import DiffViewer from './components/DiffViewer'
import EditorPane from './components/EditorPane'
import StatusBar from './components/StatusBar'
import TimelineRail from './components/TimelineRail'
import TitleBarControls from './components/TitleBarControls'
import { ThemeProvider } from './themes/ThemeProvider'
import { FontProvider } from './fonts/FontProvider'
import { useCodeTracker } from './hooks/useCodeTracker'
import { useSupabaseSession } from './hooks/useSupabaseSession'
import { supabase } from './lib/supabase'
import type { LabFile } from './types/tracker'
import './index.css'

const LAB_FILES: LabFile[] = [
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

export default function App(): React.ReactElement {
  const session = useSupabaseSession()
  const fileNames = useMemo(() => LAB_FILES.map((file) => file.name), [])
  const tracker = useCodeTracker({ session, labId: null, fileNames })

  const [activeFile, setActiveFile] = useState(LAB_FILES[0].name)
  const [timelineExpanded, setTimelineExpanded] = useState(true)
  const [authOpen, setAuthOpen] = useState(false)
  const [diffId, setDiffId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ lineNumber: number; column: number } | null>(null)

  const activeFileSnapshots = tracker.snapshotsByFile[activeFile] ?? []
  const activeFilePastes = tracker.pastesByFile[activeFile] ?? []
  const activeLanguage = LAB_FILES.find((file) => file.name === activeFile)?.language ?? 'plaintext'
  const diffOpen = diffId !== null && activeFileSnapshots.some((s) => s.id === diffId)

  const handleSelectFile = (name: string): void => {
    setActiveFile(name)
    setDiffId(null)
    setCursor(null)
  }

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
            <div className="nav-menu">
              <span>File</span>
              <span>Edit</span>
              <span>View</span>
              <span>Run</span>
              <span>Help</span>
            </div>

            <div className="search-wrapper">
              <div className="search-bar">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input type="text" placeholder="Search files, commands, or symbols" />
              </div>
            </div>

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
                <div className="file-item">Python Starter</div>
                <div className="file-item">Java Starter</div>
                <div className="file-item">C++ Starter</div>
              </div>

              <div className="section-title">Files</div>
              <div className="file-list">
                {LAB_FILES.map((file) => (
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
                files={LAB_FILES}
                activeFile={activeFile}
                onSelectFile={handleSelectFile}
                onCursorChange={setCursor}
                tracker={tracker}
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
        </div>
      </FontProvider>
    </ThemeProvider>
  )
}
