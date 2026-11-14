import { clipboard, contextBridge, ipcRenderer, shell } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CloseChoice, WorkspaceListing } from '../shared/workspace'

// Custom APIs for renderer
const api = {
  platform: process.platform,
  // System clipboard access for the Edit menu. Menu commands need to read
  // and write the clipboard while focus sits on the menu, not the editor —
  // a state where the async web Clipboard API is unavailable.
  clipboard: {
    readText(): Promise<string> {
      return clipboard.readText()
    },
    writeText(text: string): Promise<void> {
      return clipboard.writeText(text)
    }
  },
  // Opens a URL with the OS default browser (Help > Report an Issue…).
  openExternal(url: string): Promise<void> {
    return shell.openExternal(url)
  },
  // Workspace file access. Every call is validated in the main process
  // against the chosen workspace root (or files the student picked).
  fs: {
    bootstrapWorkspace(preferredRoot: string | null): Promise<string> {
      return ipcRenderer.invoke('fs:bootstrap-workspace', preferredRoot)
    },
    pickWorkspace(): Promise<string | null> {
      return ipcRenderer.invoke('fs:pick-workspace')
    },
    pickFile(): Promise<string | null> {
      return ipcRenderer.invoke('fs:pick-file')
    },
    listWorkspace(root: string): Promise<WorkspaceListing> {
      return ipcRenderer.invoke('fs:list-workspace', root)
    },
    readFile(filePath: string): Promise<string> {
      return ipcRenderer.invoke('fs:read-file', filePath)
    },
    writeFile(filePath: string, content: string): Promise<string> {
      return ipcRenderer.invoke('fs:write-file', filePath, content)
    },
    saveFileAs(defaultPath: string, content: string): Promise<string | null> {
      return ipcRenderer.invoke('fs:save-file-as', defaultPath, content)
    },
    createFile(dir: string, name: string): Promise<string> {
      return ipcRenderer.invoke('fs:create-file', dir, name)
    },
    ensureCourses(root: string, names: string[]): Promise<WorkspaceListing> {
      return ipcRenderer.invoke('fs:ensure-courses', root, names)
    },
    confirmClose(fileName: string): Promise<CloseChoice> {
      return ipcRenderer.invoke('fs:confirm-close', fileName)
    }
  },
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
