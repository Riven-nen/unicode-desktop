import { execFile } from 'child_process'
import { ipcMain } from 'electron'
import { editorOnlyStatus, toolchainSpecFor } from '../shared/toolchains'
import type { ToolchainStatus } from '../shared/toolchains'

const cache = new Map<string, ToolchainStatus>()

/** Checks PATH for one executable without launching it. */
function commandExists(command: string): Promise<boolean> {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which'
  return new Promise((resolve) => {
    execFile(finder, [command], { timeout: 3000, windowsHide: true }, (error) => {
      resolve(!error)
    })
  })
}

async function checkToolchain(language: string, refresh: boolean): Promise<ToolchainStatus> {
  const key = language.trim().toLowerCase()
  if (!refresh) {
    const cached = cache.get(key)
    if (cached) return cached
  }

  const spec = toolchainSpecFor(key)
  if (!spec) {
    const status = editorOnlyStatus(key)
    cache.set(key, status)
    return status
  }

  const results = await Promise.all(
    spec.commands.map(async (command) => ({
      command,
      found: await commandExists(command)
    }))
  )
  const found = results.filter((result) => result.found).map((result) => result.command)
  const missing = results.filter((result) => !result.found).map((result) => result.command)
  const available = spec.anyOf ? found.length > 0 : missing.length === 0

  const status: ToolchainStatus = {
    language: key,
    required: true,
    label: spec.label,
    available,
    found,
    missing,
    hint: spec.hint
  }
  cache.set(key, status)
  return status
}

export function registerToolchainHandlers(): void {
  ipcMain.handle('toolchains:check', (_event, language: unknown, refresh: unknown) =>
    checkToolchain(typeof language === 'string' ? language : '', refresh === true)
  )
}
