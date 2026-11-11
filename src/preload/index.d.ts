import { ElectronAPI } from '@electron-toolkit/preload'

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

export interface UnicodeApi {
  platform: string
  window: WindowControlsApi
  clipboard: ClipboardApi
  openExternal(url: string): Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: UnicodeApi
  }
}
