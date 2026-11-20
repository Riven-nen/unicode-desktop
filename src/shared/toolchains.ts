/**
 * Toolchain requirements per editor language. The desktop app checks these
 * when a file becomes active so students know whether they can run the file
 * locally. Judge0 execution is independent of the local machine.
 */

export interface ToolchainSpec {
  label: string
  commands: string[]
  /** True when any one command is enough (e.g. py OR python). */
  anyOf: boolean
  hint: string
}

export interface ToolchainStatus {
  language: string
  /** False for editor-only languages (markdown, JSON, SQL, ...). */
  required: boolean
  label: string | null
  available: boolean
  found: string[]
  missing: string[]
  hint: string | null
}

export const TOOLCHAIN_BY_LANGUAGE: Record<string, ToolchainSpec> = {
  python: {
    label: 'Python',
    commands: ['py', 'python'],
    anyOf: true,
    hint: 'Install Python 3 and make sure it is on PATH.'
  },
  java: {
    label: 'Java JDK',
    commands: ['javac', 'java'],
    anyOf: false,
    hint: 'Install a JDK (for example Eclipse Temurin) and add its bin folder to PATH.'
  },
  c: {
    label: 'GCC',
    commands: ['gcc'],
    anyOf: false,
    hint: 'Install a C toolchain such as MinGW-w64 and add gcc to PATH.'
  },
  cpp: {
    label: 'G++',
    commands: ['g++'],
    anyOf: false,
    hint: 'Install a C++ toolchain such as MinGW-w64 and add g++ to PATH.'
  },
  csharp: {
    label: '.NET SDK',
    commands: ['dotnet'],
    anyOf: false,
    hint: 'Install the .NET SDK from Microsoft and reopen the app.'
  },
  javascript: {
    label: 'Node.js',
    commands: ['node'],
    anyOf: false,
    hint: 'Install Node.js and make sure it is on PATH.'
  },
  typescript: {
    label: 'Node.js',
    commands: ['node'],
    anyOf: false,
    hint: 'Install Node.js; TypeScript files can be checked with tsc if it is installed.'
  },
  go: {
    label: 'Go',
    commands: ['go'],
    anyOf: false,
    hint: 'Install the Go toolchain and make sure go is on PATH.'
  },
  rust: {
    label: 'Rust',
    commands: ['rustc'],
    anyOf: false,
    hint: 'Install Rust with rustup so rustc is on PATH.'
  },
  ruby: {
    label: 'Ruby',
    commands: ['ruby'],
    anyOf: false,
    hint: 'Install Ruby and add it to PATH.'
  },
  php: {
    label: 'PHP',
    commands: ['php'],
    anyOf: false,
    hint: 'Install PHP and add it to PATH.'
  },
  swift: {
    label: 'Swift',
    commands: ['swiftc'],
    anyOf: false,
    hint: 'Install the Swift toolchain and add swiftc to PATH.'
  },
  kotlin: {
    label: 'Kotlin',
    commands: ['kotlinc'],
    anyOf: false,
    hint: 'Install the Kotlin compiler and add kotlinc to PATH.'
  }
}

/** The requirement for a Monaco language id, or null for editor-only files. */
export function toolchainSpecFor(language: string | null | undefined): ToolchainSpec | null {
  if (!language) return null
  return TOOLCHAIN_BY_LANGUAGE[language.trim().toLowerCase()] ?? null
}

/** Builds the "not required" status used for markdown, JSON, SQL, etc. */
export function editorOnlyStatus(language: string): ToolchainStatus {
  return {
    language,
    required: false,
    label: null,
    available: true,
    found: [],
    missing: [],
    hint: null
  }
}
