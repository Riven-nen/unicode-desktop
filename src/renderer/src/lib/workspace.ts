/**
 * Pure path helpers for the workspace model. The renderer has no node
 * `path` module, so these cover the small set of operations it needs.
 */

/** Last segment of a path (or a bare file name). */
export function fileDisplayName(value: string): string {
  const index = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'))
  return index === -1 ? value : value.slice(index + 1)
}

/**
 * Workspace-relative file name (posix separators), or null when the path
 * sits outside the workspace. Case-insensitive, matching Windows.
 */
export function relativeToRoot(root: string, target: string): string | null {
  const normalize = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/, '')
  const rootPath = normalize(root)
  const targetPath = target.replace(/\\/g, '/')
  if (targetPath.toLowerCase() === rootPath.toLowerCase()) return ''
  if (!targetPath.toLowerCase().startsWith(`${rootPath.toLowerCase()}/`)) return null
  return targetPath.slice(rootPath.length + 1)
}

/**
 * The workspace-relative name used as a file's unique key in the app:
 * `CS 101/main.py`, or just `main.py` for files outside the workspace.
 */
export function workspaceNameFor(root: string | null, filePath: string): string {
  if (root) {
    const relative = relativeToRoot(root, filePath)
    if (relative) return relative
  }
  return fileDisplayName(filePath)
}

/** Directory part of a path, or null for a bare name. */
export function dirnameOf(value: string): string | null {
  const index = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'))
  return index <= 0 ? null : value.slice(0, index)
}

/** Suggested path for a save dialog: next to the active file, else root. */
export function defaultSavePath(
  root: string | null,
  activeFilePath: string | undefined,
  fileName: string
): string {
  const activeDir = activeFilePath ? dirnameOf(activeFilePath) : null
  if (activeDir) return `${activeDir}/${fileDisplayName(fileName)}`
  if (root) return `${root.replace(/[\\/]+$/, '')}/${fileDisplayName(fileName)}`
  return fileDisplayName(fileName)
}
