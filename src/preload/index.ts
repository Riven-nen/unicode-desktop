import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { AssignmentFileResult, CloseChoice, WorkspaceListing } from '../shared/workspace'
import type { LanguageCheckInput, LanguageCheckResult } from '../shared/diagnostics'
import type { LspMessage, LspStartResult } from '../shared/lsp'
import type {
  Judge0PublicConfig,
  Judge0RawResult,
  Judge0RunInput,
  Judge0SaveConfigInput,
  Judge0Status
} from '../shared/judge0'
import type {
  SubmissionLocalRun,
  SubmissionLocalRunInput,
  TerminalDataEvent,
  TerminalExitEvent
} from '../shared/terminal'
import type { ToolchainStatus } from '../shared/toolchains'

// Custom APIs for renderer
const api = {
  platform: process.platform,
  // Runtime versions for the About dialog. Exposed here because the renderer
  // is sandboxed and has no direct access to `process`.
  versions: {
    electron: process.versions.electron ?? '',
    chrome: process.versions.chrome ?? '',
    node: process.versions.node ?? ''
  },
  // System clipboard access for the Edit menu. Menu commands need to read
  // and write the clipboard while focus sits on the menu, not the editor —
  // a state where the async web Clipboard API is unavailable.
  clipboard: {
    readText(): Promise<string> {
      return ipcRenderer.invoke('clipboard:read-text')
    },
    writeText(text: string): Promise<void> {
      return ipcRenderer.invoke('clipboard:write-text', text)
    }
  },
  // Opens a URL with the OS default browser (Help > Report an Issue…).
  openExternal(url: string): Promise<void> {
    return ipcRenderer.invoke('app:open-external', url)
  },
  // Workspace file access. Every call is validated in the main process
  // against the chosen workspace root (or files the student picked).
  fs: {
    bootstrapWorkspace(): Promise<string> {
      return ipcRenderer.invoke('fs:bootstrap-workspace')
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
    ensureAssignmentFile(
      root: string,
      courseName: string,
      fileName: string,
      starterCode: string
    ): Promise<AssignmentFileResult> {
      return ipcRenderer.invoke(
        'fs:ensure-assignment-file',
        root,
        courseName,
        fileName,
        starterCode
      )
    },
    confirmClose(fileName: string): Promise<CloseChoice> {
      return ipcRenderer.invoke('fs:confirm-close', fileName)
    },
    renameFile(filePath: string, newName: string): Promise<string> {
      return ipcRenderer.invoke('fs:rename-file', filePath, newName)
    },
    deleteFile(filePath: string): Promise<boolean> {
      return ipcRenderer.invoke('fs:delete-file', filePath)
    }
  },
  // Native confirmation for destructive file actions.
  ui: {
    confirm(options: {
      title: string
      message: string
      detail?: string
      confirmLabel?: string
      danger?: boolean
    }): Promise<boolean> {
      return ipcRenderer.invoke('app:confirm', options)
    }
  },
  // Compiler/runtime availability for the active editor language.
  toolchains: {
    check(language: string, refresh = false): Promise<ToolchainStatus> {
      return ipcRenderer.invoke('toolchains:check', language, refresh)
    }
  },
  // Local language checks: Pyright for Python, javac/gcc/g++ for Java/C/C++.
  // They run in main with the bundled checker or installed toolchain; nothing
  // is uploaded.
  diagnostics: {
    check(input: LanguageCheckInput): Promise<LanguageCheckResult> {
      return ipcRenderer.invoke('diagnostics:check', input)
    }
  },
  // Bundled Pyright language server. The renderer exchanges JSON-RPC messages
  // through main; the server process has no network or renderer privileges.
  lsp: {
    start(): Promise<LspStartResult> {
      return ipcRenderer.invoke('lsp:python-start')
    },
    send(message: LspMessage): void {
      ipcRenderer.send('lsp:python-send', message)
    },
    stop(): void {
      ipcRenderer.send('lsp:python-stop')
    },
    onMessage(callback: (message: LspMessage) => void): () => void {
      const listener = (_event: IpcRendererEvent, message: LspMessage): void => callback(message)
      ipcRenderer.on('lsp:python-message', listener)
      return () => {
        ipcRenderer.removeListener('lsp:python-message', listener)
      }
    },
    onExit(callback: (event: { code: number | null }) => void): () => void {
      const listener = (_event: IpcRendererEvent, payload: { code: number | null }): void =>
        callback(payload)
      ipcRenderer.on('lsp:python-exit', listener)
      return () => {
        ipcRenderer.removeListener('lsp:python-exit', listener)
      }
    }
  },
  // Judge0 execution + local configuration. The token never reaches the
  // renderer as a value; only hasToken/configured are exposed.
  judge0: {
    getConfig(): Promise<Judge0PublicConfig> {
      return ipcRenderer.invoke('judge0:get-config')
    },
    saveConfig(input: Judge0SaveConfigInput): Promise<Judge0PublicConfig> {
      return ipcRenderer.invoke('judge0:save-config', input)
    },
    run(input: Judge0RunInput): Promise<Judge0RawResult> {
      return ipcRenderer.invoke('judge0:run', input)
    },
    status(): Promise<Judge0Status> {
      return ipcRenderer.invoke('judge0:status')
    }
  },
  // Local PowerShell session for the student terminal.
  terminal: {
    start(cwd: string | null): Promise<string> {
      return ipcRenderer.invoke('terminal:start', cwd)
    },
    startSubmission(runId: string): Promise<string> {
      return ipcRenderer.invoke('terminal:start-submission', runId)
    },
    write(data: string): void {
      ipcRenderer.send('terminal:write', data)
    },
    stop(): void {
      ipcRenderer.send('terminal:stop')
    },
    onData(callback: (event: TerminalDataEvent) => void): () => void {
      const listener = (_event: IpcRendererEvent, payload: TerminalDataEvent): void =>
        callback(payload)
      ipcRenderer.on('terminal:data', listener)
      return () => {
        ipcRenderer.removeListener('terminal:data', listener)
      }
    },
    onExit(callback: (event: TerminalExitEvent) => void): () => void {
      const listener = (_event: IpcRendererEvent, payload: TerminalExitEvent): void =>
        callback(payload)
      ipcRenderer.on('terminal:exit', listener)
      return () => {
        ipcRenderer.removeListener('terminal:exit', listener)
      }
    }
  },
  // Temporary local copies of student snapshots for professor review.
  submissions: {
    prepare(input: SubmissionLocalRunInput): Promise<SubmissionLocalRun> {
      return ipcRenderer.invoke('terminal:prepare-submission', input)
    },
    discard(runId: string): void {
      ipcRenderer.send('terminal:discard-submission', runId)
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
// Context isolation is always on in this app, so the bridge is the only path
// into the renderer. (Sandboxed preloads cannot assign globals directly.)
try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
