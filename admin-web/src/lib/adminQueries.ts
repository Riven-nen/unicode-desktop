import { supabase } from './supabase'

export type Role = 'student' | 'professor' | 'admin'

export interface AdminProfile {
  id: string
  email: string | null
  displayName: string
  role: Role
  createdAt: string
}

export interface AdminClass {
  id: string
  name: string
  code: string
  joinCode: string
  archivedAt: string | null
  professorName: string
  professorEmail: string | null
  studentCount: number
  assignmentCount: number
}

export interface ProfessorInvite {
  id: string
  code: string
  note: string | null
  createdAt: string
  expiresAt: string
  maxUses: number
  uses: number
  revokedAt: string | null
  lastUsedAt: string | null
}

export type InviteStatus = 'active' | 'expired' | 'revoked' | 'used'

export interface CreatedProfessorInvite {
  id: string
  code: string
  expiresAt: string
  maxUses: number
}

/** Derived status for display; `now` is injected so renders stay stable. */
export function inviteStatus(invite: ProfessorInvite, now: number): InviteStatus {
  if (invite.revokedAt) return 'revoked'
  if (Date.parse(invite.expiresAt) <= now) return 'expired'
  if (invite.uses >= invite.maxUses) return 'used'
  return 'active'
}

interface ProfileRow {
  id: string
  email: string | null
  display_name: string | null
  role: string
  created_at: string
}

interface InviteRow {
  id: string
  code: string
  note: string | null
  created_at: string
  expires_at: string
  max_uses: number
  uses: number
  revoked_at: string | null
  last_used_at: string | null
}

interface ClassRow {
  id: string
  name: string
  code: string
  join_code: string
  archived_at: string | null
  professor:
    | { display_name: string | null; email: string | null }
    | Array<{ display_name: string | null; email: string | null }>
    | null
  enrollments: Array<{ count: number }> | null
  assignments: Array<{ count: number }> | null
}

function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

const firstOf = <T>(value: T | T[] | null): T | null =>
  value === null ? null : Array.isArray(value) ? (value[0] ?? null) : value

export async function fetchProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await client()
    .from('profiles')
    .select('id, email, display_name, role, created_at')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as ProfileRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name?.trim() || row.email?.split('@')[0] || 'Unnamed user',
    role: row.role === 'admin' || row.role === 'professor' ? row.role : 'student',
    createdAt: row.created_at
  }))
}

export async function fetchClasses(): Promise<AdminClass[]> {
  const { data, error } = await client()
    .from('classes')
    .select(
      `id, name, code, join_code, archived_at,
       professor:profiles!classes_professor_id_fkey ( display_name, email ),
       enrollments(count), assignments(count)`
    )
    .order('code', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as ClassRow[]).map((row) => {
    const professor = firstOf(row.professor)
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      joinCode: row.join_code,
      archivedAt: row.archived_at,
      professorName:
        professor?.display_name?.trim() || professor?.email?.split('@')[0] || 'Unassigned',
      professorEmail: professor?.email ?? null,
      studentCount: row.enrollments?.[0]?.count ?? 0,
      assignmentCount: row.assignments?.[0]?.count ?? 0
    }
  })
}

export async function setUserRole(profileId: string, role: Role): Promise<void> {
  const { error } = await client().rpc('admin_set_role', {
    target_profile: profileId,
    new_role: role
  })
  if (error) throw new Error(error.message)
}

export async function fetchProfessorInvites(): Promise<ProfessorInvite[]> {
  const { data, error } = await client()
    .from('professor_invites')
    .select('id, code, note, created_at, expires_at, max_uses, uses, revoked_at, last_used_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as InviteRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    note: row.note,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    uses: row.uses,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at
  }))
}

export async function createProfessorInvite(input: {
  lifespanHours: number
  maxUses: number
  note: string
}): Promise<CreatedProfessorInvite> {
  const { data, error } = await client().rpc('admin_create_professor_invite', {
    lifespan_hours: input.lifespanHours,
    allowed_uses: input.maxUses,
    invite_note: input.note.trim() || null
  })

  if (error) throw new Error(error.message)

  const row = (Array.isArray(data) ? data[0] : data) as unknown as
    { id: string; code: string; expires_at: string; max_uses: number } | undefined
  if (!row) throw new Error('The invite was created without a code.')

  return {
    id: row.id,
    code: row.code,
    expiresAt: row.expires_at,
    maxUses: row.max_uses
  }
}

export async function revokeProfessorInvite(inviteId: string): Promise<void> {
  const { error } = await client().rpc('admin_revoke_professor_invite', {
    target_invite: inviteId
  })
  if (error) throw new Error(error.message)
}

export interface IcsMetricValues {
  baseScore: number
  minScore: number
  maxScore: number
  authoredWeight: number
  pasteWeight: number
  transcriptionWeight: number
  rhythmWeight: number
  awayWeight: number
  similarityWeight: number
  passThreshold: number
  reviewThreshold: number
  passMinChars: number
  minConfidence: number
}

export interface IcsSettings extends IcsMetricValues {
  id: number
  version: number
  updatedAt: string
  updatedByEmail: string | null
}

export const ICS_METRIC_DEFAULTS: IcsMetricValues = {
  baseScore: 50,
  minScore: 5,
  maxScore: 95,
  authoredWeight: 45,
  pasteWeight: 0.9,
  transcriptionWeight: 0.8,
  rhythmWeight: 0.2,
  awayWeight: 0.3,
  similarityWeight: 0.5,
  passThreshold: 80,
  reviewThreshold: 40,
  passMinChars: 300,
  minConfidence: 0.3
}

interface IcsSettingsRow {
  id: number | string
  version: number | string
  base_score: number | string
  min_score: number | string
  max_score: number | string
  authored_weight: number | string
  paste_weight: number | string
  transcription_weight: number | string
  rhythm_weight: number | string
  away_weight: number | string
  similarity_weight: number | string
  pass_threshold: number | string
  review_threshold: number | string
  pass_min_chars: number | string
  min_confidence: number | string
  updated_at: string
  updated_by_email: string | null
}

const mapIcsSettings = (row: IcsSettingsRow): IcsSettings => ({
  id: Number(row.id),
  version: Number(row.version),
  baseScore: Number(row.base_score),
  minScore: Number(row.min_score),
  maxScore: Number(row.max_score),
  authoredWeight: Number(row.authored_weight),
  pasteWeight: Number(row.paste_weight),
  transcriptionWeight: Number(row.transcription_weight),
  rhythmWeight: Number(row.rhythm_weight),
  awayWeight: Number(row.away_weight),
  similarityWeight: Number(row.similarity_weight),
  passThreshold: Number(row.pass_threshold),
  reviewThreshold: Number(row.review_threshold),
  passMinChars: Number(row.pass_min_chars),
  minConfidence: Number(row.min_confidence),
  updatedAt: row.updated_at,
  updatedByEmail: row.updated_by_email
})

export async function fetchIcsSettings(): Promise<IcsSettings> {
  const { data, error } = await client().rpc('admin_fetch_ics_settings')
  if (error) throw new Error(error.message)
  const row = firstOf((data ?? []) as unknown as IcsSettingsRow[])
  if (!row) throw new Error('The ICS settings row is missing.')
  return mapIcsSettings(row)
}

export async function updateIcsSettings(values: IcsMetricValues): Promise<IcsSettings> {
  const { data, error } = await client().rpc('admin_update_ics_settings', {
    new_base_score: values.baseScore,
    new_min_score: values.minScore,
    new_max_score: values.maxScore,
    new_authored_weight: values.authoredWeight,
    new_paste_weight: values.pasteWeight,
    new_transcription_weight: values.transcriptionWeight,
    new_rhythm_weight: values.rhythmWeight,
    new_away_weight: values.awayWeight,
    new_similarity_weight: values.similarityWeight,
    new_pass_threshold: values.passThreshold,
    new_review_threshold: values.reviewThreshold,
    new_pass_min_chars: values.passMinChars,
    new_min_confidence: values.minConfidence
  })
  if (error) throw new Error(error.message)
  const row = firstOf((data ?? []) as unknown as IcsSettingsRow[])
  if (!row) throw new Error('The ICS settings update returned no row.')
  return mapIcsSettings(row)
}

export async function reapplyIcsSettings(): Promise<number> {
  const { data, error } = await client().rpc('admin_reapply_ics_settings')
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}
