import { ElectronAPI } from '@electron-toolkit/preload'

export interface WindowControlsApi {
  minimize(): void
  toggleMaximize(): void
  close(): void
  isMaximized(): Promise<boolean>
  onMaximizeChange(callback: (maximized: boolean) => void): () => void
}

export interface UnicodeApi {
  platform: string
  window: WindowControlsApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: UnicodeApi
  }
}
