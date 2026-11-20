import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import type {
  AssignmentFileResult,
  CloseChoice,
  WorkspaceCourse,
  WorkspaceFile,
  WorkspaceListing
} from '../shared/workspace'

/**
 * Filesystem bridge for the workspace model:
 *
 *   <workspace root>/           student picks this once (defaults to
 *     <course folder>/          Documents/Unicode Lab)
 *       file.ext
 *
 * Access is workspace-scoped: reads/writes are only permitted inside the
 * chosen workspace root, or on files the student explicitly picked in a
 * dialog. Anything else is rejected — the renderer can't wander the disk.
 */

// File types the editor can meaningfully open (keeps binaries out of Monaco).
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.py',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.cc',
  '.hpp',
  '.cs',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.css',
  '.html',
  '.xml',
  '.sql',
  '.sh',
  '.rb',
  '.php',
  '.go',
  '.rs',
  '.kt',
  '.swift',
  '.yml',
  '.yaml',
  '.toml',
  '.ini'
])

// Characters Windows rejects in filenames.
const INVALID_NAME_CHARS = /[<>:"/\\|?*]/

/** Rejects the invisible C0 control range Windows also forbids. */
function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1f) return true
  }
  return false
}

let workspaceRoot: string | null = null
// Paths the student explicitly chose through a dialog (normalized, lowercase).
const allowedPaths = new Set<string>()

/** The active workspace root, used by the terminal to pick a safe cwd. */
export function getWorkspaceRoot(): string | null {
  return workspaceRoot
}

function normalize(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '')
}

function allowPath(value: string): void {
  allowedPaths.add(normalize(value).toLowerCase())
}

function isAllowed(target: string): boolean {
  const normalized = normalize(target).toLowerCase()
  if (allowedPaths.has(normalized)) return true
  if (!workspaceRoot) return false
  const root = normalize(workspaceRoot).toLowerCase()
  return normalized === root || normalized.startsWith(`${root}/`)
}

function assertAllowed(target: string): void {
  if (!isAllowed(target)) {
    throw new Error('Access denied: that path is outside the workspace.')
  }
}

function assertSimpleName(name: string): void {
  const trimmed = name.trim()
  if (!trimmed || trimmed === '.' || trimmed === '..') {
    throw new Error('Please choose a file or folder name.')
  }
  if (INVALID_NAME_CHARS.test(trimmed) || hasControlChars(trimmed)) {
    throw new Error('Names cannot contain < > : " / \\ | ? *')
  }
}

// Windows reserves these device names in every folder.
const RESERVED_FOLDER_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/**
 * Turns a database course code/title into a safe folder name. Course names
 * are authored by professors, so they may contain characters Windows rejects.
 */
function sanitizeFolderName(raw: string): string {
  let cleaned = ''
  for (const char of raw) {
    if (char.charCodeAt(0) < 0x20) continue
    cleaned += INVALID_NAME_CHARS.test(char) ? '-' : char
  }
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
    .trim()
  if (!cleaned) return 'Course'
  if (RESERVED_FOLDER_NAMES.test(cleaned)) return `_${cleaned}`
  return cleaned
}

function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.has(extname(name).toLowerCase())
}

async function listFilesIn(dir: string): Promise<WorkspaceFile[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && isTextFile(entry.name))
    .map((entry) => ({ name: entry.name, path: join(dir, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function listWorkspace(root: string): Promise<WorkspaceListing> {
  const info = await stat(root)
  if (!info.isDirectory()) throw new Error('The workspace path is not a folder.')

  const entries = await readdir(root, { withFileTypes: true })
  const courses: WorkspaceCourse[] = []
  const files: WorkspaceFile[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) {
      courses.push({
        name: entry.name,
        path: fullPath,
        files: await listFilesIn(fullPath)
      })
    } else if (entry.isFile() && isTextFile(entry.name)) {
      files.push({ name: entry.name, path: fullPath })
    }
  }

  courses.sort((a, b) => a.name.localeCompare(b.name))
  files.sort((a, b) => a.name.localeCompare(b.name))
  return { root, courses, files }
}

function parentWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerFsHandlers(): void {
  // The student workspace is fixed to Documents/Unicode Lab. There is no
  // workspace picker; class folders live inside this single root.
  ipcMain.handle('fs:bootstrap-workspace', async () => {
    const root = join(app.getPath('documents'), 'Unicode Lab')
    await mkdir(root, { recursive: true })
    workspaceRoot = root
    allowPath(root)
    return workspaceRoot
  })

  ipcMain.handle('fs:pick-file', async (event) => {
    const window = parentWindow(event)
    const options: Electron.OpenDialogOptions = {
      title: 'Open File',
      properties: ['openFile']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    allowPath(result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle('fs:list-workspace', async (_event, root: string) => {
    assertAllowed(root)
    return listWorkspace(root)
  })

  ipcMain.handle('fs:read-file', async (_event, filePath: string) => {
    assertAllowed(filePath)
    const content = await readFile(filePath, 'utf8')
    allowPath(filePath)
    return content
  })

  ipcMain.handle('fs:write-file', async (_event, filePath: string, content: string) => {
    assertAllowed(filePath)
    await writeFile(filePath, content, 'utf8')
    allowPath(filePath)
    return filePath
  })

  ipcMain.handle('fs:save-file-as', async (event, defaultPath: string, content: string) => {
    const window = parentWindow(event)
    const options: Electron.SaveDialogOptions = { title: 'Save File As', defaultPath }
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, content, 'utf8')
    allowPath(result.filePath)
    return result.filePath
  })

  ipcMain.handle('fs:create-file', async (_event, dir: string, name: string) => {
    assertAllowed(dir)
    assertSimpleName(name)
    if (!isTextFile(name)) {
      throw new Error('Only text and code files can be created in a course folder.')
    }
    const filePath = join(dir, name)
    // 'wx' fails when the file already exists, so we never clobber work.
    await writeFile(filePath, '', { encoding: 'utf8', flag: 'wx' })
    allowPath(filePath)
    return filePath
  })

  // Creates one folder per enrolled course. Idempotent: existing folders are
  // reused, duplicate names in the same batch get a numeric suffix, and
  // nothing is ever deleted when an enrollment goes away.
  ipcMain.handle('fs:ensure-courses', async (_event, root: string, names: string[]) => {
    assertAllowed(root)
    const used = new Set<string>()
    for (const raw of names) {
      const base = sanitizeFolderName(raw)
      let name = base
      let suffix = 2
      while (used.has(name.toLowerCase())) {
        name = `${base} (${suffix})`
        suffix += 1
      }
      used.add(name.toLowerCase())
      const coursePath = join(root, name)
      await mkdir(coursePath, { recursive: true })
      allowPath(coursePath)
    }
    return listWorkspace(root)
  })

  // Opens (creating if needed) the workspace file an assignment points at.
  // Existing files are never overwritten — starter code only seeds new files.
  ipcMain.handle(
    'fs:ensure-assignment-file',
    async (
      _event,
      root: string,
      courseName: string,
      fileName: string,
      starterCode = ''
    ): Promise<AssignmentFileResult> => {
      assertAllowed(root)
      const safeName = fileName.trim()
      assertSimpleName(safeName)
      if (!isTextFile(safeName)) {
        throw new Error('Assignments must point at a text or code file.')
      }
      const folder = sanitizeFolderName(courseName)
      const dir = join(root, folder)
      await mkdir(dir, { recursive: true })
      allowPath(dir)
      const filePath = join(dir, safeName)
      let created = false
      try {
        // 'wx' fails when the file already exists, so student work survives.
        await writeFile(filePath, starterCode, { encoding: 'utf8', flag: 'wx' })
        created = true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
      allowPath(filePath)
      return { path: filePath, fileName: `${folder}/${safeName}`, created }
    }
  )

  // Native Save / Don't Save / Cancel prompt for dirty tabs.
  ipcMain.handle('fs:confirm-close', async (event, fileName: string): Promise<CloseChoice> => {
    const window = parentWindow(event)
    const options: Electron.MessageBoxOptions = {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'Unsaved Changes',
      message: `Save changes to "${basename(fileName)}"?`,
      detail: 'Your changes will be lost if you close without saving.'
    }
    const result = window
      ? await dialog.showMessageBox(window, options)
      : await dialog.showMessageBox(options)
    if (result.response === 0) return 'save'
    if (result.response === 1) return 'discard'
    return 'cancel'
  })

  // Renames a file inside the workspace. Refuses to overwrite an existing
  // file; case-only renames are allowed on case-insensitive filesystems.
  ipcMain.handle('fs:rename-file', async (_event, filePath: string, newName: string) => {
    assertAllowed(filePath)
    assertSimpleName(newName)
    const safeName = newName.trim()
    if (!isTextFile(safeName)) {
      throw new Error('Only text and code files can be renamed.')
    }
    const target = join(dirname(filePath), safeName)
    const caseOnly = target.toLowerCase() === filePath.toLowerCase()
    if (!caseOnly) {
      try {
        await stat(target)
        throw new Error(`A file named "${safeName}" already exists here.`)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    await rename(filePath, target)
    allowPath(target)
    return target
  })

  // Deletes a single file. Folders are never deleted from the editor.
  ipcMain.handle('fs:delete-file', async (_event, filePath: string) => {
    assertAllowed(filePath)
    const info = await stat(filePath)
    if (!info.isFile()) throw new Error('Only files can be deleted.')
    await unlink(filePath)
    return true
  })

  // Generic confirmation dialog for destructive or irreversible actions.
  ipcMain.handle(
    'app:confirm',
    async (
      event,
      options: {
        title: string
        message: string
        detail?: string
        confirmLabel?: string
        danger?: boolean
      }
    ): Promise<boolean> => {
      const window = parentWindow(event)
      const messageOptions: Electron.MessageBoxOptions = {
        type: options.danger ? 'warning' : 'question',
        buttons: [options.confirmLabel ?? 'Confirm', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        title: options.title,
        message: options.message,
        detail: options.detail
      }
      const result = window
        ? await dialog.showMessageBox(window, messageOptions)
        : await dialog.showMessageBox(messageOptions)
      return result.response === 0
    }
  )
}
