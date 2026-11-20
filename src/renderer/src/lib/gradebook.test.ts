import { describe, expect, it } from 'vitest'
import { buildGradebookRows, GRADEBOOK_HEADER } from './gradebook'
import type { GradebookSubmission } from './gradebook'
import type { AssignmentSummary, RosterStudent } from '../types/professor'

const assignment = (id: string, title: string, dueAt: string | null): AssignmentSummary => ({
  id,
  title,
  language: 'python',
  description: null,
  fileName: `${id}.py`,
  starterCode: null,
  testCaseCount: 0,
  hiddenCaseCount: 0,
  archivedAt: null,
  published: true,
  publishAt: null,
  dueAt,
  autoTestEnabled: false
})

const student = (studentId: string, name: string, email: string): RosterStudent => ({
  studentId,
  name,
  email,
  enrolledAt: '2026-09-01T00:00:00Z'
})

const submission = (overrides: Partial<GradebookSubmission>): GradebookSubmission => ({
  assignmentId: 'a1',
  studentId: 's1',
  submittedAt: '2026-11-14T10:00:00Z',
  grade: 90,
  ics: 85,
  band: 'pass',
  commentCount: 1,
  ...overrides
})

describe('buildGradebookRows', (): void => {
  it('starts with the expected header', (): void => {
    expect(buildGradebookRows([], [], [])[0]).toEqual(GRADEBOOK_HEADER)
  })

  it('writes one row per student and assignment, including missing work', (): void => {
    const rows = buildGradebookRows(
      [assignment('a1', 'Hello', '2026-11-20T00:00:00Z'), assignment('a2', 'Loops', null)],
      [student('s1', 'One', 'one@test.dev'), student('s2', 'Two', 'two@test.dev')],
      [submission({ assignmentId: 'a1', studentId: 's1' })]
    )

    expect(rows).toHaveLength(1 + 4)
    expect(rows[1]).toEqual([
      'One',
      'one@test.dev',
      'Hello',
      '2026-11-20T00:00:00Z',
      'Submitted',
      '2026-11-14T10:00:00Z',
      'No',
      90,
      85,
      'pass',
      1
    ])
    expect(rows[2][4]).toBe('Not submitted')
    expect(rows[2][7]).toBe('')
    expect(rows[4][0]).toBe('Two')
  })

  it('uses the latest submission for a student/assignment pair', (): void => {
    const rows = buildGradebookRows(
      [assignment('a1', 'Hello', null)],
      [student('s1', 'One', 'one@test.dev')],
      [
        submission({ submittedAt: '2026-11-10T10:00:00Z', grade: 50, ics: 55 }),
        submission({ submittedAt: '2026-11-15T10:00:00Z', grade: 95, ics: 92 })
      ]
    )
    expect(rows[1][5]).toBe('2026-11-15T10:00:00Z')
    expect(rows[1][7]).toBe(95)
  })

  it('marks late work against the due date', (): void => {
    const rows = buildGradebookRows(
      [assignment('a1', 'Hello', '2026-11-13T00:00:00Z')],
      [student('s1', 'One', 'one@test.dev')],
      [submission({ submittedAt: '2026-11-14T00:00:00Z' })]
    )
    expect(rows[1][6]).toBe('Yes')
  })

  it('leaves late blank when the submission has no due date', (): void => {
    const rows = buildGradebookRows(
      [assignment('a1', 'Hello', null)],
      [student('s1', 'One', 'one@test.dev')],
      [submission({})]
    )
    expect(rows[1][6]).toBe('No')
  })
})
