import { useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  Pencil,
  RefreshCw,
  Trash2
} from 'lucide-react'
import type { WorkspaceListing } from '../../../shared/workspace'
import { fileDisplayName } from '../lib/workspace'
import type { CodeAnalysis } from '../lib/codeAnalysis'

interface WorkspacePanelProps {
  /** Expanded sidebar width in pixels (draggable splitter in App). */
  width: number
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Folder name to reveal, e.g. after opening a class from the dashboard. */
  focusCourse: string | null
  /** Fixed workspace root, or null while it is still resolving. */
  root: string | null
  listing: WorkspaceListing | null
  /** Human-readable filesystem error, if the last operation failed. */
  error: string | null
  activeFile: string
  onOpenFile: (filePath: string) => void
  /** Opens the New File dialog targeting this course folder. */
  onNewFileInCourse: (coursePath: string) => void
  /** Renames a workspace file; the parent keeps any open tab in sync. */
  onRenameFile: (filePath: string, newName: string) => Promise<void>
  /** Confirms and permanently deletes a workspace file. */
  onDeleteFile: (filePath: string) => Promise<void>
  onRefresh: () => void
  /** Drives the empty state: signed-out vs. no enrolled classes yet. */
  signedIn: boolean
  coursesLoading: boolean
  /** Symbols/diagnostics for the active file, or null for unsupported files. */
  outline: CodeAnalysis | null
  onRevealSymbol: (line: number, column: number) => void
}

const COLLAPSED_WIDTH = 54

/**
 * Explorer sidebar: the workspace root, its course folders, and the files
 * inside them. Files are opened by reading them from disk; the panel is
 * driven entirely by the listing returned from the main process.
 */
export default function WorkspacePanel({
  width,
  collapsed,
  onToggleCollapsed,
  focusCourse,
  root,
  listing,
  error,
  activeFile,
  onOpenFile,
  onNewFileInCourse,
  onRenameFile,
  onDeleteFile,
  onRefresh,
  signedIn,
  coursesLoading,
  outline,
  onRevealSymbol
}: WorkspacePanelProps): React.ReactElement {
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(() => new Set())
  const [renaming, setRenaming] = useState<{ path: string; value: string } | null>(null)
  // Enter commits and removes the input, which can fire blur too; the refs
  // keep that from renaming twice or ignoring Escape.
  const renameBusyRef = useRef(false)
  const skipCommitRef = useRef(false)

  const rootLabel = useMemo(() => (root ? fileDisplayName(root) : 'Workspace'), [root])

  const toggleCourse = (path: string): void => {
    setCollapsedCourses((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const commitRename = (path: string, value: string): void => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false
      return
    }
    if (renameBusyRef.current) return
    renameBusyRef.current = true
    const trimmed = value.trim()
    setRenaming(null)
    if (!trimmed || trimmed === fileDisplayName(path)) {
      renameBusyRef.current = false
      return
    }
    void onRenameFile(path, trimmed).finally(() => {
      renameBusyRef.current = false
    })
  }

  const renderFile = (key: string, path: string, name: string): React.ReactElement => {
    const isRenaming = renaming?.path === path
    return (
      <div
        key={path}
        className={`file-item ${activeFile === key ? 'active' : ''} ${
          isRenaming ? 'is-renaming' : ''
        }`}
        onClick={() => {
          if (!isRenaming) onOpenFile(path)
        }}
        title={path}
      >
        <FileText size={13} />
        {isRenaming ? (
          <input
            className="file-rename-input"
            autoFocus
            value={renaming.value}
            aria-label={`Rename ${name}`}
            onChange={(event) => setRenaming({ path, value: event.target.value })}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitRename(path, event.currentTarget.value)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                skipCommitRef.current = true
                setRenaming(null)
              }
            }}
            onBlur={(event) => commitRename(path, event.currentTarget.value)}
          />
        ) : (
          <>
            <span className="file-item-name">{name}</span>
            <span className="file-item-actions">
              <button
                className="file-action"
                title={`Rename ${name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setRenaming({ path, value: name })
                }}
              >
                <Pencil size={11} />
              </button>
              <button
                className="file-action is-danger"
                title={`Delete ${name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  void onDeleteFile(path)
                }}
              >
                <Trash2 size={11} />
              </button>
            </span>
          </>
        )}
      </div>
    )
  }

  if (collapsed) {
    return (
      <aside className="glass-panel sidebar sidebar-rail" style={{ width: COLLAPSED_WIDTH }}>
        <button
          className="rail-btn active"
          title="Expand files"
          aria-expanded="false"
          onClick={onToggleCollapsed}
        >
          <Folder size={16} />
        </button>
      </aside>
    )
  }

  return (
    <aside className="glass-panel sidebar workspace-panel" style={{ width }}>
      <div className="sidebar-viewbar">
        <button
          className="sidebar-viewtab active"
          title="Collapse files"
          aria-expanded="true"
          onClick={onToggleCollapsed}
        >
          <Folder size={16} />
        </button>
      </div>

      <div className="workspace-scroll">
        <div className="workspace-header">
          <span className="section-title workspace-title" title={root ?? undefined}>
            {root ? (
              <>
                <FolderOpen size={13} />
                {rootLabel}
              </>
            ) : (
              'Workspace'
            )}
          </span>
          <div className="workspace-actions">
            <button className="workspace-icon-btn" title="Refresh Workspace" onClick={onRefresh}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {error && <div className="workspace-error">{error}</div>}

        {!root && !error && <div className="workspace-empty">Loading workspace…</div>}

        {root && listing && (
          <>
            {listing.files.length > 0 && (
              <div className="file-list">
                {listing.files.map((file) => renderFile(file.name, file.path, file.name))}
              </div>
            )}

            {listing.courses.map((course) => {
              const isFocused =
                focusCourse !== null && course.name.toLowerCase() === focusCourse.toLowerCase()
              const isCollapsed = collapsedCourses.has(course.path) && !isFocused
              return (
                <div key={course.path} className="workspace-course">
                  <div
                    className="workspace-course-header"
                    onClick={() => toggleCourse(course.path)}
                    title={course.path}
                  >
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <Folder size={13} />
                    <span className="workspace-course-name">{course.name}</span>
                    <button
                      className="workspace-icon-btn workspace-course-add"
                      title={`New File in ${course.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onNewFileInCourse(course.path)
                      }}
                    >
                      <FilePlus2 size={12} />
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="file-list workspace-course-files">
                      {course.files.length === 0 && (
                        <div className="workspace-hint">No files yet</div>
                      )}
                      {course.files.map((file) =>
                        renderFile(`${course.name}/${file.name}`, file.path, file.name)
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {listing.courses.length === 0 && listing.files.length === 0 && (
              <div className="workspace-empty">
                {!signedIn && (
                  <>
                    <p>Sign in to load the courses you are enrolled in.</p>
                    <p>Each class gets its own folder here automatically.</p>
                  </>
                )}
                {signedIn && coursesLoading && <p>Loading your enrolled courses…</p>}
                {signedIn && !coursesLoading && (
                  <>
                    <p>No enrolled courses yet.</p>
                    <p>Folders for your classes appear here as soon as you are enrolled.</p>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {outline && (
          <div className="workspace-outline">
            <div className="workspace-outline-head">
              <span>Outline</span>
              {outline.diagnostics.length > 0 ? (
                <button
                  className="outline-status is-error"
                  title="Reveal the first issue"
                  onClick={() =>
                    onRevealSymbol(outline.diagnostics[0].line, outline.diagnostics[0].column)
                  }
                >
                  {outline.diagnostics.length}{' '}
                  {outline.diagnostics.length === 1 ? 'issue' : 'issues'}
                </button>
              ) : (
                <span className="outline-status is-ok">OK</span>
              )}
            </div>

            {outline.symbols.length === 0 ? (
              <div className="workspace-hint">No functions, classes, or names yet.</div>
            ) : (
              <div className="outline-list">
                {outline.symbols.map((symbol) => (
                  <button
                    key={`${symbol.name}:${symbol.line}:${symbol.column}`}
                    className="outline-item"
                    style={{ paddingLeft: 8 + symbol.depth * 10 }}
                    title={`${symbol.kind} ${symbol.name} · line ${symbol.line}`}
                    onClick={() => onRevealSymbol(symbol.line, symbol.column)}
                  >
                    <span className={`outline-kind is-${symbol.kind}`}>
                      {symbol.kind === 'class'
                        ? 'C'
                        : symbol.kind === 'method'
                          ? 'M'
                          : symbol.kind === 'variable'
                            ? 'V'
                            : 'ƒ'}
                    </span>
                    <span className="outline-name">{symbol.name}</span>
                    <span className="outline-line">{symbol.line}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
