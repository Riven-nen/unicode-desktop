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

  it('compiles C/C++ and Rust to an executable', (): void => {
    expect(runCommandFor('C:/work/main.c', 'c', status('c', ['gcc']), 'win32')).toBe(
      "gcc 'C:/work/main.c' -o 'C:/work/main.exe'; if ($?) { & 'C:/work/main.exe' }"
    )
    expect(runCommandFor('/home/me/main.rs', 'rust', status('rust', ['rustc']), 'linux')).toBe(
      "rustc '/home/me/main.rs' -o '/home/me/main' && '/home/me/main'"
    )
  })

  it('uses the interpreter for Go, Ruby, and PHP', (): void => {
    expect(runCommandFor('/home/me/main.go', 'go', status('go', ['go']), 'linux')).toBe(
      "go run '/home/me/main.go'"
    )
    expect(runCommandFor('C:/work/app.rb', 'ruby', null, 'win32')).toBe("ruby 'C:/work/app.rb'")
    expect(runCommandFor('C:/work/index.php', 'php', null, 'win32')).toBe("php 'C:/work/index.php'")
  })

  it('runs PowerShell scripts directly', (): void => {
    expect(runCommandFor('C:/work/setup.ps1', 'plaintext', null, 'win32')).toBe(
      "& 'C:/work/setup.ps1'"
    )
  })

  it('returns null for editor-only files', (): void => {
    expect(runCommandFor('C:/work/notes.md', 'markdown', null, 'win32')).toBeNull()
    expect(runCommandFor(null, 'python', null, 'win32')).toBeNull()
  })
})
