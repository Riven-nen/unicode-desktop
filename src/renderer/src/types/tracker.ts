// Shared types for the Time-Travel Diff & Paste Tracker feature.
// These mirror the tables defined in supabase/schema.sql.

export type SnapshotType = 'auto' | 'paste' | 'manual' | 'restore'

export type PasteMode = 'single-line' | 'multi-line'

export type DetectionSource = 'onDidPaste' | 'velocity'

export type SyncStatus =
  | 'local-only' // Supabase not configured in .env
  | 'signed-out' // configured, but the student is not signed in
  | 'queued' // items waiting to be sent
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'

export interface CodeSnapshot {
  id: string
  user_id: string
  lab_id: string | null
  file_name: string
  content: string
  snapshot_type: SnapshotType
  version: number
  char_count: number
  line_count: number
  language: string | null
  created_at: string
}

export interface PasteEventRecord {
  id: string
  snapshot_id: string | null
  user_id: string
  lab_id: string | null
  file_name: string
  pasted_text: string
  pasted_chars: number
  paste_mode: PasteMode
  detected_via: DetectionSource
  created_at: string
}

export interface LabFile {
  name: string
  language: string
  initialContent: string
}
