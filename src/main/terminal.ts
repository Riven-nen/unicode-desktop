import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { getWorkspaceRoot } from './fs'
import type { TerminalDataEvent, TerminalExitEvent } from '../shared/terminal'

/**
 * A local PowerShell session for the student terminal. This is deliberately
 * separate from Judge0: it runs commands against the real workspace and is
 * never used for graded test cases.
 */

const sessions = new Map<number, ChildProcessWithoutNullStreams>()

function stopSession(id: number): void {
  const child = sessions.get(id)
  if (!child) return
  sessions.delete(id)
  try {
    child.stdin.end()
    child.kill()
  } catch {
    // Already gone.
  }
}

export function stopAllTerminals(): void {
  for (const id of Array.from(sessions.keys())) stopSession(id)
}

export function registerTerminalHandlers(): void {
  ipcMain.handle('terminal:start', (event, requestedCwd: string | null) => {
    const id = event.sender.id
    stopSession(id)

    const cwd = getWorkspaceRoot() ?? requestedCwd ?? process.cwd()
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
