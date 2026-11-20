import { supabase } from './supabase'

function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

/** Promotes the signed-in student through an admin-issued invite code. */
export async function redeemProfessorInvite(code: string): Promise<void> {
  const { error } = await client().rpc('redeem_professor_invite', {
    invite_code: code.trim()
  })
  if (error) throw new Error(error.message)
}
