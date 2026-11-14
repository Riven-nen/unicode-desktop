import { supabase } from './supabase'
import type {
  AssignmentSummary,
  ClassSummary,
  CommentEntry,
  IcsBand,
  IcsScoreRow,
  RosterStudent,
  SnapshotEntry,
  SnapshotType,
  StudentFeedbackItem,
  SubmissionDetailData,
  SubmissionSummary,
  TestCaseEntry
} from '../types/professor'

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
  enrollments: CountRow[] | null
  assignments: CountRow[] | null
}

export async function fetchClasses(professorId: string): Promise<ClassSummary[]> {
  const { data, error } = await client()
    .from('classes')
    .select('id, name, code, enrollments(count), assignments(count)')
    .eq('professor_id', professorId)
    .order('code', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as ClassRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    studentCount: row.enrollments?.[0]?.count ?? 0,
    assignmentCount: row.assignments?.[0]?.count ?? 0
  }))
}

export async function createClass(input: {
  professorId: string
  name: string
  code: string
}): Promise<string> {
  const { data, error } = await client()
    .from('classes')
    .insert({
      professor_id: input.professorId,
      name: input.name.trim(),
      code: input.code.trim()
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
}): Promise<void> {
  const { error } = await client()
    .from('classes')
    .update({ name: input.name.trim(), code: input.code.trim() })
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
  starter_code: string | null
  test_cases: Array<{ id: string; is_hidden: boolean }> | null
}

export async function fetchAssignments(classId: string): Promise<AssignmentSummary[]> {
  const { data, error } = await client()
    .from('assignments')
    .select('id, title, language, description, starter_code, test_cases(id, is_hidden)')
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
      starterCode: row.starter_code,
      testCaseCount: cases.length,
      hiddenCaseCount: cases.filter((testCase) => testCase.is_hidden).length
    }
  })
}

// ---------------------------------------------------------------------------
// Assignment editing
// ---------------------------------------------------------------------------

export async function createAssignment(input: {
  classId: string
  title: string
  description: string
  language: string
  starterCode: string
}): Promise<string> {
  const { data, error } = await client()
    .from('assignments')
    .insert({
      class_id: input.classId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      language: input.language.trim() || null,
      starter_code: input.starterCode || null
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return (data as unknown as { id: string }).id
}

export async function updateAssignment(input: {
  assignmentId: string
  title: string
  description: string
  language: string
  starterCode: string
}): Promise<void> {
  const { error } = await client()
    .from('assignments')
    .update({
      title: input.title.trim(),
      description: input.description.trim() || null,
      language: input.language.trim() || null,
      starter_code: input.starterCode || null
    })
    .eq('id', input.assignmentId)

  if (error) throw new Error(error.message)
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
  student_id: string
  submitted_at: string
  status: string
  grade: number | string | null
  final_snapshot_id: string | null
  student: { display_name: string | null; email: string | null } | null
  ics: IcsEmbed | IcsEmbed[] | null
  comments: CountRow[] | null
}

export async function fetchSubmissions(assignmentId: string): Promise<SubmissionSummary[]> {
  const { data, error } = await client()
    .from('submissions')
    .select(
      `id, student_id, submitted_at, status, grade, final_snapshot_id,
       student:profiles!submissions_student_id_fkey ( display_name, email ),
       ics:ics_scores ( ics, band ),
       comments ( count )`
    )
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: true })

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
    return {
      id: row.id,
      studentId: row.student_id,
      studentName: row.student?.display_name ?? row.student?.email ?? 'Student',
      studentEmail: row.student?.email ?? '',
      submittedAt: row.submitted_at,
      status: row.status,
      grade: asNumber(row.grade),
      ics: ics ? asNumber(ics.ics) : null,
      band: ics?.band ?? null,
      pasteCount: pasteCounts.get(row.id) ?? 0,
      commentCount: row.comments?.[0]?.count ?? 0
    }
  })
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
}

interface DetailRow {
  id: string
  assignment_id: string
  student_id: string
  submitted_at: string
  status: string
  grade: number | string | null
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
}

interface PasteRow {
  snapshot_id: string
  detected_via: string
  pasted_chars: number
}

interface CommentRow {
  id: string
  submission_id: string
  snapshot_id: string | null
  anchor_line: number | null
  parent_id: string | null
  body: string
  created_at: string
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
      `id, assignment_id, student_id, submitted_at, status, grade, final_snapshot_id,
       student:profiles!submissions_student_id_fkey ( display_name, email ),
       assignment:assignments!submissions_assignment_id_fkey (
         id, title, language, class_id,
         class:classes!assignments_class_id_fkey ( id, name, code )
       ),
       ics:ics_scores ( submission_id, paste_term, cadence_term, focus_term, compilation_term, ics, band, computed_at )`
    )
    .eq('id', submissionId)
    .single()

  if (error) throw new Error(error.message)
  const row = data as unknown as DetailRow
  const assignment = firstOf(row.assignment)
  const klass = firstOf(assignment?.class ?? null)
  const ics = firstOf(row.ics)

  const [snapshotRes, commentRes, testRes] = await Promise.all([
    client()
      .from('code_snapshots')
      .select('id, snapshot_type, content, char_count, line_count, version, created_at')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true }),
    client()
      .from('comments')
      .select('id, submission_id, snapshot_id, anchor_line, parent_id, body, created_at')
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
  if (snapshotRows.length > 0) {
    const pasteRes = await client()
      .from('paste_events')
      .select('snapshot_id, detected_via, pasted_chars')
      .in(
        'snapshot_id',
        snapshotRows.map((snapshot) => snapshot.id)
      )
    if (pasteRes.error) throw new Error(pasteRes.error.message)
    for (const paste of (pasteRes.data ?? []) as unknown as PasteRow[]) {
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
      pasteChars: meta?.chars ?? 0
    }
  })

  const comments: CommentEntry[] = commentRows.map((comment) => ({
    id: comment.id,
    submissionId: comment.submission_id,
    snapshotId: comment.snapshot_id,
    anchorLine: comment.anchor_line,
    parentId: comment.parent_id,
    body: comment.body,
    createdAt: comment.created_at
  }))

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
        computedAt: ics.computed_at
      }
    : null

  const pasteCount = Array.from(pasteMeta.values()).reduce((total, meta) => total + meta.events, 0)

  return {
    summary: {
      id: row.id,
      studentId: row.student_id,
      studentName: row.student?.display_name ?? row.student?.email ?? 'Student',
      studentEmail: row.student?.email ?? '',
      submittedAt: row.submitted_at,
      status: row.status,
      grade: asNumber(row.grade),
      ics: icsScore?.ics ?? null,
      band: icsScore?.band ?? null,
      pasteCount,
      commentCount: comments.length
    },
    assignmentId: row.assignment_id,
    assignmentTitle: assignment?.title ?? 'Assignment',
    language: assignment?.language ?? null,
    classId: klass?.id ?? assignment?.class_id ?? '',
    className: klass?.name ?? '',
    classCode: klass?.code ?? '',
    finalSnapshotId: row.final_snapshot_id,
    snapshots,
    icsScore,
    comments,
    testCases
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function saveGrade(input: {
  submissionId: string
  professorId: string
  grade: number
}): Promise<void> {
  const { error } = await client()
    .from('submissions')
    .update({
      grade: input.grade,
      graded_at: new Date().toISOString(),
      graded_by: input.professorId
    })
    .eq('id', input.submissionId)

  if (error) throw new Error(error.message)
}

export async function insertComment(input: {
  submissionId: string
  professorId: string
  snapshotId: string | null
  anchorLine: number
  body: string
  parentId: string | null
}): Promise<void> {
  const { error } = await client().from('comments').insert({
    submission_id: input.submissionId,
    professor_id: input.professorId,
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
  assignment: { title: string; class: ClassEmbed | ClassEmbed[] | null } | null
}

export async function fetchStudentFeedback(studentId: string): Promise<StudentFeedbackItem[]> {
  const { data, error } = await client()
    .from('submissions')
    .select(
      `id,
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

  const byId = new Map(
    submissions.map((submission) => {
      const assignment = firstOf(submission.assignment)
      const klass = firstOf(assignment?.class ?? null)
      return [
        submission.id,
        {
          assignmentTitle: assignment?.title ?? 'Assignment',
          classCode: klass?.code ?? ''
        }
      ] as const
    })
  )

  const commentRes = await client()
    .from('comments')
    .select('id, body, anchor_line, parent_id, created_at, submission_id')
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
      parent_id: string | null
      created_at: string
      submission_id: string
    }>
  ).map((comment) => {
    const meta = byId.get(comment.submission_id)
    return {
      id: comment.id,
      body: comment.body,
      anchorLine: comment.anchor_line,
      parentId: comment.parent_id,
      createdAt: comment.created_at,
      assignmentTitle: meta?.assignmentTitle ?? 'Assignment',
      classCode: meta?.classCode ?? ''
    }
  })
}
