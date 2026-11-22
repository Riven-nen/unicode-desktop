import type { AssessmentKind, AssessmentTimingMode } from './assessment'

export type IcsBand = 'pass' | 'review' | 'flag'

export type SnapshotType = 'auto' | 'paste' | 'manual' | 'restore'

export interface ClassSummary {
  id: string
  name: string
  code: string
  studentCount: number
  assignmentCount: number
  archivedAt: string | null
  /** Free text such as "3 - A"; optional for older classes. */
  yearSection: string | null
  /** Free text such as "2026-2027". */
  academicYear: string | null
  /** Short code students can use to enroll themselves. */
  joinCode: string
}

export interface AssignmentSummary {
  id: string
  title: string
  language: string | null
  description: string | null
  /** Bare workspace file name students open, e.g. `fibonacci.py`. */
  fileName: string | null
  starterCode: string | null
  testCaseCount: number
  hiddenCaseCount: number
  archivedAt: string | null
  published: boolean
  /** When students can first see the assignment; null means immediately. */
  publishAt: string | null
  dueAt: string | null
  autoTestEnabled: boolean
  /** `seatwork` is in-person timed work; `assignment` is take-home work. */
  kind: AssessmentKind
  timingMode: AssessmentTimingMode
  durationMinutes: number | null
  /** Shared opening time for live-window seatworks. */
  opensAt: string | null
  /** Hard cut-off for both timing modes. */
  closesAt: string | null
  autoSubmit: boolean
  showTimer: boolean
  allowedTabOuts: number
  fullscreenRequired: boolean
  blockPaste: boolean
  runOnlyTerminal: boolean
  maxAttempts: number
}

export interface RosterStudent {
  studentId: string
  name: string
  email: string
  enrolledAt: string
}

export interface SubmissionSummary {
  id: string
  assignmentId: string
  studentId: string
  studentName: string
  studentEmail: string
  submittedAt: string
  status: string
  grade: number | null
  /** False while the professor is still holding the grade privately. */
  gradeReleased: boolean
  gradeReleasedAt: string | null
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
  /** Gaps between edit bursts captured with this snapshot, in milliseconds. */
  typingIntervals: number[]
}

export interface PasteEntry {
  id: string
  snapshotId: string | null
  fileName: string
  text: string
  chars: number
  mode: string | null
  detectedVia: string
  createdAt: string
}

export interface PasteSimilarityMatch {
  pasteId: string
  pastedText: string
  pasteCreatedAt: string
  similarity: number
  matchPasteId: string
  matchText: string
  matchSubmissionId: string
  matchStudentId: string
  matchStudentName: string
  matchCreatedAt: string
}

export type LiveLabStatus = 'active' | 'idle' | 'flagged' | 'offline'

export interface LiveLabStudent {
  studentId: string
  name: string
  email: string
  status: LiveLabStatus
  storedStatus: 'active' | 'idle' | 'flagged'
  idleSeconds: number
  currentFile: string | null
  lastSeenAt: string
}

export interface IcsEvidenceValues {
  authored: number | string
  paste: number | string
  transcription: number | string
  rhythm: number | string
  away: number | string
  similarity: number | string
  e_plus: number | string
  e_minus: number | string
}

export interface IcsSettingsSnapshot {
  version?: number
  min_confidence?: number
  pass_threshold?: number
  review_threshold?: number
  pass_min_chars?: number
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
  confidence?: number | null
  evidence?: IcsEvidenceValues | null
  bandReason?: string | null
  model?: string | null
  examMode?: boolean
  settingsVersion?: number | null
  settingsSnapshot?: IcsSettingsSnapshot | null
}

export interface CommentEntry {
  id: string
  submissionId: string
  authorId: string
  authorRole: 'professor' | 'student'
  authorName: string
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

export interface CodeRunEntry {
  id: string
  createdAt: string
  statusId: number
  statusDescription: string
  passed: boolean | null
  timeSeconds: number | null
  memoryKb: number | null
  language: string | null
  testCaseOrdinal: number | null
}

export interface SubmissionDetailData {
  summary: SubmissionSummary
  assignmentId: string
  assignmentTitle: string
  fileName: string | null
  language: string | null
  classId: string
  className: string
  classCode: string
  finalSnapshotId: string | null
  snapshots: SnapshotEntry[]
  pastes: PasteEntry[]
  icsScore: IcsScoreRow | null
  comments: CommentEntry[]
  testCases: TestCaseEntry[]
}

export interface StudentFeedbackItem {
  id: string
  submissionId: string
  body: string
  anchorLine: number | null
  anchorSnapshotId: string | null
  parentId: string | null
  authorRole: 'professor' | 'student'
  authorName: string
  createdAt: string
  assignmentTitle: string
  classCode: string
  /** When the graded submission was handed in. */
  submittedAt: string
  /** Professor's mark, or null while the work is ungraded. */
  grade: number | null
}
