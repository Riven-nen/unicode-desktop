import { describe, expect, it } from 'vitest'
import {
  defaultAssignmentFileName,
  extensionForLanguage,
  fileNameForAssignment
} from './assignments'

describe('extensionForLanguage', (): void => {
  it('maps known languages and falls back to .txt', (): void => {
    expect(extensionForLanguage('python')).toBe('.py')
    expect(extensionForLanguage('Cpp')).toBe('.cpp')
    expect(extensionForLanguage('brainfuck')).toBe('.txt')
    expect(extensionForLanguage(null)).toBe('.txt')
  })
})

describe('defaultAssignmentFileName', (): void => {
  it('slugs the title and appends the language extension', (): void => {
    expect(defaultAssignmentFileName('Hello, World!', 'python')).toBe('hello-world.py')
    expect(defaultAssignmentFileName('  Two   Sum  ', 'java')).toBe('two-sum.java')
  })

  it('falls back to "assignment" for symbols-only titles', (): void => {
    expect(defaultAssignmentFileName('   ', null)).toBe('assignment.txt')
    expect(defaultAssignmentFileName('!!!', 'python')).toBe('assignment.py')
  })
})

describe('fileNameForAssignment', (): void => {
  it('uses the stored name and derives one when it is blank', (): void => {
    expect(
      fileNameForAssignment({ title: 'Hello World', language: 'python', fileName: 'loop.py' })
    ).toBe('loop.py')
    expect(fileNameForAssignment({ title: 'Two Sum', language: 'java', fileName: '   ' })).toBe(
      'two-sum.java'
    )
    expect(fileNameForAssignment({ title: 'Two Sum', language: 'java', fileName: null })).toBe(
      'two-sum.java'
    )
  })
})
