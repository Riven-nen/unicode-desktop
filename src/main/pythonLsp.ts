import { spawn } from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { app, ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { bundledPyrightFile } from './bundledTools'
import { getWorkspaceRoot } from './fs'
import type { LspMessage, LspStartResult } from '../shared/lsp'

let child: ChildProcessWithoutNullStreams | null = null
let target: WebContents | null = null
let buffer = Buffer.alloc(0)

function sendToRenderer(message: LspMessage): void {
  if (target && !target.isDestroyed()) target.send('lsp:python-message', message)
}

function writeMessage(message: unknown): void {
  if (!child || child.killed) return
  const body = JSON.stringify(message)
  child.stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`)
}

function consume(chunk: Buffer): void {
  buffer = Buffer.concat([buffer, chunk])
  for (;;) {
    const headerEnd = buffer.indexOf('\r\n\r\n')
    if (headerEnd < 0) return
    const headers = buffer.subarray(0, headerEnd).toString('ascii')
    const match = /Content-Length:\s*(\d+)/i.exec(headers)
    const bodyStart = headerEnd + 4
    if (!match) {
      buffer = buffer.subarray(bodyStart)
      continue
    }
    const length = Number(match[1])
    if (buffer.length < bodyStart + length) return
    const body = buffer.subarray(bodyStart, bodyStart + length).toString('utf8')
    buffer = buffer.subarray(bodyStart + length)
    try {
      sendToRenderer(JSON.parse(body) as LspMessage)
    } catch {
      // Ignore malformed frames rather than tearing down the server.
    }
  }
}

function start(sender: WebContents): LspStartResult {
  // A full renderer reload replaces the WebContents, but the old language
  // server cannot be re-initialized. Restart it for the new renderer.
  const sameTarget = target === sender
  if (child && !child.killed && sameTarget) return { available: true }
  if (child) stopPythonLsp()
  target = sender

  const entry = bundledPyrightFile('langserver.index.js')
  if (!entry) {
    return { available: false, message: 'Pyright language server is not bundled.' }
  }

  buffer = Buffer.alloc(0)
  const cwd = getWorkspaceRoot() ?? app.getPath('documents')
  const processHandle = spawn(process.execPath, [entry, '--stdio'], {
    cwd,
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  })
  child = processHandle

  processHandle.stdout.on('data', consume)
  processHandle.stderr.on('data', () => {
    // Pyright logs discovery/configuration details here; they are not user
    // facing and should not interrupt the editor.
  })
  processHandle.on('error', () => {
    child = null
    buffer = Buffer.alloc(0)
    if (target && !target.isDestroyed()) target.send('lsp:python-exit', { code: null })
  })
  processHandle.on('exit', (code) => {
    child = null
    buffer = Buffer.alloc(0)
    if (target && !target.isDestroyed()) target.send('lsp:python-exit', { code })
  })

  return { available: true }
}

export function stopPythonLsp(): void {
  if (!child) return
  const processHandle = child
  child = null
  buffer = Buffer.alloc(0)
  processHandle.kill()
}

export function registerPythonLspHandlers(): void {
  ipcMain.handle('lsp:python-start', (event) => start(event.sender))
  ipcMain.on('lsp:python-send', (_event, message: unknown) => {
    if (message && typeof message === 'object') writeMessage(message)
  })
  ipcMain.on('lsp:python-stop', () => stopPythonLsp())
}
