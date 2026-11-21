import { useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image,
  ImagePlus,
  Pencil,
  RefreshCw,
  Trash2
} from 'lucide-react'
import type {
  WorkspaceCourse,
  WorkspaceFile,
  WorkspaceFolder,
  WorkspaceListing
} from '../../../shared/workspace'
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
  /** Opens an image with the OS viewer rather than the text editor. */
  onOpenImage: (filePath: string) => void
  /** Opens the New File dialog targeting this folder. */
  onNewFileInFolder: (folderPath: string) => void
  /** Opens the New Folder dialog targeting this folder. */
  onNewFolder: (parentPath: string) => void
  /** Opens the image picker and copies assets into this folder. */
  onAddImages: (folderPath: string) => void
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
  onOpenImage,
  onNewFileInFolder,
  onNewFolder,
  onAddImages,
  onRenameFile,
  onDeleteFile,
  onRefresh,
  signedIn,
  coursesLoading,
  outline,
  onRevealSymbol
}: WorkspacePanelProps): React.ReactElement {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set())
  const [renaming, setRenaming] = useState<{ path: string; value: string } | null>(null)
  // Enter commits and removes the input, which can fire blur too; the refs
  // keep that from renaming twice or ignoring Escape.
  const renameBusyRef = useRef(false)
  const skipCommitRef = useRef(false)

  const rootLabel = useMemo(() => (root ? fileDisplayName(root) : 'Workspace'), [root])

  const toggleFolder = (path: string): void => {
    setCollapsedFolders((previous) => {
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

  const renderFile = (key: string, file: WorkspaceFile, depth: number): React.ReactElement => {
    const isRenaming = renaming?.path === file.path
    return (
      <div
        key={file.path}
        className={`file-item ${activeFile === key ? 'active' : ''} ${
          isRenaming ? 'is-renaming' : ''
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => {
          if (isRenaming) return
          if (file.kind === 'image') onOpenImage(file.path)
          else onOpenFile(file.path)
        }}
        title={file.path}
      >
        {file.kind === 'image' ? <Image size={13} /> : <FileText size={13} />}
        {isRenaming ? (
          <input
            className="file-rename-input"
            autoFocus
            value={renaming.value}
            aria-label={`Rename ${file.name}`}
            onChange={(event) => setRenaming({ path: file.path, value: event.target.value })}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitRename(file.path, event.currentTarget.value)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                skipCommitRef.current = true
                setRenaming(null)
              }
            }}
            onBlur={(event) => commitRename(file.path, event.currentTarget.value)}
          />
        ) : (
          <>
            <span className="file-item-name">{file.name}</span>
            <span className="file-item-actions">
              <button
                className="file-action"
                title={`Rename ${file.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setRenaming({ path: file.path, value: file.name })
                }}
              >
                <Pencil size={11} />
              </button>
              <button
                className="file-action is-danger"
                title={`Delete ${file.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  void onDeleteFile(file.path)
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

  const renderFolderActions = (folderPath: string, label: string): React.ReactElement => (
    <span className="workspace-course-actions">
      <button
        className="workspace-icon-btn"
        title={`New file in ${label}`}
        onClick={(event) => {
          event.stopPropagation()
          onNewFileInFolder(folderPath)
        }}
      >
        <FilePlus2 size={12} />
      </button>
      <button
        className="workspace-icon-btn"
        title={`New folder in ${label}`}
        onClick={(event) => {
          event.stopPropagation()
          onNewFolder(folderPath)
        }}
      >
        <FolderPlus size={12} />
      </button>
      <button
        className="workspace-icon-btn"
        title={`Add images to ${label}`}
        onClick={(event) => {
          event.stopPropagation()
          onAddImages(folderPath)
        }}
      >
        <ImagePlus size={12} />
      </button>
    </span>
  )

  const renderFolder = (
    folder: WorkspaceFolder,
    prefix: string,
    depth: number,
    isCourse = false
  ): React.ReactElement => {
    const folderKey = prefix ? `${prefix}/${folder.name}` : folder.name
    const isFocused =
      isCourse && focusCourse !== null && folder.name.toLowerCase() === focusCourse.toLowerCase()
    const isCollapsed = collapsedFolders.has(folder.path) && !isFocused
    const empty = folder.folders.length === 0 && folder.files.length === 0
    return (
      <div key={folder.path} className="workspace-course">
        <div
          className="workspace-course-header"
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => toggleFolder(folder.path)}
          title={folder.path}
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          {isCollapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
          <span className="workspace-course-name">{folder.name}</span>
          {renderFolderActions(folder.path, folder.name)}
        </div>
        {!isCollapsed && (
          <div className="file-list workspace-course-files">
            {empty && (
              <div className="workspace-hint">{isCourse ? 'No files yet' : 'Empty folder'}</div>
            )}
            {folder.folders.map((child) => renderFolder(child, folderKey, depth + 1))}
            {folder.files.map((file) => renderFile(`${folderKey}/${file.name}`, file, depth + 1))}
          </div>
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
                {listing.files.map((file) => renderFile(file.name, file, 0))}
              </div>
            )}

            {listing.courses.map((course: WorkspaceCourse) => renderFolder(course, '', 0, true))}

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
