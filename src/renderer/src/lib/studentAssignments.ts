import { supabase } from './supabase'
import { fetchStudentAssessmentSessions } from './assessments'
import type { StudentAssessmentSessionRow } from './assessments'
import type { AssessmentKind, AssessmentTimingMode } from '../types/assessment'
import type {
  StudentAssessmentSession,
  StudentAssignment,
  StudentSubmission
} from '../types/student'
import type { TestCaseEntry } from '../types/professor'

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

interface ClassEmbed {
  id: string
  name: string
  code: string | null
  archived_at: string | null
}

interface AssignmentRow {
  id: string
  class_id: string
  title: string
  description: string | null
  language: string | null
  file_name: string | null
  starter_code: string | null
  created_at: string
  publish_at: string | null
  due_at: string | null
  auto_test_enabled: boolean
  kind: AssessmentKind
  timing_mode: AssessmentTimingMode
  duration_minutes: number | null
  opens_at: string | null
  closes_at: string | null
  auto_submit: boolean
  show_timer: boolean
  allowed_tab_outs: number
  fullscreen_required: boolean
  block_paste: boolean
  run_only_terminal: boolean
  class: ClassEmbed | ClassEmbed[] | null
}

interface SubmissionRow {
  id: string
  assignment_id: string
  submitted_at: string
  status: string
  grade: number | string | null
  grade_released_at: string | null
  comment_count: number | null
}

/**
 * Every assignment in the classes this student is enrolled in, with their
 * latest submission attached. RLS limits the assignment rows to enrolled
 * classes; the submission query is scoped to the signed-in student.
 */
export async function fetchStudentAssignments(studentId: string): Promise<StudentAssignment[]> {
  const { data, error } = await client()
    .from('assignments')
    .select(
      `id, class_id, title, description, language, file_name, starter_code, created_at, publish_at, due_at, auto_test_enabled,
       kind, timing_mode, duration_minutes, opens_at, closes_at, auto_submit, show_timer,
       allowed_tab_outs, fullscreen_required, block_paste, run_only_terminal,
       class:classes!assignments_class_id_fkey ( id, name, code, archived_at )`
    )
    .eq('published', true)
    .is('archived_at', null)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const assignments = ((data ?? []) as unknown as AssignmentRow[])
    .filter((row) => firstOf(row.class)?.archived_at === null)
    .map((row) => {
      const klass = firstOf(row.class)
      return {
        id: row.id,
        classId: row.class_id,
        classCode: klass?.code ?? '',
        className: klass?.name ?? 'Class',
        title: row.title,
        description: row.description,
        language: row.language,
        fileName: row.file_name,
        starterCode: row.starter_code,
        createdAt: row.created_at,
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
        allowedTabOuts: row.allowed_tab_outs,
        fullscreenRequired: row.fullscreen_required,
        blockPaste: row.block_paste,
        runOnlyTerminal: row.run_only_terminal,
        latestSubmission: null,
        session: null
      } satisfies StudentAssignment
    })

  if (assignments.length === 0) return assignments

  // Sessions come first: lazy expiry can create an auto-submission, and the
  // submission query below should see it on the same load.
  let sessions = new Map<string, StudentAssessmentSessionRow>()
  try {
    sessions = await fetchStudentAssessmentSessions(studentId)
  } catch {
    // Sessions are optional context on the dashboard. A failure here must not
    // hide the assignment list; the start/resume RPC will surface the error.
  }

  // The student view masks grades until the professor releases them.
  const submissionRes = await client()
    .from('student_submissions')
    .select('id, assignment_id, submitted_at, status, grade, grade_released_at, comment_count')
    .eq('student_id', studentId)
    .in(
      'assignment_id',
      assignments.map((assignment) => assignment.id)
    )
    .order('submitted_at', { ascending: true })

  if (submissionRes.error) throw new Error(submissionRes.error.message)

  // Rows are oldest-first, so the last write wins per assignment.
  const latest = new Map<string, StudentSubmission>()
  for (const row of (submissionRes.data ?? []) as unknown as SubmissionRow[]) {
    latest.set(row.assignment_id, {
      id: row.id,
      submittedAt: row.submitted_at,
      status: row.status,
      grade: asNumber(row.grade),
      gradeReleasedAt: row.grade_released_at,
      commentCount: row.comment_count ?? 0
    })
  }

  return assignments.map((assignment) => {
    const row = sessions.get(assignment.id)
    const session: StudentAssessmentSession | null = row
      ? {
          id: row.id,
          status: row.status,
          startedAt: row.started_at,
          expiresAt: row.expires_at,
          submittedAt: row.submitted_at,
          lastSavedAt: row.last_saved_at,
          draftRevision: Number(row.draft_revision ?? 0),
          examMode: row.exam_mode,
          allowedTabOuts: Number(row.allowed_tab_outs ?? 0),
          tabOutCount: Number(row.tab_out_count ?? 0),
          fullscreenExitCount: Number(row.fullscreen_exit_count ?? 0),
          blockedPasteCount: Number(row.blocked_paste_count ?? 0),
          interruptionCount: Number(row.interruption_count ?? 0),
          fullscreenRequired: row.fullscreen_required,
          blockPaste: row.block_paste,
          runOnlyTerminal: row.run_only_terminal,
          overrideNote: row.override_note,
          overrideAt: row.override_at,
          serverOffsetMs: row.server_offset_ms
        }
      : null
    return {
      ...assignment,
      latestSubmission: latest.get(assignment.id) ?? null,
      session
    }
  })
}

/**
 * Creates a submission and attaches the student's snapshots for the file.
 * The database function verifies enrollment and captures the current editor
 * content when nothing has synced yet.
 */
export async function fetchStudentTestCases(assignmentId: string): Promise<TestCaseEntry[]> {
  const { data, error } = await client()
    .from('test_cases')
    .select('id, stdin, expected_stdout, ordinal, is_hidden')
    .eq('assignment_id', assignmentId)
    .eq('is_hidden', false)
    .order('ordinal', { ascending: true })

  if (error) throw new Error(error.message)
  return (
    (data ?? []) as unknown as Array<{
      id: string
      stdin: string | null
      expected_stdout: string | null
      ordinal: number
      is_hidden: boolean
    }>
  ).map((row) => ({
    id: row.id,
    stdin: row.stdin,
    expectedStdout: row.expected_stdout,
    ordinal: row.ordinal,
    isHidden: row.is_hidden
  }))
}

export async function submitAssignment(input: {
  assignmentId: string
  fileName: string
  content: string
  /** Idempotency key for offline retries. */
  clientToken: string
}): Promise<string> {
  const { data, error } = await client().rpc('submit_assignment', {
    target_assignment: input.assignmentId,
    target_file: input.fileName,
    fallback_content: input.content,
    target_client_token: input.clientToken
  })

  if (error) throw new Error(error.message)
  return data as string
}
