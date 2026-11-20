/**
 * Filesystem types shared by the main process, the preload bridge, and the
 * renderer. Kept in one place so the IPC surface can't drift from the
 * window.api typings.
 */

export interface WorkspaceFile {
  name: string
  path: string
}

export interface WorkspaceCourse {
  name: string
  path: string
  files: WorkspaceFile[]
}

export interface WorkspaceListing {
  root: string
  courses: WorkspaceCourse[]
  files: WorkspaceFile[]
}

export type CloseChoice = 'save' | 'discard' | 'cancel'

export interface AssignmentFileResult {
  /** Absolute path of the file on disk. */
  path: string
  /** Workspace-relative key used by the tracker (e.g. `CS101/fibonacci.py`). */
  fileName: string
  /** False when the file already existed and was left untouched. */
  created: boolean
}
