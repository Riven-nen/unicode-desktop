export interface StudentSubmission {
  id: string
  submittedAt: string
  status: string
  grade: number | null
  /** Server timestamp for the latest grade release, or null while private. */
  gradeReleasedAt: string | null
  commentCount: number
}

export interface StudentAssignment {
  id: string
  classId: string
  classCode: string
  className: string
  title: string
  description: string | null
  language: string | null
  /** Bare workspace file name, e.g. `fibonacci.py`. */
  fileName: string | null
  starterCode: string | null
  createdAt: string
  /** When the assignment became visible; null means it was published immediately. */
  publishAt: string | null
  dueAt: string | null
  autoTestEnabled: boolean
  latestSubmission: StudentSubmission | null
}
