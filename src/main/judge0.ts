import { app, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  Judge0PublicConfig,
  Judge0RawResult,
  Judge0RunInput,
  Judge0SaveConfigInput,
  Judge0Status
} from '../shared/judge0'

/**
 * Judge0 runs in the main process so the renderer never sees the auth token,
 * and so local Judge0 instances don't hit renderer CORS rules.
 *
 * Configuration lives in the app's userData folder (judge0.json). Environment
 * variables JUDGE0_URL / JUDGE0_KEY act as a fallback when no file exists.
 */

interface StoredConfig {
  token: string
}

const MAX_SOURCE_CHARS = 120_000
const DEFAULT_TIMEOUT_MS = 30_000
// Simple sliding-window guard so a stuck loop in the UI cannot hammer Judge0.
const RATE_WINDOW_MS = 60_000
const MAX_RUNS_PER_WINDOW = 30
const runTimestamps: number[] = []

// The endpoint is fixed for the app build and never exposed in the UI.
// Override it at launch with JUDGE0_URL when testing another instance.
const DEFAULT_ENDPOINT = 'http://localhost:2358'

function configPath(): string {
  return join(app.getPath('userData'), 'judge0.json')
}

function normalizeEndpoint(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('The Judge0 endpoint must be a full URL, e.g. http://localhost:2358.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('The Judge0 endpoint must start with http:// or https://.')
  }
  return trimmed
}

async function readStoredConfig(): Promise<StoredConfig | null> {
  try {
    const raw = await readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoredConfig>
    return {
      token: typeof parsed.token === 'string' ? parsed.token : ''
    }
  } catch {
    return null
  }
}

function safeEndpoint(value: string): string {
  try {
    return normalizeEndpoint(value)
  } catch {
    return ''
  }
}

async function effectiveConfig(): Promise<{ endpoint: string; token: string }> {
  const stored = await readStoredConfig()
  return {
    endpoint: safeEndpoint(process.env.JUDGE0_URL ?? DEFAULT_ENDPOINT),
    token: stored?.token ?? process.env.JUDGE0_KEY ?? ''
  }
}

function publicConfig(config: { endpoint: string; token: string }): Judge0PublicConfig {
  return {
    hasToken: config.token.length > 0,
    configured: config.endpoint.length > 0
  }
}

function headersFor(endpoint: string, token: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!token) return headers

  const host = new URL(endpoint).host
  if (host.includes('rapidapi.com')) {
    headers['X-RapidAPI-Key'] = token
    headers['X-RapidAPI-Host'] = host
  } else {
    headers['X-Auth-Token'] = token
  }
  return headers
}

interface Judge0Response {
  stdout: string | null
  stderr: string | null
  compile_output: string | null
  message: string | null
  status: { id: number; description: string } | null
  time: string | null
  memory: number | null
}

async function runSubmission(input: Judge0RunInput): Promise<Judge0RawResult> {
  const now = Date.now()
  while (runTimestamps.length > 0 && now - runTimestamps[0] > RATE_WINDOW_MS) {
    runTimestamps.shift()
  }
  if (runTimestamps.length >= MAX_RUNS_PER_WINDOW) {
    throw new Error('Judge0 is receiving requests too quickly. Wait a moment and try again.')
  }

  const config = await effectiveConfig()
  if (!config.endpoint) {
    throw new Error('Judge0 is not available in this build. Check the JUDGE0_URL configuration.')
  }
  if (!Number.isInteger(input.languageId) || input.languageId <= 0) {
    throw new Error('No Judge0 language id was provided for this assignment.')
  }
  if (input.source.length > MAX_SOURCE_CHARS) {
    throw new Error(`The source is too large for Judge0 (limit ${MAX_SOURCE_CHARS} chars).`)
  }

  runTimestamps.push(now)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(`${config.endpoint}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers: headersFor(config.endpoint, config.token),
      body: JSON.stringify({
        source_code: input.source,
        language_id: input.languageId,
        stdin: input.stdin,
        expected_output: input.expectedOutput
      }),
      signal: controller.signal
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Judge0 responded with HTTP ${response.status}: ${text.slice(0, 240)}`)
    }

    const data = JSON.parse(text) as Judge0Response
    return {
      stdout: data.stdout ?? '',
      stderr: data.stderr ?? '',
      compileOutput: data.compile_output ?? '',
      message: data.message ?? null,
      statusId: data.status?.id ?? 0,
      statusDescription: data.status?.description ?? 'Unknown',
      time: data.time ?? null,
      memory: data.memory ?? null
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Judge0 timed out before returning a result.', { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function checkStatus(): Promise<Judge0Status> {
  const config = await effectiveConfig()
  if (!config.endpoint) {
    return { ok: false, configured: false, message: 'Judge0 is not configured.' }
  }

  try {
    let response = await fetch(`${config.endpoint}/about`, {
      headers: headersFor(config.endpoint, config.token)
    })
    if (response.status === 404) {
      response = await fetch(`${config.endpoint}/system_info`, {
        headers: headersFor(config.endpoint, config.token)
      })
    }
    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        message: `Judge0 responded with HTTP ${response.status}. Check the endpoint and token.`
      }
    }
    let version: string | undefined
    try {
      const data = (await response.json()) as { version?: string }
      version = data.version
    } catch {
      // /about can be plain text on some deployments.
    }
    return {
      ok: true,
      configured: true,
      message: 'Connected to Judge0.',
      version
    }
  } catch (error) {
    return {
      ok: false,
      configured: true,
      message:
        error instanceof Error
          ? `Could not reach Judge0: ${error.message}`
          : 'Could not reach Judge0.'
    }
  }
}

export function registerJudge0Handlers(): void {
  ipcMain.handle('judge0:get-config', async (): Promise<Judge0PublicConfig> => {
    return publicConfig(await effectiveConfig())
  })

  ipcMain.handle(
    'judge0:save-config',
    async (_event, input: Judge0SaveConfigInput): Promise<Judge0PublicConfig> => {
      const current = await effectiveConfig()
      let token = current.token
      if (input.token === null) token = ''
      else if (typeof input.token === 'string' && input.token.length > 0) token = input.token.trim()

      const next: StoredConfig = { token }
      await writeFile(configPath(), JSON.stringify(next, null, 2), 'utf8')
      return publicConfig({ endpoint: current.endpoint, token })
    }
  )

  ipcMain.handle('judge0:run', async (_event, input: Judge0RunInput): Promise<Judge0RawResult> => {
    return runSubmission(input)
  })

  ipcMain.handle('judge0:status', async (): Promise<Judge0Status> => {
    return checkStatus()
  })
}
