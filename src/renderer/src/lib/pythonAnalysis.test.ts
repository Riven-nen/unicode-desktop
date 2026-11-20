import { describe, expect, it } from 'vitest'
import { analyzePython } from './pythonAnalysis'

const SOURCE = [
  'import math',
  '',
  'LIMIT = 10',
  '',
  'def double(value):',
  '    return value * 2',
  '',
  'class Greeter:',
  '    def hello(self):',
  '        return "hi"',
  ''
].join('\n')

describe('analyzePython', (): void => {
  it('extracts functions, methods, classes, and module-level names', (): void => {
    const analysis = analyzePython(SOURCE)
    const byName = new Map(analysis.symbols.map((symbol) => [symbol.name, symbol]))

    expect(analysis.diagnostics).toEqual([])
    expect(byName.get('double')?.kind).toBe('function')
    expect(byName.get('Greeter')?.kind).toBe('class')
    expect(byName.get('hello')?.kind).toBe('method')
    expect(byName.get('LIMIT')?.kind).toBe('variable')
    expect(byName.get('double')?.line).toBe(5)
    expect(analysis.names).toContain('value')
  })

  it('reports syntax errors with a line number', (): void => {
    const analysis = analyzePython('def broken(\n    return 1\n')
    expect(analysis.diagnostics.length).toBeGreaterThan(0)
    expect(analysis.diagnostics[0].line).toBeGreaterThanOrEqual(1)
    expect(analysis.diagnostics[0].line).toBeLessThanOrEqual(2)
  })

  it('returns an empty analysis for an empty file', (): void => {
    expect(analyzePython('')).toEqual({ symbols: [], names: [], diagnostics: [] })
  })
})
