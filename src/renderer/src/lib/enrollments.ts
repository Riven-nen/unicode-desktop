import { supabase } from './supabase'

/** Enrolls the signed-in student in the class matching a join code. */
export async function joinClassByCode(code: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const trimmed = code.trim()
  if (!trimmed) throw new Error('Enter a class join code.')

  const { data, error } = await supabase.rpc('join_class_by_code', {
    target_code: trimmed
  })
  if (error) throw new Error(error.message)
  return data as string
}
