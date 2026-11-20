import { describe, expect, it } from 'vitest'
import { latestPerStudent, summarizeSubmissions } from './analytics'
import type { AnalyticsSubmission } from './analytics'

const rows: AnalyticsSubmission[] = [
  {
    studentId: 's1',
    submittedAt: '2026-11-14T10:00:00Z',
    grade: null,
    ics: 70,
    band: 'review'
  },
  {
    studentId: 's1',
    submittedAt: '2026-11-16T10:00:00Z',
    grade: 90,
    ics: 91,
    band: 'pass'
  },
  {
    studentId: 's2',
    submittedAt: '2026-11-20T10:00:00Z',
    grade: 65,
    ics: 61,
    band: 'review'
  },
  {
    studentId: 's3',
    submittedAt: '2026-11-15T10:00:00Z',
    grade: null,
    ics: null,
    band: null
  }
]

describe('latestPerStudent', (): void => {
  it('keeps the newest submission per student', (): void => {
    const latest = latestPerStudent(rows)
    expect(latest).toHaveLength(3)
    expect(latest.find((row) => row.studentId === 's1')?.ics).toBe(91)
  })
})

describe('summarizeSubmissions', (): void => {
  it('counts late work against the due date', (): void => {
    const summary = summarizeSubmissions(rows, '2026-11-17T00:00:00Z')
    expect(summary.studentsSubmitted).toBe(3)
    expect(summary.late).toBe(1)
  })

  it('averages the latest scored and graded submissions', (): void => {
    const summary = summarizeSubmissions(rows, null)
    expect(summary.averageIcs).toBeCloseTo((91 + 61) / 2)
    expect(summary.averageGrade).toBeCloseTo((90 + 65) / 2)
  })

  it('counts band totals, including unscored submissions', (): void => {
    const summary = summarizeSubmissions(rows, null)
    expect(summary.bands).toEqual({ pass: 1, review: 1, flag: 0, unscored: 1 })
  })

  it('returns empty analytics for no submissions', (): void => {
    expect(summarizeSubmissions([], '2026-11-17T00:00:00Z')).toEqual({
      studentsSubmitted: 0,
      late: 0,
      averageIcs: null,
      averageGrade: null,
      bands: { pass: 0, review: 0, flag: 0, unscored: 0 }
    })
  })
})
