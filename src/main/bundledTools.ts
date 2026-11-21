import { existsSync } from 'fs'
import { join, sep } from 'path'
import { app } from 'electron'

/**
 * Resolves a file from the bundled Pyright package, including when the app is
 * packaged into an asar archive with `node_modules/pyright/**` unpacked.
 */
export function bundledPyrightFile(name: string): string | null {
  const base = join(app.getAppPath(), 'node_modules', 'pyright', name)
  const unpacked = base.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`)
  if (unpacked !== base && existsSync(unpacked)) return unpacked
  return existsSync(base) ? base : null
}
