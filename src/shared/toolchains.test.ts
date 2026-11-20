import { describe, expect, it } from 'vitest'
import { editorOnlyStatus, toolchainSpecFor } from './toolchains'

describe('toolchainSpecFor', (): void => {
  it('maps supported editor languages to their compiler requirements', (): void => {
    expect(toolchainSpecFor('java')?.commands).toEqual(['javac', 'java'])
    expect(toolchainSpecFor('c')?.label).toBe('GCC')
    expect(toolchainSpecFor('cpp')?.commands).toEqual(['g++'])
    expect(toolchainSpecFor('python')?.anyOf).toBe(true)
  })

  it('returns null for editor-only languages', (): void => {
    expect(toolchainSpecFor('markdown')).toBeNull()
    expect(toolchainSpecFor('json')).toBeNull()
    expect(toolchainSpecFor(null)).toBeNull()
  })

  it('normalizes case and whitespace', (): void => {
    expect(toolchainSpecFor(' Java ')?.label).toBe('Java JDK')
  })
})

describe('editorOnlyStatus', (): void => {
  it('marks a language as not requiring a local toolchain', (): void => {
    expect(editorOnlyStatus('markdown')).toEqual({
      language: 'markdown',
      required: false,
      label: null,
      available: true,
      found: [],
      missing: [],
      hint: null
    })
  })
})
