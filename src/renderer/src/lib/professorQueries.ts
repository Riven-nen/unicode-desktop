import { supabase } from './supabase'
import type {
  AssignmentSummary,
  ClassSummary,
  CodeRunEntry,
  CommentEntry,
  IcsBand,
  IcsEvidenceValues,
  IcsScoreRow,
  IcsSettingsSnapshot,
  LiveLabStudent,
  PasteEntry,
  PasteSimilarityMatch,
  RosterStudent,
  SnapshotEntry,
  SnapshotType,
  StudentFeedbackItem,
  SubmissionDetailData,
  SubmissionSummary,
  TestCaseEntry
} from '../types/professor'
import type { SimilarityEntry } from './similarity'
import type { GradebookSubmission } from './gradebook'

function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

const asNumber = (value: number | string | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value)

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

interface CountRow {
  count: number
}

interface ClassRow {
  id: string
  name: string
  code: string
  archived_at: string | null
  year_section: string | null
  academic_year: string | null
  join_code: string
  enrollments: CountRow[] | null
  assignments: CountRow[] | null
}

export async function fetchClasses(professorId: string): Promise<ClassSummary[]> {
  const { data, error } = await client()
    .from('classes')
    .select(
      'id, name, code, archived_at, year_section, academic_year, join_code, enrollments(count), assignments(count)'
    )
    .eq('professor_id', professorId)
    .order('code', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as ClassRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    studentCount: row.enrollments?.[0]?.count ?? 0,
    assignmentCount: row.assignments?.[0]?.count ?? 0,
    archivedAt: row.archived_at,
    yearSection: row.year_section,
    academicYear: row.academic_year,
    joinCode: row.join_code
  }))
}

export async function createClass(input: {
  professorId: string
  name: string
  code: string
  yearSection: string
  academicYear: string
}): Promise<string> {
  const { data, error } = await client()
    .from('classes')
    .insert({
      professor_id: input.professorId,
      name: input.name.trim(),
      code: input.code.trim(),
      year_section: input.yearSection.trim() || null,
      academic_year: input.academicYear.trim() || null
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('That class code is already in use.')
    throw new Error(error.message)
  }
  return (data as unknown as { id: string }).id
}

export async function updateClass(input: {
  classId: string
  name: string
  code: string
  yearSection: string
  academicYear: string
}): Promise<void> {
  const { error } = await client()
    .from('classes')
    .update({
      name: input.name.trim(),
      code: input.code.trim(),
      year_section: input.yearSection.trim() || null,
      academic_year: input.academicYear.trim() || null
    })
    .eq('id', input.classId)

  if (error) {
    if (error.code === '23505') throw new Error('That class code is already in use.')
    throw new Error(error.message)
  }
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

interface RosterRow {
  student_id: string
  enrolled_at: string
  student: { id: string; display_name: string | null; email: string | null } | null
}

export async function fetchRoster(classId: string): Promise<RosterStudent[]> {
  const { data, error } = await client()
    .from('enrollments')
    .select('student_id, enrolled_at, student:profiles!student_id ( id, display_name, email )')
    .eq('class_id', classId)
    .order('enrolled_at', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as RosterRow[]).map((row) => ({
    studentId: row.student_id,
    name: row.student?.display_name ?? row.student?.email ?? 'Student',
    email: row.student?.email ?? '',
    enrolledAt: row.enrolled_at
  }))
}

export async function addStudentToClass(classId: string, email: string): Promise<void> {
  const { error } = await client().rpc('add_student_to_class', {
    target_class: classId,
    student_email: email.trim()
  })
  if (error) throw new Error(error.message)
}

export async function removeStudentFromClass(classId: string, studentId: string): Promise<void> {
  const { error } = await client()
    .from('enrollments')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', studentId)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

interface AssignmentRow {
  id: string
  title: string
  language: string | null
  description: string | null
  file_name: string | null
  starter_code: string | null
  archived_at: string | null
  published: boolean
  publish_at: string | null
  due_at: string | null
  auto_test_enabled: boolean
  kind: 'assignment' | 'seatwork'
  timing_mode: 'none' | 'duration' | 'live_window'
  duration_minutes: number | null
  opens_at: string | null
  closes_at: string | null
  auto_submit: boolean
  show_timer: boolean
  allowed_tab_outs: number
  fullscreen_required: boolean
  block_paste: boolean
  run_only_terminal: boolean
  max_attempts: number
  test_cases: Array<{ id: string; is_hidden: boolean }> | null
}

export async function fetchAssignments(classId: string): Promise<AssignmentSummary[]> {
  const { data, error } = await client()
    .from('assignments')
    .select(
      'id, title, language, description, file_name, starter_code, archived_at, published, publish_at, due_at, auto_test_enabled, kind, timing_mode, duration_minutes, opens_at, closes_at, auto_submit, show_timer, allowed_tab_outs, fullscreen_required, block_paste, run_only_terminal, max_attempts, test_cases(id, is_hidden)'
    )
    .eq('class_id', classId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as AssignmentRow[]).map((row) => {
    const cases = row.test_cases ?? []
    return {
      id: row.id,
      title: row.title,
      language: row.language,
      description: row.description,
      fileName: row.file_name,
      starterCode: row.starter_code,
      archivedAt: row.archived_at,
      published: row.published,
      publishAt: row.publish_at,
      dueAt: row.due_at,
      autoTestEnabled: row.auto_test_enabled,
      kind: row.kind,
      timingMode: row.timing_mode,
      durationMinutes: row.duration_minutes,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      autoSubmit: row.auto_submit,
      showTimer: row.show_timer,
      allowedTabOuts: Number(row.allowed_tab_outs ?? 0),
      fullscreenRequired: row.fullscreen_required,
      blockPaste: row.block_paste,
      runOnlyTerminal: row.run_only_terminal,
      maxAttempts: Number(row.max_attempts ?? 1),
      testCaseCount: cases.length,
      hiddenCaseCount: cases.filter((testCase) => testCase.is_hidden).length
    }
  })
}

// ---------------------------------------------------------------------------
// Assignment editing
// ---------------------------------------------------------------------------

export interface AssignmentTimingInput {
  kind: 'assignment' | 'seatwork'
  timingMode: 'none' | 'duration' | 'live_window'
  durationMinutes: number | null
  opensAt: string | null
  closesAt: string | null
  autoSubmit: boolean
  showTimer: boolean
  allowedTabOuts: number
  fullscreenRequired: boolean
  blockPaste: boolean
  runOnlyTerminal: boolean
  maxAttempts: number
}

export async function createAssignment(
  input: AssignmentTimingInput & {
    classId: string
    title: string
    description: string
    language: string
    fileName: string
    starterCode: string
    published: boolean
    publishAt: string | null
    dueAt: string | null
    autoTestEnabled: boolean
  }
): Promise<string> {
  const { data, error } = await client()
    .from('assignments')
    .insert({
      class_id: input.classId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      language: input.language.trim() || null,
      file_name: input.fileName.trim() || null,
      starter_code: input.starterCode || null,
      published: input.published,
      publish_at: input.publishAt,
      due_at: input.dueAt,
      auto_test_enabled: input.autoTestEnabled,
      kind: input.kind,
      timing_mode: input.timingMode,
      duration_minutes: input.timingMode === 'none' ? null : input.durationMinutes,
      opens_at: input.opensAt,
      closes_at: input.closesAt,
      auto_submit: input.autoSubmit,
      show_timer: input.showTimer,
      allowed_tab_outs: input.allowedTabOuts,
      fullscreen_required: input.fullscreenRequired,
      block_paste: input.blockPaste,
      run_only_terminal: input.runOnlyTerminal,
      max_attempts: input.maxAttempts
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return (data as unknown as { id: string }).id
}

export async function updateAssignment(
  input: AssignmentTimingInput & {
    assignmentId: string
    title: string
    description: string
    language: string
    fileName: string
    starterCode: string
    published: boolean
    publishAt: string | null
    dueAt: string | null
    autoTestEnabled: boolean
  }
): Promise<void> {
  const { error } = await client()
    .from('assignments')
    .update({
      title: input.title.trim(),
      description: input.description.trim() || null,
      language: input.language.trim() || null,
      file_name: input.fileName.trim() || null,
      starter_code: input.starterCode || null,
      published: input.published,
      publish_at: input.publishAt,
      due_at: input.dueAt,
      auto_test_enabled: input.autoTestEnabled,
      kind: input.kind,
      timing_mode: input.timingMode,
      duration_minutes: input.timingMode === 'none' ? null : input.durationMinutes,
      opens_at: input.opensAt,
      closes_at: input.closesAt,
      auto_submit: input.autoSubmit,
      show_timer: input.showTimer,
      allowed_tab_outs: input.allowedTabOuts,
      fullscreen_required: input.fullscreenRequired,
      block_paste: input.blockPaste,
      run_only_terminal: input.runOnlyTerminal,
      max_attempts: input.maxAttempts
    })
    .eq('id', input.assignmentId)

  if (error) throw new Error(error.message)
}

export async function archiveClass(classId: string, archived: boolean): Promise<void> {
  const { error } = await client()
    .from('classes')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', classId)
  if (error) throw new Error(error.message)
}

export async function deleteClass(classId: string): Promise<void> {
  const { error } = await client().from('classes').delete().eq('id', classId)
  if (error) throw new Error(error.message)
}

export async function rotateClassJoinCode(classId: string): Promise<string> {
  const { data, error } = await client().rpc('rotate_class_join_code', {
    target_class: classId
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function archiveAssignment(assignmentId: string, archived: boolean): Promise<void> {
  const { error } = await client()
    .from('assignments')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', assignmentId)
  if (error) throw new Error(error.message)
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  const { error } = await client().from('assignments').delete().eq('id', assignmentId)
  if (error) throw new Error(error.message)
}

export interface BulkRosterResult {
  email: string
  result: 'added' | 'already_enrolled' | 'not_found'
}

export async function addStudentsToClass(
  classId: string,
  emails: string[]
): Promise<BulkRosterResult[]> {
  const { data, error } = await client().rpc('add_students_to_class', {
    target_class: classId,
    student_emails: emails
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Array<{ student_email: string; result: string }>).map(
    (row) => ({
      email: row.student_email,
      result: row.result === 'added' || row.result === 'already_enrolled' ? row.result : 'not_found'
    })
  )
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

interface TestCaseRowFull {
  id: string
  stdin: string | null
  expected_stdout: string | null
  ordinal: number
  is_hidden: boolean
}

export async function fetchTestCases(assignmentId: string): Promise<TestCaseEntry[]> {
  const { data, error } = await client()
    .from('test_cases')
    .select('id, stdin, expected_stdout, ordinal, is_hidden')
    .eq('assignment_id', assignmentId)
    .order('ordinal', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as TestCaseRowFull[]).map((row) => ({
    id: row.id,
    stdin: row.stdin,
    expectedStdout: row.expected_stdout,
    ordinal: row.ordinal,
    isHidden: row.is_hidden
  }))
}

export async function createTestCase(input: {
  assignmentId: string
  stdin: string
  expectedStdout: string
  hidden: boolean
  ordinal: number
}): Promise<void> {
  const { error } = await client()
    .from('test_cases')
    .insert({
      assignment_id: input.assignmentId,
      stdin: input.stdin || null,
      expected_stdout: input.expectedStdout || null,
      is_hidden: input.hidden,
      ordinal: input.ordinal
    })
  if (error) throw new Error(error.message)
}

export async function deleteTestCase(testCaseId: string): Promise<void> {
  const { error } = await client().from('test_cases').delete().eq('id', testCaseId)
  if (error) throw new Error(error.message)
}

export async function setTestCaseHidden(testCaseId: string, hidden: boolean): Promise<void> {
  const { error } = await client()
    .from('test_cases')
    .update({ is_hidden: hidden })
    .eq('id', testCaseId)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Submission list
// ---------------------------------------------------------------------------

interface IcsEmbed {
  ics: number | string | null
  band: IcsBand | null
}

interface SubmissionRow {
  id: string
  assignment_id: string
  student_id: string
  submitted_at: string
  status: string
  grade: number | string | null
  grade_released: boolean
  grade_released_at: string | null
  private_grade: { grade: number | string | null } | Array<{ grade: number | string | null }> | null
  final_snapshot_id: string | null
  student: { display_name: string | null; email: string | null } | null
  ics: IcsEmbed | IcsEmbed[] | null
  comments: CountRow[] | null
}

interface SubmissionFilter {
  assignmentId?: string
  assignmentIds?: string[]
  studentId?: string
}

async function fetchSubmissionRows(filter: SubmissionFilter): Promise<SubmissionSummary[]> {
  let query = client()
    .from('submissions')
    .select(
      `id, assignment_id, student_id, submitted_at, status, grade, grade_released, grade_released_at,
       final_snapshot_id,
       student:profiles!submissions_student_id_fkey ( display_name, email ),
       private_grade:submission_grades ( grade ),
       ics:ics_scores ( ics, band ),
       comments ( count )`
    )

  if (filter.assignmentId) query = query.eq('assignment_id', filter.assignmentId)
  if (filter.assignmentIds) query = query.in('assignment_id', filter.assignmentIds)
  if (filter.studentId) query = query.eq('student_id', filter.studentId)

  const { data, error } = await query.order('submitted_at', { ascending: true })

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as SubmissionRow[]
  if (rows.length === 0) return []

  const snapshotRes = await client()
    .from('code_snapshots')
    .select('id, submission_id')
    .in(
      'submission_id',
      rows.map((row) => row.id)
    )

  if (snapshotRes.error) throw new Error(snapshotRes.error.message)
  const snapshots = (snapshotRes.data ?? []) as unknown as Array<{
    id: string
    submission_id: string
  }>

  const snapshotOwner = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot.submission_id]))
  const pasteCounts = new Map<string, number>()

  if (snapshots.length > 0) {
    const pasteRes = await client()
      .from('paste_events')
      .select('id, snapshot_id')
      .in(
        'snapshot_id',
        snapshots.map((snapshot) => snapshot.id)
      )
    if (pasteRes.error) throw new Error(pasteRes.error.message)
    for (const paste of (pasteRes.data ?? []) as unknown as Array<{ snapshot_id: string }>) {
      const submissionId = snapshotOwner.get(paste.snapshot_id)
      if (submissionId) {
        pasteCounts.set(submissionId, (pasteCounts.get(submissionId) ?? 0) + 1)
      }
    }
  }

  return rows.map((row) => {
    const ics = firstOf(row.ics)
    const privateGrade = firstOf(row.private_grade)
    return {
      id: row.id,
      assignmentId: row.assignment_id,
      studentId: row.student_id,
      studentName: row.student?.display_name ?? row.student?.email ?? 'Student',
      studentEmail: row.student?.email ?? '',
      submittedAt: row.submitted_at,
      status: row.status,
      grade: asNumber(privateGrade?.grade) ?? asNumber(row.grade),
      gradeReleased: row.grade_released,
      gradeReleasedAt: row.grade_released_at,
      ics: ics ? asNumber(ics.ics) : null,
      band: ics?.band ?? null,
      pasteCount: pasteCounts.get(row.id) ?? 0,
      commentCount: row.comments?.[0]?.count ?? 0
    }
  })
}

export function fetchSubmissions(assignmentId: string): Promise<SubmissionSummary[]> {
  return fetchSubmissionRows({ assignmentId })
}

export function fetchStudentSubmissions(
  assignmentIds: string[],
  studentId: string
): Promise<SubmissionSummary[]> {
  if (assignmentIds.length === 0) return Promise.resolve([])
  return fetchSubmissionRows({ assignmentIds, studentId })
}

// ---------------------------------------------------------------------------
// Class-wide gradebook + student reply notifications
// ---------------------------------------------------------------------------

export async function fetchClassSubmissions(
  assignmentIds: string[]
): Promise<GradebookSubmission[]> {
  if (assignmentIds.length === 0) return []

  const { data, error } = await client()
    .from('submissions')
    .select(
      `id, assignment_id, student_id, submitted_at, grade,
       private_grade:submission_grades ( grade ),
       ics:ics_scores ( ics, band ),
       comments ( count )`
    )
    .in('assignment_id', assignmentIds)
    .order('submitted_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (
    (data ?? []) as unknown as Array<{
      assignment_id: string
      student_id: string
      submitted_at: string
      grade: number | null
      private_grade: { grade: number | null } | Array<{ grade: number | null }> | null
      ics: { ics: number; band: string } | Array<{ ics: number; band: string }> | null
      comments: Array<{ count: number }> | null
    }>
  ).map((row) => {
    const ics = firstOf(row.ics)
    const privateGrade = firstOf(row.private_grade)
    return {
      assignmentId: row.assignment_id,
      studentId: row.student_id,
      submittedAt: row.submitted_at,
      grade: privateGrade?.grade ?? row.grade,
      ics: ics?.ics ?? null,
      band: ics?.band ?? null,
      commentCount: row.comments?.[0]?.count ?? 0
    }
  })
}

export interface StudentReplyEvent {
  id: string
  classId: string
  createdAt: string
}

/** Recent student-authored comments across the professor's classes. */
export async function fetchStudentReplyEvents(limit = 400): Promise<StudentReplyEvent[]> {
  const { data, error } = await client()
    .from('comments')
    .select(
      `id, created_at,
       author:profiles!comments_author_id_fkey ( role ),
       submission:submissions!comments_submission_id_fkey (
         assignment:assignments!submissions_assignment_id_fkey ( class_id )
       )`
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as unknown as Array<{
    id: string
    created_at: string
    author: { role: string } | Array<{ role: string }> | null
    submission:
      | { assignment: { class_id: string } | Array<{ class_id: string }> | null }
      | Array<{ assignment: { class_id: string } | Array<{ class_id: string }> | null }>
      | null
  }>

  const events: StudentReplyEvent[] = []
  for (const row of rows) {
    const author = firstOf(row.author)
    if (author?.role !== 'student') continue
    const submission = firstOf(row.submission)
    const assignment = firstOf(submission?.assignment ?? null)
    if (!assignment?.class_id) continue
    events.push({ id: row.id, classId: assignment.class_id, createdAt: row.created_at })
  }
  return events
}

export interface SubmissionEvent {
  id: string
  classId: string
  submittedAt: string
}

/** Recent submissions across the professor's classes, for class-card badges. */
export async function fetchSubmissionEvents(limit = 400): Promise<SubmissionEvent[]> {
  const { data, error } = await client()
    .from('submissions')
    .select(
      `id, submitted_at,
       assignment:assignments!submissions_assignment_id_fkey ( class_id )`
    )
    .order('submitted_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const events: SubmissionEvent[] = []
  for (const row of (data ?? []) as unknown as Array<{
    id: string
    submitted_at: string
    assignment: { class_id: string } | Array<{ class_id: string }> | null
  }>) {
    const assignment = firstOf(row.assignment)
    if (!assignment?.class_id) continue
    events.push({ id: row.id, classId: assignment.class_id, submittedAt: row.submitted_at })
  }
  return events
}

// ---------------------------------------------------------------------------
// Cross-student similarity (final snapshot content per latest submission)
// ---------------------------------------------------------------------------

interface SubmissionContentRow {
  id: string
  student_id: string
  submitted_at: string
  student:
    | { display_name: string | null; email: string | null }
    | Array<{ display_name: string | null; email: string | null }>
    | null
  snapshot: { content: string } | Array<{ content: string }> | null
}

export async function fetchSubmissionContents(assignmentId: string): Promise<SimilarityEntry[]> {
  const { data, error } = await client()
    .from('submissions')
    .select(
      `id, student_id, submitted_at,
       student:profiles!submissions_student_id_fkey ( display_name, email ),
       snapshot:code_snapshots!submissions_final_snapshot_id_fkey ( content )`
    )
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as SubmissionContentRow[])
    .map((row) => {
      const student = firstOf(row.student)
      const snapshot = firstOf(row.snapshot)
      return {
        submissionId: row.id,
        studentId: row.student_id,
        studentName: student?.display_name?.trim() || student?.email?.split('@')[0] || 'Student',
        submittedAt: row.submitted_at,
        content: snapshot?.content ?? ''
      }
    })
    .filter((entry) => entry.content.trim().length > 0)
}

// ---------------------------------------------------------------------------
// Submission detail
// ---------------------------------------------------------------------------

interface ClassEmbed {
  id: string
  name: string
  code: string
}

interface AssignmentEmbed {
  id: string
  title: string
  language: string | null
  file_name: string | null
  class_id: string
  class: ClassEmbed | ClassEmbed[] | null
}

interface IcsFull {
  submission_id: string
  paste_term: number | string
  cadence_term: number | string
  focus_term: number | string
  compilation_term: number | string
  ics: number | string
  band: IcsBand
  computed_at: string
  confidence: number | string | null
  evidence: IcsEvidenceValues | null
  band_reason: string | null
  model: string | null
  exam_mode: boolean | null
  settings_version: number | string | null
  settings_snapshot: Record<string, unknown> | null
}

interface DetailRow {
  id: string
  assignment_id: string
  student_id: string
  submitted_at: string
  status: string
  grade: number | string | null
  grade_released: boolean
  grade_released_at: string | null
  private_grade: { grade: number | string | null } | Array<{ grade: number | string | null }> | null
  final_snapshot_id: string | null
  student: { display_name: string | null; email: string | null } | null
  assignment: AssignmentEmbed | AssignmentEmbed[] | null
  ics: IcsFull | IcsFull[] | null
}

interface SnapshotRow {
  id: string
  snapshot_type: SnapshotType
  content: string
  char_count: number
  line_count: number
  version: number
  created_at: string
  typing_intervals: number[] | null
}

interface PasteRow {
  id: string
  snapshot_id: string | null
  file_name: string
  pasted_text: string
  pasted_chars: number
  paste_mode: string | null
  detected_via: string
  created_at: string
}

interface CommentRow {
  id: string
  submission_id: string
  author_id: string
  snapshot_id: string | null
  anchor_line: number | null
  parent_id: string | null
  body: string
  created_at: string
  author:
    | { display_name: string | null; role: string }
    | Array<{ display_name: string | null; role: string }>
    | null
}

interface TestCaseRow {
  id: string
  stdin: string | null
  expected_stdout: string | null
  ordinal: number
  is_hidden: boolean
}

export async function fetchSubmissionDetail(submissionId: string): Promise<SubmissionDetailData> {
  const { data, error } = await client()
    .from('submissions')
    .select(
      `id, assignment_id, student_id, submitted_at, status, grade, grade_released, grade_released_at,
       final_snapshot_id,
       student:profiles!submissions_student_id_fkey ( display_name, email ),
       private_grade:submission_grades ( grade ),
       assignment:assignments!submissions_assignment_id_fkey (
         id, title, language, file_name, class_id,
         class:classes!assignments_class_id_fkey ( id, name, code )
       ),
       ics:ics_scores ( submission_id, paste_term, cadence_term, focus_term, compilation_term, ics, band, computed_at, confidence, evidence, band_reason, model, exam_mode, settings_version, settings_snapshot )`
    )
    .eq('id', submissionId)
    .single()

  if (error) throw new Error(error.message)
  const row = data as unknown as DetailRow
  const assignment = firstOf(row.assignment)
  const klass = firstOf(assignment?.class ?? null)
  const ics = firstOf(row.ics)
  const privateGrade = firstOf(row.private_grade)

  const [snapshotRes, commentRes, testRes] = await Promise.all([
    client()
      .from('code_snapshots')
      .select(
        'id, snapshot_type, content, char_count, line_count, version, created_at, typing_intervals'
      )
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true }),
    client()
      .from('comments')
      .select(
        `id, submission_id, author_id, snapshot_id, anchor_line, parent_id, body, created_at,
         author:profiles!comments_author_id_fkey ( display_name, role )`
      )
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true }),
    client()
      .from('test_cases')
      .select('id, stdin, expected_stdout, ordinal, is_hidden')
      .eq('assignment_id', row.assignment_id)
      .order('ordinal', { ascending: true })
  ])

  if (snapshotRes.error) throw new Error(snapshotRes.error.message)
  if (commentRes.error) throw new Error(commentRes.error.message)
  if (testRes.error) throw new Error(testRes.error.message)

  const snapshotRows = (snapshotRes.data ?? []) as unknown as SnapshotRow[]
  const commentRows = (commentRes.data ?? []) as unknown as CommentRow[]
  const testRows = (testRes.data ?? []) as unknown as TestCaseRow[]

  const pasteMeta = new Map<string, { sources: Set<string>; chars: number; events: number }>()
  const pasteEntries: PasteEntry[] = []
  if (snapshotRows.length > 0) {
    const pasteRes = await client()
      .from('paste_events')
      .select(
        'id, snapshot_id, file_name, pasted_text, pasted_chars, paste_mode, detected_via, created_at'
      )
      .in(
        'snapshot_id',
        snapshotRows.map((snapshot) => snapshot.id)
      )
    if (pasteRes.error) throw new Error(pasteRes.error.message)
    for (const paste of (pasteRes.data ?? []) as unknown as PasteRow[]) {
      if (paste.snapshot_id) {
        const meta = pasteMeta.get(paste.snapshot_id) ?? {
          sources: new Set<string>(),
          chars: 0,
          events: 0
        }
        meta.sources.add(paste.detected_via)
        meta.chars += paste.pasted_chars
        meta.events += 1
        pasteMeta.set(paste.snapshot_id, meta)
      }
      pasteEntries.push({
        id: paste.id,
        snapshotId: paste.snapshot_id,
        fileName: paste.file_name,
        text: paste.pasted_text,
        chars: paste.pasted_chars,
        mode: paste.paste_mode,
        detectedVia: paste.detected_via,
        createdAt: paste.created_at
      })
    }
    pasteEntries.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  const snapshots: SnapshotEntry[] = snapshotRows.map((snapshot) => {
    const meta = pasteMeta.get(snapshot.id)
    return {
      id: snapshot.id,
      type: snapshot.snapshot_type,
      createdAt: snapshot.created_at,
      charCount: snapshot.char_count,
      lineCount: snapshot.line_count,
      version: snapshot.version,
      content: snapshot.content,
      pasteDetectedVia: meta ? Array.from(meta.sources).join(', ') : null,
      pasteChars: meta?.chars ?? 0,
      typingIntervals: snapshot.typing_intervals ?? []
    }
  })

  const comments: CommentEntry[] = commentRows.map((comment) => {
    const author = firstOf(comment.author)
    return {
      id: comment.id,
      submissionId: comment.submission_id,
      authorId: comment.author_id,
      authorRole: author?.role === 'professor' ? 'professor' : 'student',
      authorName: author?.display_name ?? (author?.role === 'professor' ? 'Professor' : 'Student'),
      snapshotId: comment.snapshot_id,
      anchorLine: comment.anchor_line,
      parentId: comment.parent_id,
      body: comment.body,
      createdAt: comment.created_at
    }
  })

  const testCases: TestCaseEntry[] = testRows.map((testCase) => ({
    id: testCase.id,
    stdin: testCase.stdin,
    expectedStdout: testCase.expected_stdout,
    ordinal: testCase.ordinal,
    isHidden: testCase.is_hidden
  }))

  const icsScore: IcsScoreRow | null = ics
    ? {
        submissionId: ics.submission_id,
        pasteTerm: Number(ics.paste_term),
        cadenceTerm: Number(ics.cadence_term),
        focusTerm: Number(ics.focus_term),
        compilationTerm: Number(ics.compilation_term),
        ics: Number(ics.ics),
        band: ics.band,
        computedAt: ics.computed_at,
        confidence: ics.confidence === null ? null : Number(ics.confidence),
        evidence: ics.evidence,
        bandReason: ics.band_reason,
        model: ics.model,
        examMode: ics.exam_mode === true,
        settingsVersion: ics.settings_version === null ? null : Number(ics.settings_version),
        settingsSnapshot: ics.settings_snapshot as IcsSettingsSnapshot | null
      }
    : null

  const pasteCount = Array.from(pasteMeta.values()).reduce((total, meta) => total + meta.events, 0)

  return {
    summary: {
      id: row.id,
      assignmentId: row.assignment_id,
      studentId: row.student_id,
      studentName: row.student?.display_name ?? row.student?.email ?? 'Student',
      studentEmail: row.student?.email ?? '',
      submittedAt: row.submitted_at,
      status: row.status,
      grade: asNumber(privateGrade?.grade) ?? asNumber(row.grade),
      gradeReleased: row.grade_released,
      gradeReleasedAt: row.grade_released_at,
      ics: icsScore?.ics ?? null,
      band: icsScore?.band ?? null,
      pasteCount,
      commentCount: comments.length
    },
    assignmentId: row.assignment_id,
    assignmentTitle: assignment?.title ?? 'Assignment',
    fileName: assignment?.file_name ?? null,
    language: assignment?.language ?? null,
    classId: klass?.id ?? assignment?.class_id ?? '',
    className: klass?.name ?? '',
    classCode: klass?.code ?? '',
    finalSnapshotId: row.final_snapshot_id,
    snapshots,
    pastes: pasteEntries,
    icsScore,
    comments,
    testCases
  }
}

// ---------------------------------------------------------------------------
// Professor insight views
// ---------------------------------------------------------------------------

export async function fetchPasteSimilarity(
  submissionId: string,
  minSimilarity = 0.45
): Promise<PasteSimilarityMatch[]> {
  const { data, error } = await client().rpc('professor_paste_matches', {
    target_submission: submissionId,
    min_similarity: minSimilarity
  })
  if (error) throw new Error(error.message)

  return (
    (data ?? []) as unknown as Array<{
      paste_id: string
      pasted_text: string
      paste_created_at: string
      similarity: number
      match_paste_id: string
      match_text: string
      match_submission_id: string
      match_student_id: string
      match_student_name: string
      match_created_at: string
    }>
  ).map((row) => ({
    pasteId: row.paste_id,
    pastedText: row.pasted_text,
    pasteCreatedAt: row.paste_created_at,
    similarity: Number(row.similarity),
    matchPasteId: row.match_paste_id,
    matchText: row.match_text,
    matchSubmissionId: row.match_submission_id,
    matchStudentId: row.match_student_id,
    matchStudentName: row.match_student_name,
    matchCreatedAt: row.match_created_at
  }))
}

export async function fetchLiveLabStatus(): Promise<LiveLabStudent[]> {
  const { data, error } = await client()
    .from('student_presence')
    .select(
      `student_id, current_file, status, idle_seconds, last_seen_at,
       student:profiles!student_presence_student_id_fkey ( display_name, email )`
    )
    .order('last_seen_at', { ascending: false })

  if (error) throw new Error(error.message)

  const now = Date.now()
  return (
    (data ?? []) as unknown as Array<{
      student_id: string
      current_file: string | null
      status: string
      idle_seconds: number
      last_seen_at: string
      student:
        | { display_name: string | null; email: string | null }
        | Array<{ display_name: string | null; email: string | null }>
        | null
    }>
  ).map((row) => {
    const student = firstOf(row.student)
    const storedStatus: 'active' | 'idle' | 'flagged' =
      row.status === 'active' || row.status === 'flagged' ? row.status : 'idle'
    const age = now - (Date.parse(row.last_seen_at) || 0)
    return {
      studentId: row.student_id,
      name: student?.display_name?.trim() || student?.email?.split('@')[0] || 'Student',
      email: student?.email ?? '',
      status: age > 90_000 ? 'offline' : storedStatus,
      storedStatus,
      idleSeconds: row.idle_seconds,
      currentFile: row.current_file,
      lastSeenAt: row.last_seen_at
    }
  })
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function recomputeIcs(submissionId: string): Promise<void> {
  const { error } = await client().rpc('recompute_ics', {
    target_submission: submissionId
  })
  if (error) throw new Error(error.message)
}

export async function recomputeIcsForAssignment(assignmentId: string): Promise<number> {
  const { data, error } = await client().rpc('recompute_ics_for_assignment', {
    target_assignment: assignmentId
  })
  if (error) throw new Error(error.message)
  return (data as number | null) ?? 0
}

interface CodeRunRow {
  id: string
  created_at: string
  status_id: number
  status_description: string
  passed: boolean | null
  time_seconds: number | string | null
  memory_kb: number | null
  language: string | null
  test_case: { ordinal: number } | { ordinal: number }[] | null
}

export async function fetchSubmissionRuns(submissionId: string): Promise<CodeRunEntry[]> {
  const { data, error } = await client()
    .from('code_runs')
    .select(
      'id, created_at, status_id, status_description, passed, time_seconds, memory_kb, language, test_case:test_cases(ordinal)'
    )
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as CodeRunRow[]).map((row) => {
    const testCase = firstOf(row.test_case)
    return {
      id: row.id,
      createdAt: row.created_at,
      statusId: row.status_id,
      statusDescription: row.status_description,
      passed: row.passed,
      timeSeconds: row.time_seconds === null ? null : Number(row.time_seconds),
      memoryKb: row.memory_kb,
      language: row.language,
      testCaseOrdinal: testCase?.ordinal ?? null
    }
  })
}

export async function saveGrade(input: {
  submissionId: string
  professorId: string
  grade: number
}): Promise<void> {
  // The RPC stores the mark in the professor-only table and clears the
  // published value, so saving is always private until an explicit release.
  const { error } = await client().rpc('save_submission_grade', {
    target_submission: input.submissionId,
    target_grade: input.grade
  })

  if (error) throw new Error(error.message)
}

export async function setSubmissionGradeRelease(input: {
  submissionId: string
  released: boolean
}): Promise<void> {
  const { error } = await client().rpc('set_submission_grade_release', {
    target_submission: input.submissionId,
    released: input.released
  })
  if (error) throw new Error(error.message)
}

export async function releaseAssignmentGrades(assignmentId: string): Promise<number> {
  const { data, error } = await client().rpc('release_assignment_grades', {
    target_assignment: assignmentId
  })
  if (error) throw new Error(error.message)
  return (data as number | null) ?? 0
}

export async function insertComment(input: {
  submissionId: string
  authorId: string
  snapshotId: string | null
  anchorLine: number
  body: string
  parentId: string | null
}): Promise<void> {
  const { error } = await client().from('comments').insert({
    submission_id: input.submissionId,
    author_id: input.authorId,
    snapshot_id: input.snapshotId,
    anchor_line: input.anchorLine,
    body: input.body.trim(),
    parent_id: input.parentId
  })

  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Student read-only feedback
// ---------------------------------------------------------------------------

interface FeedbackSubmissionRow {
  id: string
  submitted_at: string
  assignment: { title: string; class: ClassEmbed | ClassEmbed[] | null } | null
}

export async function fetchStudentFeedback(studentId: string): Promise<StudentFeedbackItem[]> {
  const { data, error } = await client()
    .from('submissions')
    .select(
      `id, submitted_at,
       assignment:assignments!submissions_assignment_id_fkey (
         title,
         class:classes!assignments_class_id_fkey ( code )
       )`
    )
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(error.message)
  const submissions = (data ?? []) as unknown as FeedbackSubmissionRow[]
  if (submissions.length === 0) return []

  // Grades come from the masked student view so unpublished marks stay hidden.
  const gradeRes = await client()
    .from('student_submissions')
    .select('id, grade')
    .in(
      'id',
      submissions.map((submission) => submission.id)
    )
  if (gradeRes.error) throw new Error(gradeRes.error.message)

  const gradeById = new Map(
    ((gradeRes.data ?? []) as unknown as Array<{ id: string; grade: number | null }>).map(
      (row) => [row.id, row.grade] as const
    )
  )

  const byId = new Map(
    submissions.map((submission) => {
      const assignment = firstOf(submission.assignment)
      const klass = firstOf(assignment?.class ?? null)
      return [
        submission.id,
        {
          assignmentTitle: assignment?.title ?? 'Assignment',
          classCode: klass?.code ?? '',
          submittedAt: submission.submitted_at,
          grade: gradeById.get(submission.id) ?? null
        }
      ] as const
    })
  )

  const commentRes = await client()
    .from('comments')
    .select('id, body, anchor_line, snapshot_id, parent_id, created_at, submission_id, author_id')
    .in(
      'submission_id',
      submissions.map((submission) => submission.id)
    )
    .order('created_at', { ascending: false })

  if (commentRes.error) throw new Error(commentRes.error.message)

  return (
    (commentRes.data ?? []) as unknown as Array<{
      id: string
      body: string
      anchor_line: number | null
      snapshot_id: string | null
      parent_id: string | null
      created_at: string
      submission_id: string
      author_id: string
    }>
  ).map((comment) => {
    const meta = byId.get(comment.submission_id)
    // Professors' profile rows are not readable by students, so derive the
    // author from the submission: RLS only lets the owner or the class
    // professor write here, so anything not written by this student is the
    // professor's feedback.
    const isProfessor = comment.author_id !== studentId
    return {
      id: comment.id,
      submissionId: comment.submission_id,
      body: comment.body,
      anchorLine: comment.anchor_line,
      anchorSnapshotId: comment.snapshot_id,
      parentId: comment.parent_id,
      authorRole: isProfessor ? 'professor' : 'student',
      authorName: isProfessor ? 'Professor' : 'You',
      createdAt: comment.created_at,
      assignmentTitle: meta?.assignmentTitle ?? 'Assignment',
      classCode: meta?.classCode ?? '',
      submittedAt: meta?.submittedAt ?? comment.created_at,
      grade: meta?.grade ?? null
    }
  })
}
