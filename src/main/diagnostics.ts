import { execFile } from 'child_process'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ipcMain } from 'electron'
import { bundledPyrightFile } from './bundledTools'
import type {
  LanguageCheckInput,
  LanguageCheckResult,
  LanguageDiagnostic
} from '../shared/diagnostics'

const MAX_SOURCE_BYTES = 512 * 1024
const TIMEOUT_MS = 15_000

interface CommandOutput {
  stdout: string
  stderr: string
  /** Set only when the executable itself could not be started. */
  missing: boolean
  timedOut: boolean
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandOutput> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout: TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
        cwd: options.cwd,
        env: options.env
      },
      (error, stdout, stderr) => {
        const typed = error as (NodeJS.ErrnoException & { killed?: boolean }) | null
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          missing: typed?.code === 'ENOENT',
          timedOut: typed?.killed === true
        })
      }
    )
  })
}

function dedupe(diagnostics: LanguageDiagnostic[]): LanguageDiagnostic[] {
  const seen = new Set<string>()
  const unique: LanguageDiagnostic[] = []
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.line}:${diagnostic.column}:${diagnostic.message}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(diagnostic)
    if (unique.length >= 100) break
  }
  return unique
}

function parseJava(output: string): LanguageDiagnostic[] {
  const diagnostics: LanguageDiagnostic[] = []
  const pattern = /^(.+\.java):(\d+): (error|warning): (.+)$/gm
  for (const match of output.matchAll(pattern)) {
    if (match[3] !== 'error') continue
    const line = Number(match[2])
    diagnostics.push({
      line,
      column: 1,
      endLine: line,
      endColumn: 2,
      message: match[4].trim()
    })
  }
  return dedupe(diagnostics)
}

function parseCpp(output: string): LanguageDiagnostic[] {
  const diagnostics: LanguageDiagnostic[] = []
  const pattern = /^(.+?):(\d+):(\d+): (fatal error|error|warning|note): (.+)$/gm
  for (const match of output.matchAll(pattern)) {
    if (match[4] !== 'error' && match[4] !== 'fatal error') continue
    const line = Number(match[2])
    const column = Number(match[3])
    diagnostics.push({
      line,
      column,
      endLine: line,
      endColumn: column + 1,
      message: match[5].trim()
    })
  }
  return dedupe(diagnostics)
}

interface PyrightDiagnostic {
  severity: string
  message: string
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
}

interface PyrightOutput {
  generalDiagnostics?: PyrightDiagnostic[]
}

function parsePyright(parsed: PyrightOutput): LanguageDiagnostic[] {
  const diagnostics: LanguageDiagnostic[] = []
  for (const diagnostic of parsed.generalDiagnostics ?? []) {
    if (diagnostic.severity !== 'error') continue
    const line = diagnostic.range.start.line + 1
    const column = diagnostic.range.start.character + 1
    const endLine = diagnostic.range.end.line + 1
    const endColumn = Math.max(
      diagnostic.range.end.character + 1,
      endLine === line ? column + 1 : 1
    )
    diagnostics.push({
      line,
      column,
      endLine,
      endColumn,
      message: diagnostic.message.trim()
    })
  }
  return dedupe(diagnostics)
}

function javaTypeName(source: string): string {
  const match = source.match(
    /\bpublic\s+(?:(?:final|abstract|sealed|non-sealed|strictfp)\s+)*(?:class|interface|enum|record|@interface)\s+([A-Za-z_$][\w$]*)/
  )
  return match?.[1] ?? 'Main'
}

async function checkJava(source: string): Promise<LanguageCheckResult> {
  const dir = await mkdtemp(join(tmpdir(), 'unicode-lab-java-'))
  try {
    const file = join(dir, `${javaTypeName(source)}.java`)
    await writeFile(file, source, 'utf8')
    const output = await run('javac', ['-encoding', 'UTF-8', '-d', dir, file])
    if (output.missing) {
      return { available: false, diagnostics: [], message: 'javac was not found on PATH.' }
    }
    if (output.timedOut) {
      return { available: false, diagnostics: [], message: 'javac timed out.' }
    }
    return { available: true, diagnostics: parseJava(output.stderr + output.stdout) }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function checkC(source: string, language: 'c' | 'cpp'): Promise<LanguageCheckResult> {
  const dir = await mkdtemp(join(tmpdir(), 'unicode-lab-c-'))
  try {
    const extension = language === 'cpp' ? '.cpp' : '.c'
    const file = join(dir, `main${extension}`)
    await writeFile(file, source, 'utf8')
    const command = language === 'cpp' ? 'g++' : 'gcc'
    const standard = language === 'cpp' ? '-std=c++17' : '-std=c17'
    const output = await run(command, [
      standard,
      '-fsyntax-only',
      '-fmax-errors=40',
      '-fdiagnostics-color=never',
      file
    ])
    if (output.missing) {
      return { available: false, diagnostics: [], message: `${command} was not found on PATH.` }
    }
    if (output.timedOut) {
      return { available: false, diagnostics: [], message: `${command} timed out.` }
    }
    return { available: true, diagnostics: parseCpp(output.stderr + output.stdout) }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function checkPython(source: string): Promise<LanguageCheckResult> {
  const entry = bundledPyrightFile('index.js')
  if (!entry) {
    return { available: false, diagnostics: [], message: 'Pyright is not bundled with this build.' }
  }

  const dir = await mkdtemp(join(tmpdir(), 'unicode-lab-pyright-'))
  try {
    const file = join(dir, 'main.py')
    await writeFile(file, source, 'utf8')
    // The packaged app has no separate Node runtime; Electron itself can run
    // Pyright's CLI in Node mode.
    const output = await run(process.execPath, [entry, '--outputjson', '--level', 'error', file], {
      cwd: dir,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    })
    if (output.timedOut) {
      return { available: false, diagnostics: [], message: 'Pyright timed out.' }
    }
    if (!output.stdout.trim()) {
      return {
        available: false,
        diagnostics: [],
        message: output.stderr.trim() || 'Pyright produced no output.'
      }
    }

    try {
      return { available: true, diagnostics: parsePyright(JSON.parse(output.stdout)) }
    } catch {
      return {
        available: false,
        diagnostics: [],
        message: 'Pyright returned output that could not be read.'
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function checkLanguage(input: LanguageCheckInput): Promise<LanguageCheckResult> {
  if (input.source.length > MAX_SOURCE_BYTES) {
    return {
      available: false,
      diagnostics: [],
      message: 'File is too large for local language checks.'
    }
  }
  if (input.language === 'python') return checkPython(input.source)
  if (input.language === 'java') return checkJava(input.source)
  if (input.language === 'cpp') return checkC(input.source, 'cpp')
  if (input.language === 'c') return checkC(input.source, 'c')
  return { available: false, diagnostics: [], message: 'No local checker for this language.' }
}

export function registerDiagnosticsHandlers(): void {
  ipcMain.handle(
    'diagnostics:check',
    (_event, input: LanguageCheckInput): Promise<LanguageCheckResult> => checkLanguage(input)
  )
}
