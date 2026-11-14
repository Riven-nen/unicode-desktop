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
