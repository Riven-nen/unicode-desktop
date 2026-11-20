import { describe, expect, it } from 'vitest'
import {
  defaultSavePath,
  dirnameOf,
  fileDisplayName,
  relativeToRoot,
  workspaceNameFor
} from './workspace'

describe('fileDisplayName', (): void => {
  it('returns the last segment for Windows and POSIX paths', (): void => {
    expect(fileDisplayName('C:\\Users\\me\\Documents\\Unicode Lab\\CS101\\hello.py')).toBe(
      'hello.py'
    )
    expect(fileDisplayName('CS101/loops.py')).toBe('loops.py')
    expect(fileDisplayName('main.py')).toBe('main.py')
  })
})

describe('relativeToRoot', (): void => {
  it('returns a POSIX path inside the root, case-insensitively', (): void => {
    const root = 'C:\\Users\\me\\Documents\\Unicode Lab'
    expect(relativeToRoot(root, 'c:\\users\\me\\documents\\unicode lab\\CS101\\hello.py')).toBe(
      'CS101/hello.py'
    )
  })

  it('rejects siblings and reports the root itself as empty', (): void => {
    expect(relativeToRoot('C:\\Work', 'C:\\Workshop\\a.py')).toBeNull()
    expect(relativeToRoot('C:\\Work', 'C:\\Work')).toBe('')
  })
})

describe('workspaceNameFor', (): void => {
  it('prefers the workspace-relative name and falls back to the basename', (): void => {
    expect(workspaceNameFor('C:\\Work', 'C:\\Work\\CS101\\a.py')).toBe('CS101/a.py')
    expect(workspaceNameFor('C:\\Work', 'D:\\Elsewhere\\a.py')).toBe('a.py')
    expect(workspaceNameFor(null, 'D:\\Elsewhere\\a.py')).toBe('a.py')
  })
})

describe('dirnameOf and defaultSavePath', (): void => {
  it('splits directories and builds a save path next to the active file', (): void => {
    expect(dirnameOf('CS101/a.py')).toBe('CS101')
    expect(dirnameOf('a.py')).toBeNull()
    expect(defaultSavePath('C:\\Work', 'C:\\Work\\CS101\\a.py', 'b.py')).toBe(
      'C:\\Work\\CS101/b.py'
    )
    expect(defaultSavePath('C:\\Work\\', undefined, 'b.py')).toBe('C:\\Work/b.py')
  })
})
