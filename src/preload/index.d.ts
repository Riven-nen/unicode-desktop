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
  /** Resolves the fixed Documents/Unicode Lab workspace, creating it if needed. */
  bootstrapWorkspace(): Promise<string>
  pickFile(): Promise<string | null>
  listWorkspace(root: string): Promise<WorkspaceListing>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string): Promise<string>
  saveFileAs(defaultPath: string, content: string): Promise<string | null>
  createFile(dir: string, name: string): Promise<string>
  /** Creates one folder per enrolled course; idempotent, sorts the batch. */
  ensureCourses(root: string, names: string[]): Promise<WorkspaceListing>
  /**
   * Opens the file an assignment points at, creating it (and its course
   * folder) with the starter code when it does not exist yet.
   */
  ensureAssignmentFile(
    root: string,
    courseName: string,
    fileName: string,
    starterCode: string
  ): Promise<AssignmentFileResult>
  confirmClose(fileName: string): Promise<CloseChoice>
  /** Renames a workspace file; resolves with the new absolute path. */
  renameFile(filePath: string, newName: string): Promise<string>
  /** Permanently deletes a workspace file (never a folder). */
  deleteFile(filePath: string): Promise<boolean>
}

export interface UiApi {
  /** Native OK/Cancel prompt used before deleting a workspace file. */
  confirm(options: {
    title: string
    message: string
    detail?: string
    confirmLabel?: string
    danger?: boolean
  }): Promise<boolean>
}

export interface ToolchainsApi {
  /** Detects compiler/runtime availability for a Monaco language id. */
  check(language: string, refresh?: boolean): Promise<ToolchainStatus>
}

export interface DiagnosticsApi {
  /** Runs the local Python type checker or Java/C/C++ compiler in main. */
  check(input: LanguageCheckInput): Promise<LanguageCheckResult>
}

export interface LspApi {
  /** Starts the bundled Pyright language server in the main process. */
  start(): Promise<LspStartResult>
  /** Sends one JSON-RPC/LSP message to the server. */
  send(message: LspMessage): void
  stop(): void
  onMessage(callback: (message: LspMessage) => void): () => void
  onExit(callback: (event: { code: number | null }) => void): () => void
}

export interface Judge0Api {
  /** Endpoint/hasToken/configured; the token value itself never leaves main. */
  getConfig(): Promise<Judge0PublicConfig>
  saveConfig(input: Judge0SaveConfigInput): Promise<Judge0PublicConfig>
  run(input: Judge0RunInput): Promise<Judge0RawResult>
  status(): Promise<Judge0Status>
}

export interface TerminalApi {
  /** Starts a local shell rooted at the active workspace. Returns its cwd. */
  start(cwd: string | null): Promise<string>
  /** Starts a shell in a prepared temporary submission directory. */
  startSubmission(runId: string): Promise<string>
  write(data: string): void
  stop(): void
  onData(callback: (event: TerminalDataEvent) => void): () => void
  onExit(callback: (event: TerminalExitEvent) => void): () => void
}

export interface SubmissionRunsApi {
  /** Writes a selected snapshot to a temporary directory for local review. */
  prepare(input: SubmissionLocalRunInput): Promise<SubmissionLocalRun>
  /** Removes a prepared temporary directory. */
  discard(runId: string): void
}

export interface UnicodeApi {
  platform: string
  /** Runtime versions for the About dialog. */
  versions: { electron: string; chrome: string; node: string }
  window: WindowControlsApi
  clipboard: ClipboardApi
  openExternal(url: string): Promise<void>
  fs: FsApi
  ui: UiApi
  toolchains: ToolchainsApi
  diagnostics: DiagnosticsApi
  lsp: LspApi
  judge0: Judge0Api
  terminal: TerminalApi
  submissions: SubmissionRunsApi
}

declare global {
  interface Window {
    api: UnicodeApi
  }
}
