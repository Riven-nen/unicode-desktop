import { ElectronAPI } from '@electron-toolkit/preload'
import type { CloseChoice, WorkspaceListing } from '../shared/workspace'

export interface WindowControlsApi {
  minimize(): void
  toggleMaximize(): void
  close(): void
  isMaximized(): Promise<boolean>
  onMaximizeChange(callback: (maximized: boolean) => void): () => void
}

export interface ClipboardApi {
  readText(): Promise<string>
  writeText(text: string): Promise<void>
}

export interface FsApi {
  /** Resolves the workspace root, creating Documents/Unicode Lab if needed. */
  bootstrapWorkspace(preferredRoot: string | null): Promise<string>
  pickWorkspace(): Promise<string | null>
  pickFile(): Promise<string | null>
  listWorkspace(root: string): Promise<WorkspaceListing>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string): Promise<string>
  saveFileAs(defaultPath: string, content: string): Promise<string | null>
  createFile(dir: string, name: string): Promise<string>
  /** Creates one folder per enrolled course; idempotent, sorts the batch. */
  ensureCourses(root: string, names: string[]): Promise<WorkspaceListing>
  confirmClose(fileName: string): Promise<CloseChoice>
}

export interface UnicodeApi {
  platform: string
  window: WindowControlsApi
  clipboard: ClipboardApi
  openExternal(url: string): Promise<void>
  fs: FsApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: UnicodeApi
  }
}
