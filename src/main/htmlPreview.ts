import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { getWorkspaceRoot } from './fs'
import type { HtmlPreviewFileInput, HtmlPreviewSession } from '../shared/preview'

interface PreviewSession {
  id: string
  server: Server
  root: string
  url: string
  /** Workspace-relative POSIX path that receives the live editor content. */
  overlayPath: string
  overlayContent: string
  /** Temporary folder to remove on stop; null when serving a class folder. */
  tempRoot: string | null
}

const sessions = new Map<string, PreviewSession>()
const MAX_HTML_BYTES = 5 * 1024 * 1024

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8'
}

const mimeFor = (filePath: string): string =>
  MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'

const comparePath = (value: string): string =>
  process.platform === 'win32' ? value.toLowerCase() : value

/** Workspace-relative POSIX path, or null when target escapes the root. */
function relativeInside(root: string, target: string): string | null {
  const rel = relative(root, target).replace(/\\/g, '/')
  if (!rel || rel === '.' || rel.startsWith('../') || rel === '..') return null
  return rel
}

/** Resolve a URL path inside the session root, rejecting traversal. */
function resolveRequestPath(root: string, requestUrl: string | undefined): string | null {
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname)
  } catch {
    return null
  }
  if (pathname.includes('\0')) return null
  if (pathname === '/') pathname = '/index.html'

  const target = resolve(join(root, normalize(pathname).replace(/^([/\\])+/, '')))
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`
  if (
    comparePath(target) !== comparePath(root) &&
    !comparePath(target).startsWith(comparePath(rootWithSep))
  ) {
    return null
  }
  return target
}

async function serveFile(
  session: PreviewSession,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end()
    return
  }

  const filePath = resolveRequestPath(session.root, request.url)
  const rel = filePath ? relativeInside(session.root, filePath) : null
  if (!filePath || !rel) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Bad request')
    return
  }

  try {
    let content: Buffer
    if (comparePath(rel) === comparePath(session.overlayPath)) {
      content = Buffer.from(session.overlayContent, 'utf8')
    } else {
      const details = await stat(filePath)
      if (!details.isFile()) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        response.end('Not found')
        return
      }
      content = await readFile(filePath)
    }

    response.writeHead(200, {
      'Content-Type': mimeFor(filePath),
      'Content-Length': content.byteLength,
      // The editor rewrites the preview overlay, so previews must never cache.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    })
    if (request.method === 'HEAD') response.end()
    else response.end(content)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
}

function assertHtml(html: string): void {
  if (typeof html !== 'string') throw new Error('Preview content must be text.')
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    throw new Error('This preview is too large (5 MB limit).')
  }
}

/** Only class folders inside the active workspace may be served. */
function assertPreviewRoot(root: string): string {
  const workspace = getWorkspaceRoot()
  if (!workspace) throw new Error('Open the workspace before previewing a file.')

  const workspacePath = resolve(workspace)
  const rootPath = resolve(root)
  const workspaceWithSep = comparePath(
    workspacePath.endsWith(sep) ? workspacePath : `${workspacePath}${sep}`
  )
  const comparedRoot = comparePath(rootPath)
  if (comparedRoot !== comparePath(workspacePath) && !comparedRoot.startsWith(workspaceWithSep)) {
    throw new Error('Preview is limited to files inside the workspace.')
  }
  return rootPath
}

async function createSession(input: {
  root: string
  overlayPath: string
  html: string
  urlPath: string
  tempRoot: string | null
}): Promise<HtmlPreviewSession> {
  const id = randomUUID()
  const server = createServer((request, response) => {
    void serveFile(session, request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500)
      response.end()
    })
  })

  // Assigned before listen; requests cannot arrive before the server starts.
  const session: PreviewSession = {
    id,
    server,
    root: input.root,
    url: '',
    overlayPath: input.overlayPath,
    overlayContent: input.html,
    tempRoot: input.tempRoot
  }

  try {
    await new Promise<void>((resolveStart, rejectStart) => {
      server.once('error', rejectStart)
      server.listen(0, '127.0.0.1', () => {
        server.off('error', rejectStart)
        resolveStart()
      })
    })
  } catch (error) {
    server.close()
    if (input.tempRoot) await rm(input.tempRoot, { recursive: true, force: true })
    throw error
  }

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    if (input.tempRoot) await rm(input.tempRoot, { recursive: true, force: true })
    throw new Error('Could not determine the preview server port.')
  }

  session.url = `http://127.0.0.1:${address.port}/${input.urlPath}`
  sessions.set(id, session)
  return { id, url: session.url }
}

/** ICS playground: a self-contained document in a fresh temporary folder. */
export async function startPreview(html: string): Promise<HtmlPreviewSession> {
  assertHtml(html)
  const root = await mkdtemp(join(tmpdir(), 'unicode-lab-preview-'))
  try {
    await writeFile(join(root, 'index.html'), html, 'utf8')
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }

  try {
    return await createSession({
      root,
      overlayPath: 'index.html',
      html,
      urlPath: 'index.html',
      tempRoot: root
    })
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

/** Workspace file preview: serves its class folder so linked assets resolve. */
export async function startFilePreview(input: HtmlPreviewFileInput): Promise<HtmlPreviewSession> {
  assertHtml(input.html)
  const root = assertPreviewRoot(input.root)
  const details = await stat(root)
  if (!details.isDirectory()) throw new Error('The preview root is not a folder.')

  const filePath = resolve(input.filePath)
  const overlayPath = relativeInside(root, filePath)
  if (!overlayPath) throw new Error('That file is outside the preview folder.')

  const extension = extname(filePath).toLowerCase()
  if (extension !== '.html' && extension !== '.htm') {
    throw new Error('Only HTML files can be previewed.')
  }

  const urlPath = overlayPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  return createSession({
    root,
    overlayPath,
    html: input.html,
    urlPath,
    tempRoot: null
  })
}

export async function updatePreview(id: string, html: string): Promise<HtmlPreviewSession> {
  assertHtml(html)
  const session = sessions.get(id)
  if (!session) throw new Error('This preview session has closed.')
  session.overlayContent = html
  return { id: session.id, url: session.url }
}

/** Stops one preview server and removes its temp folder, when it owns one. */
export function stopPreview(id: string): void {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  try {
    session.server.closeAllConnections?.()
    session.server.close()
  } catch {
    // The server may already be closing during app shutdown.
  }
  if (!session.tempRoot) return
  try {
    rmSync(session.tempRoot, { recursive: true, force: true })
  } catch {
    // Temp cleanup is best-effort; the OS will clear it eventually.
  }
}

export function stopAllPreviews(): void {
  for (const id of Array.from(sessions.keys())) stopPreview(id)
}

export function registerHtmlPreviewHandlers(): void {
  ipcMain.handle('preview:start', (_event, html: string) => startPreview(html))
  ipcMain.handle('preview:start-file', (_event, input: HtmlPreviewFileInput) =>
    startFilePreview(input)
  )
  ipcMain.handle('preview:update', (_event, id: string, html: string) => updatePreview(id, html))
  ipcMain.on('preview:stop', (_event, id: string) => stopPreview(id))
}
