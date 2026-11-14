import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw
} from 'lucide-react'
import type { WorkspaceListing } from '../../../shared/workspace'
import { fileDisplayName } from '../lib/workspace'

interface WorkspacePanelProps {
  /** Chosen workspace root, or null while it is still resolving. */
  root: string | null
  listing: WorkspaceListing | null
  /** Human-readable filesystem error, if the last operation failed. */
  error: string | null
  activeFile: string
  onOpenFile: (filePath: string) => void
  /** Opens the New File dialog targeting this course folder. */
  onNewFileInCourse: (coursePath: string) => void
  onOpenWorkspace: () => void
  onRefresh: () => void
  /** Drives the empty state: signed-out vs. no enrolled classes yet. */
  signedIn: boolean
  coursesLoading: boolean
}

/**
 * Explorer sidebar: the workspace root, its course folders, and the files
 * inside them. Files are opened by reading them from disk; the panel is
 * driven entirely by the listing returned from the main process.
 */
export default function WorkspacePanel({
  root,
  listing,
  error,
  activeFile,
  onOpenFile,
  onNewFileInCourse,
  onOpenWorkspace,
  onRefresh,
  signedIn,
  coursesLoading
}: WorkspacePanelProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const rootLabel = useMemo(() => (root ? fileDisplayName(root) : 'Workspace'), [root])

  const toggleCourse = (path: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderFile = (key: string, path: string, name: string): React.ReactElement => (
    <div
      key={path}
      className={`file-item ${activeFile === key ? 'active' : ''}`}
      onClick={() => onOpenFile(path)}
      title={path}
    >
      <FileText size={13} />
      {name}
    </div>
  )

  return (
    <aside className="glass-panel sidebar workspace-panel">
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
            const isCollapsed = collapsed.has(course.path)
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

      <button className="workspace-open-btn" onClick={onOpenWorkspace}>
        Open Workspace…
      </button>
    </aside>
  )
}
