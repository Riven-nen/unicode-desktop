import type { TestCaseEntry } from '../types/professor'

/**
 * Minimal Judge0 client for the professor test runner.
 *
 * Configure it with VITE_JUDGE0_URL (e.g. http://localhost:2358 for the
 * self-hosted Docker image). VITE_JUDGE0_KEY is optional and is sent as
 * X-Auth-Token. The button is disabled when the URL is absent, so the UI
 * never pretends a run happened.
 *
 * Note: because this runs in the renderer, a Judge0 key would be visible to
 * the client. For a public deployment, proxy these calls through the main
 * process (or an edge function) instead.
 */

const JUDGE0_URL = import.meta.env.VITE_JUDGE0_URL?.replace(/\/+$/, '') ?? ''
const JUDGE0_KEY = import.meta.env.VITE_JUDGE0_KEY ?? ''

export const isJudge0Configured = JUDGE0_URL.length > 0

const LANGUAGE_IDS: Record<string, number> = {
  python: 71,
  java: 62,
  c: 50,
  cpp: 54,
  csharp: 51,
  javascript: 63,
  typescript: 74,
  go: 60,
  rust: 73,
  ruby: 72,
  php: 68,
  swift: 83,
  kotlin: 78
}

export interface Judge0CaseResult {
  testCaseId: string
  pass: boolean
  status: string
  stdout: string
  stderr: string
  compileOutput: string
  time: string | null
  memory: number | null
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

const normalizeOutput = (value: string | null | undefined): string =>
  (value ?? '').replace(/\r\n/g, '\n').trimEnd()

export async function runTestCases(input: {
  source: string
  language: string | null
  testCases: TestCaseEntry[]
}): Promise<Judge0CaseResult[]> {
  if (!JUDGE0_URL) {
    throw new Error('Judge0 is not configured. Set VITE_JUDGE0_URL to enable test runs.')
  }
  const languageId = input.language ? LANGUAGE_IDS[input.language] : undefined
  if (!languageId) {
    throw new Error(`Judge0 has no language id for "${input.language ?? 'unknown'}".`)
  }

  const results: Judge0CaseResult[] = []
  for (const testCase of input.testCases) {
    const response = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(JUDGE0_KEY ? { 'X-Auth-Token': JUDGE0_KEY } : {})
      },
      body: JSON.stringify({
        source_code: input.source,
        language_id: languageId,
        stdin: testCase.stdin ?? '',
        expected_output: testCase.expectedStdout ?? ''
      })
    })

    if (!response.ok) {
      throw new Error(`Judge0 returned HTTP ${response.status}.`)
    }

    const data = (await response.json()) as Judge0Response
    const stdout = data.stdout ?? ''
    results.push({
      testCaseId: testCase.id,
      pass:
        data.status?.id === 3 &&
        normalizeOutput(stdout) === normalizeOutput(testCase.expectedStdout),
      status: data.status?.description ?? data.message ?? 'Unknown',
      stdout,
      stderr: data.stderr ?? '',
      compileOutput: data.compile_output ?? '',
      time: data.time,
      memory: data.memory
    })
  }
  return results
}
