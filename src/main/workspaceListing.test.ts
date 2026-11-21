import { describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mocked = vi.hoisted(() => ({
  documents: '',
  handlers: new Map<string, (...args: unknown[]) => unknown>()
}))

vi.mock('electron', () => ({
  app: { getPath: () => mocked.documents },
  BrowserWindow: { fromWebContents: () => null },
  dialog: {},
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      mocked.handlers.set(channel, handler)
    },
    on: vi.fn()
  },
  shell: {}
}))

import { listWorkspace, registerFsHandlers } from './fs'

describe('workspace listing', () => {
  it('recursively lists project folders and classifies images', async () => {
    const root = await mkdtemp(join(tmpdir(), 'unicode-workspace-test-'))
    try {
      await mkdir(join(root, 'HTML101', 'profile-project'), { recursive: true })
      await writeFile(join(root, 'notes.md'), '# notes', 'utf8')
      await writeFile(join(root, 'HTML101', 'index.html'), '<h1>home</h1>', 'utf8')
      await writeFile(join(root, 'HTML101', 'profile-project', 'styles.css'), 'body{}', 'utf8')
      await writeFile(join(root, 'HTML101', 'profile-project', 'photo.png'), 'not-a-real-png')
      await writeFile(join(root, 'HTML101', '.hidden'), 'ignore me', 'utf8')

      const listing = await listWorkspace(root)
      expect(listing.files).toHaveLength(1)
      expect(listing.files[0]).toMatchObject({ name: 'notes.md', kind: 'text' })

      const course = listing.courses.find((item) => item.name === 'HTML101')
      expect(course).toBeDefined()
      expect(course?.files.map((file) => file.name)).toEqual(['index.html'])
      expect(course?.folders.map((folder) => folder.name)).toEqual(['profile-project'])

      const project = course?.folders[0]
      expect(project?.files.map((file) => `${file.name}:${file.kind}`)).toEqual([
        'photo.png:image',
        'styles.css:text'
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('assignment paths', () => {
  it('creates nested project paths and rejects traversal', async () => {
    const documents = await mkdtemp(join(tmpdir(), 'unicode-assignment-test-'))
    mocked.documents = documents
    mocked.handlers.clear()
    registerFsHandlers()

    const bootstrap = mocked.handlers.get('fs:bootstrap-workspace')
    const ensure = mocked.handlers.get('fs:ensure-assignment-file')
    expect(bootstrap).toBeDefined()
    expect(ensure).toBeDefined()

    try {
      const root = (await bootstrap?.()) as string
      expect(root.endsWith(join('Unicode Lab'))).toBe(true)

      const result = (await ensure?.(
        {},
        root,
        'HTML101',
        'profile-project/index.html',
        '<h1>project</h1>'
      )) as { path: string; fileName: string }

      expect(result.fileName).toBe('HTML101/profile-project/index.html')
      expect(await readFile(result.path, 'utf8')).toBe('<h1>project</h1>')

      await expect(
        ensure?.({}, root, 'HTML101', '../escape.html', '<h1>nope</h1>')
      ).rejects.toThrow()
    } finally {
      await rm(documents, { recursive: true, force: true })
    }
  })
})
