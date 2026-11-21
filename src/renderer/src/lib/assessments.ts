import { supabase } from './supabase'
import type {
  AssessmentDraftResult,
  AssessmentEventEntry,
  AssessmentEventKind,
  AssessmentEventResult,
  AssessmentEventType,
  AssessmentExamState,
  AssessmentOverrideResult,
  AssessmentSession,
  AssessmentSessionStatus,
  AssessmentSessionSummary,
  AssessmentSubmissionResult
} from '../types/assessment'

function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

interface SessionRow {
  session_id: string
  assignment_id: string
  status: AssessmentSessionStatus
  started_at: string
  expires_at: string | null
  server_now: string
  draft_content: string | null
  draft_revision: number | string | null
}

interface DraftRow {
  revision: number | string | null
  saved_at: string
  expires_at: string | null
  server_now: string
  status: AssessmentSessionStatus
}

interface SubmitRow {
  submission_id: string
  status: AssessmentSessionStatus
  submitted_at: string
}

interface MonitorRow {
  session_id: string
  student_id: string
  student_name: string
  student_email: string | null
  status: AssessmentSessionStatus
  started_at: string
  expires_at: string | null
  submitted_at: string | null
  last_saved_at: string | null
  draft_revision: number | string | null
  final_submission_id: string | null
  server_now: string
  exam_mode: boolean
  allowed_tab_outs: number
  tab_out_count: number
  fullscreen_exit_count: number
  blocked_paste_count: number
  interruption_count: number
  fullscreen_required: boolean
  block_paste: boolean
  run_only_terminal: boolean
  override_note: string | null
  override_at: string | null
}

interface ExamStateRow {
  session_id: string
  exam_mode: boolean
  allowed_tab_outs: number
  tab_out_count: number
  fullscreen_exit_count: number
  blocked_paste_count: number
  interruption_count: number
  fullscreen_required: boolean
  block_paste: boolean
  run_only_terminal: boolean
  override_note: string | null
  override_at: string | null
  server_now: string
}

interface EventRow {
  action: 'logged' | 'warning' | 'auto_submit'
  status: AssessmentSessionStatus
  tab_out_count: number
  fullscreen_exit_count: number
  blocked_paste_count: number
  interruption_count: number
  allowed_tab_outs: number
  submission_id: string | null
  server_now: string
}

interface OverrideRow {
  status: AssessmentSessionStatus
  expires_at: string | null
  interruption_count: number
  override_note: string | null
  override_at: string | null
  server_now: string
}

export interface StudentAssessmentSessionRow {
  id: string
  assignment_id: string
  status: AssessmentSessionStatus
  started_at: string
  expires_at: string | null
  submitted_at: string | null
  last_saved_at: string | null
  draft_revision: number | string | null
  exam_mode: boolean
  allowed_tab_outs: number
  tab_out_count: number
  fullscreen_exit_count: number
  blocked_paste_count: number
  interruption_count: number
  fullscreen_required: boolean
  block_paste: boolean
  run_only_terminal: boolean
  override_note: string | null
  override_at: string | null
  server_offset_ms: number
}

/** RPCs that return `table(...)` arrive as a one-row array. */
function firstRow<T>(data: T[] | T | null): T | null {
  if (data === null) return null
  return Array.isArray(data) ? (data[0] ?? null) : data
}

function offsetFrom(serverNow: string): number {
  const parsed = Date.parse(serverNow)
  return Number.isFinite(parsed) ? parsed - Date.now() : 0
}

function mapSession(row: SessionRow): AssessmentSession {
  return {
    sessionId: row.session_id,
    assignmentId: row.assignment_id,
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    serverNow: row.server_now,
    serverOffsetMs: offsetFrom(row.server_now),
    draftContent: row.draft_content ?? '',
    draftRevision: Number(row.draft_revision ?? 0),
    // Filled from fetch_assessment_exam_state immediately after start/resume.
    examMode: false,
    allowedTabOuts: 0,
    tabOutCount: 0,
    fullscreenExitCount: 0,
    blockedPasteCount: 0,
    interruptionCount: 0,
    fullscreenRequired: false,
    blockPaste: false,
    runOnlyTerminal: false,
    overrideNote: null,
    overrideAt: null
  }
}

function mapExamState(row: ExamStateRow): AssessmentExamState {
  return {
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
    serverOffsetMs: offsetFrom(row.server_now)
  }
}

export async function fetchAssessmentExamState(
  sessionId: string
): Promise<AssessmentExamState | null> {
  const { data, error } = await client().rpc('fetch_assessment_exam_state', {
    target_session: sessionId
  })
  if (error) throw new Error(error.message)
  const row = firstRow((data ?? []) as unknown as ExamStateRow[])
  return row ? mapExamState(row) : null
}

export async function recordAssessmentEvent(input: {
  sessionId: string
  eventType: AssessmentEventType
  metadata?: Record<string, unknown>
}): Promise<AssessmentEventResult> {
  const { data, error } = await client().rpc('record_assessment_event', {
    target_session: input.sessionId,
    event_type: input.eventType,
    event_metadata: input.metadata ?? {}
  })
  if (error) throw new Error(error.message)
  const row = firstRow((data ?? []) as unknown as EventRow[])
  if (!row) throw new Error('The assessment event could not be recorded.')
  return {
    action: row.action,
    status: row.status,
    tabOutCount: Number(row.tab_out_count ?? 0),
    fullscreenExitCount: Number(row.fullscreen_exit_count ?? 0),
    blockedPasteCount: Number(row.blocked_paste_count ?? 0),
    interruptionCount: Number(row.interruption_count ?? 0),
    allowedTabOuts: Number(row.allowed_tab_outs ?? 0),
    submissionId: row.submission_id,
    serverNow: row.server_now,
    serverOffsetMs: offsetFrom(row.server_now)
  }
}

export async function fetchAssessmentEvents(sessionId: string): Promise<AssessmentEventEntry[]> {
  const { data, error } = await client()
    .from('assessment_events')
    .select('id, student_id, event_type, metadata, occurred_at')
    .eq('session_id', sessionId)
    .order('occurred_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    studentId: row.student_id as string,
    eventType: row.event_type as AssessmentEventKind,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    occurredAt: row.occurred_at as string
  }))
}

export async function applyAssessmentOverride(input: {
  sessionId: string
  action: 'extend_time' | 'excuse_interruption' | 'reopen'
  minutes?: number
  reason?: string
}): Promise<AssessmentOverrideResult> {
  const { data, error } = await client().rpc('apply_assessment_override', {
    target_session: input.sessionId,
    override_action: input.action,
    override_minutes: input.minutes ?? null,
    override_reason: input.reason ?? null
  })
  if (error) throw new Error(error.message)
  const row = firstRow((data ?? []) as unknown as OverrideRow[])
  if (!row) throw new Error('The override could not be applied.')
  return {
    status: row.status,
    expiresAt: row.expires_at,
    interruptionCount: Number(row.interruption_count ?? 0),
    overrideNote: row.override_note,
    overrideAt: row.override_at,
    serverNow: row.server_now,
    serverOffsetMs: offsetFrom(row.server_now)
  }
}

/**
 * Starts the student's single attempt, or resumes the existing one. The
 * server owns the start time, deadline, and starter/draft content.
 */
export async function startAssessmentSession(assignmentId: string): Promise<AssessmentSession> {
  const { data, error } = await client().rpc('start_assessment_session', {
    target_assignment: assignmentId
  })
  if (error) throw new Error(error.message)
  const row = firstRow((data ?? []) as unknown as SessionRow[])
  if (!row) throw new Error('The assessment session could not be started.')
  const session = mapSession(row)
  const state = await fetchAssessmentExamState(session.sessionId)
  return state ? { ...session, ...state } : session
}

/** Re-reads a session, including a professor-safe view without draft content. */
export async function getAssessmentSession(sessionId: string): Promise<AssessmentSession | null> {
  const { data, error } = await client().rpc('get_assessment_session', {
    target_session: sessionId
  })
  if (error) throw new Error(error.message)
  const row = firstRow((data ?? []) as unknown as SessionRow[])
  return row ? mapSession(row) : null
}

export async function saveAssessmentDraft(input: {
  sessionId: string
  content: string
  revision: number
}): Promise<AssessmentDraftResult> {
  const { data, error } = await client().rpc('save_assessment_draft', {
    target_session: input.sessionId,
    draft_content: input.content,
    client_revision: input.revision
  })
  if (error) throw new Error(error.message)
  const row = firstRow((data ?? []) as unknown as DraftRow[])
  if (!row) throw new Error('The draft could not be saved.')
  return {
    revision: Number(row.revision ?? input.revision),
    savedAt: row.saved_at,
    expiresAt: row.expires_at,
    serverNow: row.server_now,
    serverOffsetMs: offsetFrom(row.server_now),
    status: row.status
  }
}

/**
 * Finalizes the attempt. Content sent after the deadline is accepted only
 * inside the server's short grace period; otherwise the latest saved draft is
 * auto-submitted.
 */
export async function submitAssessmentSession(
  sessionId: string,
  content: string | null
): Promise<AssessmentSubmissionResult> {
  const { data, error } = await client().rpc('submit_assessment_session', {
    target_session: sessionId,
    submitted_content: content
  })
  if (error) throw new Error(error.message)
  const row = firstRow((data ?? []) as unknown as SubmitRow[])
  if (!row) throw new Error('The assessment could not be submitted.')
  return {
    submissionId: row.submission_id,
    status: row.status,
    submittedAt: row.submitted_at
  }
}

/** Professor monitor: every session for one assessment. */
export async function fetchAssessmentSessions(
  assignmentId: string
): Promise<AssessmentSessionSummary[]> {
  const { data, error } = await client().rpc('fetch_assessment_sessions', {
    target_assignment: assignmentId
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as MonitorRow[]).map((row) => ({
    sessionId: row.session_id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email ?? '',
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at,
    lastSavedAt: row.last_saved_at,
    draftRevision: Number(row.draft_revision ?? 0),
    finalSubmissionId: row.final_submission_id,
    serverNow: row.server_now,
    serverOffsetMs: offsetFrom(row.server_now),
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
    overrideAt: row.override_at
  }))
}

/**
 * Student-side session list used by the dashboard to show resume buttons.
 * Lazy expiry runs first so a missed deadline becomes a submission even when
 * the student restarts the app on the dashboard.
 */
export async function fetchStudentAssessmentSessions(
  studentId: string
): Promise<Map<string, StudentAssessmentSessionRow>> {
  // Expire first so the rows read below already carry the final status.
  await client().rpc('expire_assessment_sessions')

  const { data, error } = await client()
    .from('assessment_sessions')
    .select(
      'id, assignment_id, status, started_at, expires_at, submitted_at, last_saved_at, draft_revision, exam_mode, allowed_tab_outs, tab_out_count, fullscreen_exit_count, blocked_paste_count, interruption_count, fullscreen_required, block_paste, run_only_terminal, override_note, override_at'
    )
    .eq('student_id', studentId)
    .order('started_at', { ascending: true })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as unknown as Array<
    Omit<StudentAssessmentSessionRow, 'server_offset_ms'>
  >

  // The table select carries no server timestamp. Reading one session gives
  // both lazy expiry and an authoritative server_now for countdown offsets.
  let offset = 0
  if (rows[0]) {
    try {
      const clock = await getAssessmentSession(rows[0].id)
      if (clock) offset = clock.serverOffsetMs
    } catch {
      // The dashboard still works with the local clock; submission itself is
      // always enforced by the server.
    }
  }

  const byAssignment = new Map<string, StudentAssessmentSessionRow>()
  for (const row of rows) {
    byAssignment.set(row.assignment_id, { ...row, server_offset_ms: offset })
  }
  return byAssignment
}
