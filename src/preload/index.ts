import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  platform: process.platform,
  // Custom title-bar controls for the frameless window.
  window: {
    minimize(): void {
      ipcRenderer.send('window:minimize')
    },
    toggleMaximize(): void {
      ipcRenderer.send('window:toggle-maximize')
    },
    close(): void {
      ipcRenderer.send('window:close')
    },
    isMaximized(): Promise<boolean> {
      return ipcRenderer.invoke('window:is-maximized')
    },
    onMaximizeChange(callback: (maximized: boolean) => void): () => void {
      const listener = (_event: IpcRendererEvent, maximized: boolean): void => callback(maximized)
      ipcRenderer.on('window:maximize-changed', listener)
      return () => {
        ipcRenderer.removeListener('window:maximize-changed', listener)
      }
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
