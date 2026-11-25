import type {
  Judge0PublicConfig,
  Judge0RawResult,
  Judge0SaveConfigInput,
  Judge0Status
} from '../../../shared/judge0'
import type { TestCaseEntry } from '../types/professor'

/**
 * Judge0 bridge. The actual HTTP call, endpoint, and token live in the main
 * process; the renderer only selects a language, sends source/tests, and gets
 * results back. The endpoint is fixed by the app; only an optional token is
 * configured from the UI.
 */

export const LANGUAGE_IDS: Record<string, number> = {
  python: 71,
  java: 62,
  c: 50,
  cpp: 54,
  javascript: 63
}

export function languageIdFor(language: string | null): number | null {
  if (!language) return null
  return LANGUAGE_IDS[language] ?? null
}

function bridge(): Window['api']['judge0'] {
  if (!window.api?.judge0) {
    throw new Error('Judge0 is only available in the desktop app.')
  }
  return window.api.judge0
}

export function getJudge0Config(): Promise<Judge0PublicConfig> {
  return bridge().getConfig()
}

export function saveJudge0Config(input: Judge0SaveConfigInput): Promise<Judge0PublicConfig> {
  return bridge().saveConfig(input)
}

export function testJudge0(): Promise<Judge0Status> {
  return bridge().status()
}

/** Strips Electron's IPC wrapper from a main-process error. */
export function friendlyJudge0Error(error: unknown): string {
  if (!(error instanceof Error)) return 'The Judge0 request failed.'
  return error.message.replace(/^Error invoking remote method '[^']+': Error:\s*/, '')
}

export interface Judge0CaseResult {
  testCaseId: string
  pass: boolean
  status: string
  statusId: number
  stdout: string
  stderr: string
  compileOutput: string
  time: string | null
  timeSeconds: number | null
  memory: number | null
}

const MAX_TEST_CASES = 20

const normalizeOutput = (value: string | null | undefined): string =>
  (value ?? '').replace(/\r\n/g, '\n').trimEnd()

/** Run one source file with optional stdin (student Run panel). */
export function runSource(input: {
  source: string
  language: string | null
  stdin: string
  expectedOutput?: string
}): Promise<Judge0RawResult> {
  const languageId = languageIdFor(input.language)
  if (!languageId) {
    throw new Error(`Judge0 has no language id for "${input.language ?? 'unknown'}".`)
  }
  return bridge().run({
    source: input.source,
    languageId,
    stdin: input.stdin,
    expectedOutput: input.expectedOutput ?? ''
  })
}

export async function runTestCases(input: {
  source: string
  language: string | null
  testCases: TestCaseEntry[]
}): Promise<Judge0CaseResult[]> {
  const languageId = languageIdFor(input.language)
  if (!languageId) {
    throw new Error(`Judge0 has no language id for "${input.language ?? 'unknown'}".`)
  }
  if (input.testCases.length > MAX_TEST_CASES) {
    throw new Error(`Run at most ${MAX_TEST_CASES} test cases at a time.`)
  }

  const client = bridge()
  const results: Judge0CaseResult[] = []

  for (const testCase of input.testCases) {
    const raw = await client.run({
      source: input.source,
      languageId,
      stdin: testCase.stdin ?? '',
      expectedOutput: testCase.expectedStdout ?? ''
    })
    results.push({
      testCaseId: testCase.id,
      pass:
        raw.statusId === 3 &&
        normalizeOutput(raw.stdout) === normalizeOutput(testCase.expectedStdout),
      status: raw.statusDescription,
      statusId: raw.statusId,
      stdout: raw.stdout,
      stderr: raw.stderr,
      compileOutput: raw.compileOutput,
      time: raw.time,
      timeSeconds: raw.time === null ? null : Number(raw.time),
      memory: raw.memory
    })
  }
  return results
}
