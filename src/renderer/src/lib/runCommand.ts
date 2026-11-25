/**
 * Builds the local shell command that compiles/runs the active file.
 * Windows uses the PowerShell session this app runs; other platforms use bash.
 * The command is only produced when the language has a local runner.
 */
import type { ToolchainStatus } from '../../../shared/toolchains'

const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`

interface SplitPath {
  dir: string
  stem: string
  extension: string
}

function splitPath(filePath: string): SplitPath {
  const normalized = filePath.replace(/\\/g, '/')
  const slash = normalized.lastIndexOf('/')
  const dir = slash === -1 ? '.' : normalized.slice(0, slash)
  const base = normalized.slice(slash + 1)
  const dot = base.lastIndexOf('.')
  return {
    dir,
    stem: dot > 0 ? base.slice(0, dot) : base,
    extension: dot > 0 ? base.slice(dot).toLowerCase() : ''
  }
}

function commandName(toolchain: ToolchainStatus | null, wanted: string, fallback: string): string {
  if (toolchain?.found.includes(wanted)) return wanted
  return toolchain?.found[0] ?? fallback
}

export function runCommandFor(
  filePath: string | null,
  language: string,
  toolchain: ToolchainStatus | null,
  platform: string
): string | null {
  if (!filePath) return null
  const windows = platform === 'win32'
  const path = quote(filePath)
  const { dir, stem } = splitPath(filePath)
  const executable = `${dir}/${stem}${windows ? '.exe' : ''}`

  const compose = (compile: string, run: string): string =>
    windows ? `${compile}; if ($?) { ${run} }` : `${compile} && ${run}`

  if (language === 'python') {
    return `${commandName(toolchain, 'python', 'python')} ${path}`
  }
  if (language === 'javascript') {
    return `${commandName(toolchain, 'node', 'node')} ${path}`
  }
  if (language === 'java') {
    const javac = commandName(toolchain, 'javac', 'javac')
    const java = commandName(toolchain, 'java', 'java')
    return compose(`${javac} ${path}`, `${java} -cp ${quote(dir)} ${quote(stem)}`)
  }
  if (language === 'c') {
    const gcc = commandName(toolchain, 'gcc', 'gcc')
    return compose(
      `${gcc} ${path} -o ${quote(executable)}`,
      windows ? `& ${quote(executable)}` : quote(executable)
    )
  }
  if (language === 'cpp') {
    const gpp = commandName(toolchain, 'g++', 'g++')
    return compose(
      `${gpp} ${path} -o ${quote(executable)}`,
      windows ? `& ${quote(executable)}` : quote(executable)
    )
  }
  return null
}
