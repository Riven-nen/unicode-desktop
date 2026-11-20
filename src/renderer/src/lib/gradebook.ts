/**
 * Builds the professor's class-wide gradebook for CSV export: one row per
 * enrolled student per assignment, using the latest submission for that pair.
 * Missing work is included so the export shows the whole picture.
 */
import type { AssignmentSummary, RosterStudent } from '../types/professor'
import type { CsvValue } from './csv'

export interface GradebookSubmission {
  assignmentId: string
  studentId: string
  submittedAt: string
  grade: number | null
  ics: number | null
  band: string | null
  commentCount: number
}

export const GRADEBOOK_HEADER: string[] = [
  'Student',
  'Email',
  'Assignment',
  'Due',
  'Status',
  'Submitted',
  'Late',
  'Grade',
  'ICS',
  'Band',
  'Comments'
]

const latestKey = (assignmentId: string, studentId: string): string =>
  `${assignmentId}\u0001${studentId}`

export function buildGradebookRows(
  assignments: AssignmentSummary[],
  roster: RosterStudent[],
  submissions: GradebookSubmission[]
): CsvValue[][] {
  const latest = new Map<string, GradebookSubmission>()
  for (const submission of submissions) {
    const key = latestKey(submission.assignmentId, submission.studentId)
    const current = latest.get(key)
    if (!current || submission.submittedAt > current.submittedAt) {
      latest.set(key, submission)
    }
  }

  const rows: CsvValue[][] = [GRADEBOOK_HEADER]

  for (const student of roster) {
    for (const assignment of assignments) {
      const submission = latest.get(latestKey(assignment.id, student.studentId))
      const due = assignment.dueAt
      const late =
        submission !== null &&
        submission !== undefined &&
        due !== null &&
        Date.parse(submission.submittedAt) > Date.parse(due)

      rows.push([
        student.name,
        student.email,
        assignment.title,
        due ?? '',
        submission ? 'Submitted' : 'Not submitted',
        submission?.submittedAt ?? '',
        submission ? (late ? 'Yes' : 'No') : '',
        submission?.grade ?? '',
        submission?.ics ?? '',
        submission?.band ?? '',
        submission?.commentCount ?? 0
      ])
    }
  }

  return rows
}
