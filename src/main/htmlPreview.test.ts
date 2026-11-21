import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mocked = vi.hoisted(() => ({ workspace: '' }))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  }
}))

vi.mock('./fs', () => ({
  getWorkspaceRoot: () => mocked.workspace
}))

import { startFilePreview, startPreview, stopPreview, updatePreview } from './htmlPreview'

describe('HTML preview server', () => {
  it('serves the document on loopback and rewrites it on update', async () => {
    const session = await startPreview('<h1>first</h1>')
    try {
      expect(session.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/index\.html$/)

      const first = await fetch(session.url)
      expect(first.status).toBe(200)
      expect(first.headers.get('content-type')).toContain('text/html')
      expect(first.headers.get('cache-control')).toBe('no-store')
      expect(await first.text()).toBe('<h1>first</h1>')

      await updatePreview(session.id, '<h1>second</h1>')
      const second = await fetch(session.url)
      expect(await second.text()).toBe('<h1>second</h1>')
    } finally {
      stopPreview(session.id)
    }
  })

  it('serves a class folder while overlaying the live file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'unicode-preview-test-'))
    try {
      await writeFile(join(root, 'index.html'), '<h1>on disk</h1>', 'utf8')
      await writeFile(join(root, 'style.css'), 'body { color: teal; }', 'utf8')
      mocked.workspace = root

      const session = await startFilePreview({
        root,
        filePath: join(root, 'index.html'),
        html: '<link rel="stylesheet" href="style.css" /><h1>live</h1>'
      })

      try {
        const page = await fetch(session.url)
        const html = await page.text()
        expect(html).toContain('<h1>live</h1>')

        const cssUrl = new URL('style.css', session.url).toString()
        const css = await fetch(cssUrl)
        expect(await css.text()).toBe('body { color: teal; }')
        expect(await readFile(join(root, 'index.html'), 'utf8')).toBe('<h1>on disk</h1>')

        await updatePreview(session.id, '<h1>updated live</h1>')
        const updated = await fetch(session.url)
        expect(await updated.text()).toContain('<h1>updated live</h1>')
      } finally {
        stopPreview(session.id)
      }
    } finally {
      mocked.workspace = ''
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects updates for a closed session', async () => {
    await expect(updatePreview('missing-session', '<p>nope</p>')).rejects.toThrow(
      'This preview session has closed.'
    )
  })
})
