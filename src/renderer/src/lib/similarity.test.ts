import { describe, expect, it } from 'vitest'
import { findSimilarPairs, latestPerStudent, similarityScore, tokenize } from './similarity'
import type { SimilarityEntry } from './similarity'

const BASE = `def fibonacci(n):
    if n == 0:
        return 0
    if n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

print(fibonacci(10))`

const OTHER = `def greet(name):
    message = "hello " + name
    for letter in message:
        print(letter.upper())
    return message

greet("world")`

const entry = (overrides: Partial<SimilarityEntry>): SimilarityEntry => ({
  submissionId: 'sub',
  studentId: 'student',
  studentName: 'Student',
  submittedAt: '2026-11-14T10:00:00Z',
  content: BASE,
  ...overrides
})

describe('tokenize', (): void => {
  it('drops comments and normalizes literals', (): void => {
    const tokens = tokenize('# note\ndef f():\n    return "hi" + 42  # done')
    expect(tokens).toContain('def')
    expect(tokens).toContain('<str>')
    expect(tokens).toContain('<num>')
    expect(tokens).not.toContain('note')
  })
})

describe('similarityScore', (): void => {
  it('scores identical work at 1', (): void => {
    expect(similarityScore(BASE, BASE)).toBe(1)
  })

  it('scores unrelated work low', (): void => {
    expect(similarityScore(BASE, OTHER)).toBeLessThan(0.3)
  })

  it('matches a renamed copy because identifiers are normalized', (): void => {
    const renamed = BASE.replace(/fibonacci/g, 'fib').replace(/\ba\b/g, 'current')
    expect(similarityScore(BASE, renamed)).toBe(1)
  })

  it('ignores files shorter than the minimum token count', (): void => {
    expect(similarityScore('x = 1', 'x = 1')).toBe(0)
  })
})

describe('latestPerStudent', (): void => {
  it('keeps only the newest submission per student', (): void => {
    const older = entry({
      studentId: 's1',
      submittedAt: '2026-11-10T10:00:00Z',
      submissionId: 'old'
    })
    const newer = entry({
      studentId: 's1',
      submittedAt: '2026-11-12T10:00:00Z',
      submissionId: 'new'
    })
    const latest = latestPerStudent([older, newer])
    expect(latest).toHaveLength(1)
    expect(latest[0].submissionId).toBe('new')
  })
})

describe('findSimilarPairs', (): void => {
  it('reports matching pairs above the threshold', (): void => {
    const pairs = findSimilarPairs([
      entry({ studentId: 's1', studentName: 'One', submissionId: 'a' }),
      entry({ studentId: 's2', studentName: 'Two', submissionId: 'b', content: BASE + '\n' }),
      entry({ studentId: 's3', studentName: 'Three', submissionId: 'c', content: OTHER })
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].a.studentId).toBe('s1')
    expect(pairs[0].b.studentId).toBe('s2')
    expect(pairs[0].score).toBeGreaterThan(0.9)
  })

  it('returns nothing for a single submission', (): void => {
    expect(findSimilarPairs([entry({})])).toEqual([])
  })
})
