import { supabase } from './supabase'

function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export interface ExamTemplate {
  id: string
  name: string
  durationMinutes: number
  allowedTabOuts: number
  fullscreenRequired: boolean
  blockPaste: boolean
  runOnlyTerminal: boolean
  autoSubmit: boolean
  showTimer: boolean
}

interface TemplateRow {
  id: string
  name: string
  duration_minutes: number
  allowed_tab_outs: number
  fullscreen_required: boolean
  block_paste: boolean
  run_only_terminal: boolean
  auto_submit: boolean
  show_timer: boolean
}

const mapTemplate = (row: TemplateRow): ExamTemplate => ({
  id: row.id,
  name: row.name,
  durationMinutes: Number(row.duration_minutes),
  allowedTabOuts: Number(row.allowed_tab_outs),
  fullscreenRequired: row.fullscreen_required,
  blockPaste: row.block_paste,
  runOnlyTerminal: row.run_only_terminal,
  autoSubmit: row.auto_submit,
  showTimer: row.show_timer
})

export async function fetchExamTemplates(): Promise<ExamTemplate[]> {
  const { data, error } = await client()
    .from('exam_templates')
    .select(
      'id, name, duration_minutes, allowed_tab_outs, fullscreen_required, block_paste, run_only_terminal, auto_submit, show_timer'
    )
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as TemplateRow[]).map(mapTemplate)
}

export async function createExamTemplate(
  input: Omit<ExamTemplate, 'id'> & { professorId: string }
): Promise<void> {
  const { error } = await client().from('exam_templates').insert({
    professor_id: input.professorId,
    name: input.name.trim(),
    duration_minutes: input.durationMinutes,
    allowed_tab_outs: input.allowedTabOuts,
    fullscreen_required: input.fullscreenRequired,
    block_paste: input.blockPaste,
    run_only_terminal: input.runOnlyTerminal,
    auto_submit: input.autoSubmit,
    show_timer: input.showTimer
  })
  if (error) throw new Error(error.message)
}

export async function deleteExamTemplate(id: string): Promise<void> {
  const { error } = await client().from('exam_templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function applyExamPolicyToClass(input: {
  classId: string
  allowedTabOuts: number
  fullscreenRequired: boolean
  blockPaste: boolean
  runOnlyTerminal: boolean
}): Promise<number> {
  const { data, error } = await client().rpc('apply_exam_policy_to_class', {
    target_class: input.classId,
    policy_allowed_tab_outs: input.allowedTabOuts,
    policy_fullscreen: input.fullscreenRequired,
    policy_block_paste: input.blockPaste,
    policy_run_only: input.runOnlyTerminal
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

export interface ClassExamOverviewRow {
  assignmentId: string
  title: string
  sessions: number
  active: number
  submitted: number
  autoSubmitted: number
  interruptions: number
  blockedPastes: number
  overrides: number
}

interface ClassOverviewRow {
  assignment_id: string
  title: string
  sessions: number | string
  active: number | string
  submitted: number | string
  auto_submitted: number | string
  interruptions: number | string
  blocked_pastes: number | string
  overrides: number | string
}

export async function fetchClassExamOverview(classId: string): Promise<ClassExamOverviewRow[]> {
  const { data, error } = await client().rpc('fetch_class_exam_overview', {
    target_class: classId
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as ClassOverviewRow[]).map((row) => ({
    assignmentId: row.assignment_id,
    title: row.title,
    sessions: Number(row.sessions),
    active: Number(row.active),
    submitted: Number(row.submitted),
    autoSubmitted: Number(row.auto_submitted),
    interruptions: Number(row.interruptions),
    blockedPastes: Number(row.blocked_pastes),
    overrides: Number(row.overrides)
  }))
}
