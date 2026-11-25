import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { execFile, spawn } from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { randomUUID } from 'crypto'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, extname, join } from 'path'
import { getWorkspaceRoot } from './fs'
import type {
  SubmissionLocalRun,
  SubmissionLocalRunInput,
  TerminalDataEvent,
  TerminalExitEvent
} from '../shared/terminal'

/**
 * A local shell for the student workspace and for temporary professor review
 * runs. This is deliberately separate from Judge0: it runs commands against
 * real local files and is never used for graded test cases.
 */

const sessions = new Map<number, ChildProcessWithoutNullStreams>()
const sessionRunIds = new Map<number, string>()
const submissionRuns = new Map<string, SubmissionLocalRun>()

const EXTENSION_BY_LANGUAGE: Record<string, string> = {
  python: '.py',
  java: '.java',
  c: '.c',
  cpp: '.cpp',
  javascript: '.js'
}

function stopSession(id: number): void {
  sessionRunIds.delete(id)
  const child = sessions.get(id)
  if (!child) return
  sessions.delete(id)
  try {
    child.stdin.end()
  } catch {
    // Already gone.
  }
  if (process.platform === 'win32' && child.pid) {
    // PowerShell may have a child process still holding the temporary
    // submission directory as its working directory.
    execFile(
      'taskkill',
      ['/PID', String(child.pid), '/T', '/F'],
      { windowsHide: true },
      () => undefined
    )
  } else {
    try {
      child.kill('SIGKILL')
    } catch {
      // Already gone.
    }
  }
}

async function removeRunDirectory(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
}

export function stopAllTerminals(): void {
  for (const id of Array.from(sessions.keys())) stopSession(id)
}

export function cleanupSubmissionRuns(): void {
  for (const [runId, run] of submissionRuns) {
    submissionRuns.delete(runId)
    void removeRunDirectory(run.directory)
  }
}

function startShell(event: IpcMainInvokeEvent, cwd: string): string {
  const id = event.sender.id
  stopSession(id)

  const isWindows = process.platform === 'win32'
  const shell = isWindows ? 'powershell.exe' : 'bash'
  const args = isWindows
    ? ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-']
    : ['-l']

  const child = spawn(shell, args, {
    cwd,
    env: process.env,
    windowsHide: true
  })
  sessions.set(id, child)

  const send = (payload: TerminalDataEvent): void => {
    if (!event.sender.isDestroyed()) event.sender.send('terminal:data', payload)
  }

  child.stdout.on('data', (data: Buffer) => {
    send({ stream: 'stdout', data: data.toString() })
  })
  child.stderr.on('data', (data: Buffer) => {
    send({ stream: 'stderr', data: data.toString() })
  })
  child.on('error', (error) => {
    send({ stream: 'stderr', data: `${error.message}\r\n` })
  })
  child.on('exit', (code) => {
    sessions.delete(id)
    if (!event.sender.isDestroyed()) {
      event.sender.send('terminal:exit', { code } satisfies TerminalExitEvent)
    }
  })

  return cwd
}

function safeSubmissionFileName(input: SubmissionLocalRunInput): string {
  const raw = basename(input.fileName?.trim() || 'submission')
  const sanitized =
    Array.from(raw, (char) =>
      char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char
    ).join('') || 'submission'
  if (extname(sanitized)) return sanitized
  return `${sanitized}${EXTENSION_BY_LANGUAGE[input.language] ?? '.txt'}`
}

async function prepareSubmissionRun(input: SubmissionLocalRunInput): Promise<SubmissionLocalRun> {
  if (
    !input ||
    typeof input.fileName !== 'string' ||
    typeof input.content !== 'string' ||
    typeof input.language !== 'string'
  ) {
    throw new Error('Invalid local submission run request.')
  }

  const directory = await mkdtemp(join(tmpdir(), 'unicode-lab-submission-'))
  try {
    const filePath = join(directory, safeSubmissionFileName(input))
    await writeFile(filePath, input.content, 'utf8')
    const run: SubmissionLocalRun = { runId: randomUUID(), directory, filePath }
    submissionRuns.set(run.runId, run)
    return run
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

export function registerTerminalHandlers(): void {
  ipcMain.handle('terminal:start', (event, requestedCwd: string | null) => {
    const cwd = getWorkspaceRoot() ?? requestedCwd ?? process.cwd()
    return startShell(event, cwd)
  })

  ipcMain.handle(
    'terminal:prepare-submission',
    (_event, input: SubmissionLocalRunInput): Promise<SubmissionLocalRun> =>
      prepareSubmissionRun(input)
  )

  ipcMain.handle('terminal:start-submission', (event, runId: unknown) => {
    if (typeof runId !== 'string') throw new Error('Invalid local submission run.')
    const run = submissionRuns.get(runId)
    if (!run) throw new Error('The local submission copy has expired. Reopen the terminal.')
    const cwd = startShell(event, run.directory)
    sessionRunIds.set(event.sender.id, run.runId)
    return cwd
  })

  ipcMain.on('terminal:discard-submission', (_event, runId: unknown) => {
    if (typeof runId !== 'string') return
    const run = submissionRuns.get(runId)
    if (!run) return
    for (const [sessionId, activeRunId] of sessionRunIds) {
      if (activeRunId === runId) stopSession(sessionId)
    }
    submissionRuns.delete(runId)
    void removeRunDirectory(run.directory)
  })

  ipcMain.on('terminal:write', (event, data: string) => {
    const child = sessions.get(event.sender.id)
    if (!child) return
    try {
      child.stdin.write(data)
    } catch {
      // Session ended between the check and the write.
    }
  })

  ipcMain.on('terminal:stop', (event) => {
    stopSession(event.sender.id)
  })
}
