import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Placeholder values from .env.example are treated as "not configured"
// so the app can run in local-only mode before Supabase is set up.
export const supabase: SupabaseClient | null =
  url && anonKey && !url.includes('YOUR_') && !anonKey.includes('YOUR_')
    ? createClient(url, anonKey)
    : null

export const isSupabaseConfigured = supabase !== null
