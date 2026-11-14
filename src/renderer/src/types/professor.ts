export type IcsBand = 'pass' | 'review' | 'flag'

export type SnapshotType = 'auto' | 'paste' | 'manual' | 'restore'

export interface ClassSummary {
  id: string
  name: string
  code: string
  studentCount: number
  assignmentCount: number
}

export interface AssignmentSummary {
  id: string
  title: string
  language: string | null
  description: string | null
  starterCode: string | null
  testCaseCount: number
  hiddenCaseCount: number
}

export interface RosterStudent {
  studentId: string
  name: string
  email: string
  enrolledAt: string
}

export interface SubmissionSummary {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  submittedAt: string
  status: string
  grade: number | null
  ics: number | null
  band: IcsBand | null
  pasteCount: number
  commentCount: number
}

export interface SnapshotEntry {
  id: string
  type: SnapshotType
  createdAt: string
  charCount: number
  lineCount: number
  version: number
  content: string
  pasteDetectedVia: string | null
  pasteChars: number
}

export interface IcsScoreRow {
  submissionId: string
  pasteTerm: number
  cadenceTerm: number
  focusTerm: number
  compilationTerm: number
  ics: number
  band: IcsBand
  computedAt: string
}

export interface CommentEntry {
  id: string
  submissionId: string
  snapshotId: string | null
  anchorLine: number | null
  parentId: string | null
  body: string
  createdAt: string
}

export interface TestCaseEntry {
  id: string
  stdin: string | null
  expectedStdout: string | null
  ordinal: number
  isHidden: boolean
}

export interface SubmissionDetailData {
  summary: SubmissionSummary
  assignmentId: string
  assignmentTitle: string
  language: string | null
  classId: string
  className: string
  classCode: string
  finalSnapshotId: string | null
  snapshots: SnapshotEntry[]
  icsScore: IcsScoreRow | null
  comments: CommentEntry[]
  testCases: TestCaseEntry[]
}

export interface StudentFeedbackItem {
  id: string
  body: string
  anchorLine: number | null
  parentId: string | null
  createdAt: string
  assignmentTitle: string
  classCode: string
}
