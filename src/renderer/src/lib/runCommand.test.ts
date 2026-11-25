import { describe, expect, it } from 'vitest'
import { runCommandFor } from './runCommand'
import type { ToolchainStatus } from '../../../shared/toolchains'

const status = (language: string, found: string[]): ToolchainStatus => ({
  language,
  required: true,
  label: 'Runtime',
  available: true,
  found,
  missing: [],
  hint: ''
})

describe('runCommandFor', (): void => {
  it('runs Python and Node directly', (): void => {
    expect(runCommandFor('C:/work/main.py', 'python', status('python', ['python']), 'win32')).toBe(
      "python 'C:/work/main.py'"
    )
    expect(
      runCommandFor('C:/work/app.js', 'javascript', status('javascript', ['node']), 'win32')
    ).toBe("node 'C:/work/app.js'")
  })

  it('compiles and runs Java with the JDK', (): void => {
    expect(
      runCommandFor('C:/work/Main.java', 'java', status('java', ['javac', 'java']), 'win32')
    ).toBe("javac 'C:/work/Main.java'; if ($?) { java -cp 'C:/work' 'Main' }")
  })

  it('compiles C and C++ to an executable', (): void => {
    expect(runCommandFor('C:/work/main.c', 'c', status('c', ['gcc']), 'win32')).toBe(
      "gcc 'C:/work/main.c' -o 'C:/work/main.exe'; if ($?) { & 'C:/work/main.exe' }"
    )
    expect(runCommandFor('/home/me/main.cpp', 'cpp', status('cpp', ['g++']), 'linux')).toBe(
      "g++ '/home/me/main.cpp' -o '/home/me/main' && '/home/me/main'"
    )
  })

  it('returns null for languages outside the supported set', (): void => {
    for (const language of [
      'csharp',
      'typescript',
      'go',
      'rust',
      'ruby',
      'php',
      'swift',
      'kotlin',
      'powershell',
      'shell'
    ]) {
      expect(runCommandFor(`C:/work/main.${language}`, language, null, 'win32')).toBeNull()
    }
  })

  it('returns null for editor-only files', (): void => {
    expect(runCommandFor('C:/work/notes.md', 'markdown', null, 'win32')).toBeNull()
    expect(runCommandFor(null, 'python', null, 'win32')).toBeNull()
  })
})
