import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// Accept both key spellings: current Supabase projects expose a
// "publishable" key (sb_publishable_…), older ones a legacy "anon" key.
// Both are safe to ship in the renderer — every table is protected by
// row-level security (see supabase/schema.sql).
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

// Placeholder values from .env.example are treated as "not configured"
// so the app can run in local-only mode before Supabase is set up.
export const supabase: SupabaseClient | null =
  url && publishableKey && !url.includes('YOUR_') && !publishableKey.includes('YOUR_')
    ? createClient(url, publishableKey)
    : null

export const isSupabaseConfigured = supabase !== null
