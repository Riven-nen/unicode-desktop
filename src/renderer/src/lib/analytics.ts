/**
 * Assignment analytics for the professor view. Works on the submission rows
 * already loaded for the assignment: the latest submission per student is the
 * one that counts toward submitted/late/score figures.
 */
import type { IcsBand } from '../types/professor'

export interface AnalyticsSubmission {
  studentId: string
  submittedAt: string
  grade: number | null
  ics: number | null
  band: IcsBand | null
}

export interface BandCounts {
  pass: number
  review: number
  flag: number
  unscored: number
}

export interface SubmissionAnalytics {
  studentsSubmitted: number
  late: number
  averageIcs: number | null
  averageGrade: number | null
  bands: BandCounts
}

const mean = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length

/** Keeps only the newest submission for each student. */
export function latestPerStudent(rows: AnalyticsSubmission[]): AnalyticsSubmission[] {
  const latest = new Map<string, AnalyticsSubmission>()
  for (const row of rows) {
    const current = latest.get(row.studentId)
    // ISO timestamps compare correctly as strings.
    if (!current || row.submittedAt > current.submittedAt) latest.set(row.studentId, row)
  }
  return [...latest.values()]
}

export function summarizeSubmissions(
  rows: AnalyticsSubmission[],
  dueAt: string | null
): SubmissionAnalytics {
  const latest = latestPerStudent(rows)
  const due = dueAt ? Date.parse(dueAt) : Number.NaN
  const hasDeadline = Number.isFinite(due)

  let late = 0
  let pass = 0
  let review = 0
  let flag = 0
  let unscored = 0
  const icsValues: number[] = []
  const gradeValues: number[] = []

  for (const row of latest) {
    if (hasDeadline && Date.parse(row.submittedAt) > due) late += 1
    if (row.grade !== null) gradeValues.push(row.grade)
    if (row.ics !== null) icsValues.push(row.ics)

    if (row.band === 'pass') pass += 1
    else if (row.band === 'review') review += 1
    else if (row.band === 'flag') flag += 1
    else unscored += 1
  }

  return {
    studentsSubmitted: latest.length,
    late,
    averageIcs: mean(icsValues),
    averageGrade: mean(gradeValues),
    bands: { pass, review, flag, unscored }
  }
}
