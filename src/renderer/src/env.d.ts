/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Optional Judge0 endpoint, e.g. http://localhost:2358 (professor test runner). */
  readonly VITE_JUDGE0_URL?: string
  /** Optional Judge0 auth token for self-hosted instances. */
  readonly VITE_JUDGE0_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
