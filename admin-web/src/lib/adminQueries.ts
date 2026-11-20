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
