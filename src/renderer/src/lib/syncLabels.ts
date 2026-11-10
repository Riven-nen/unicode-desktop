import type { SyncStatus } from '../types/tracker'

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  'local-only': 'Local only',
  'signed-out': 'Sign in to sync',
  queued: 'Queued',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline',
  error: 'Retry pending'
}

export const SYNC_STATUS_HINTS: Record<SyncStatus, string> = {
  'local-only': 'Supabase is not configured — history stays on this device. See .env.example',
  'signed-out': 'Sign in to sync your history to the lab dashboard',
  queued: 'Waiting to sync — click to retry now',
  syncing: 'Uploading snapshots to Supabase…',
  synced: 'All snapshots are saved to Supabase',
  offline: 'No network connection — items stay queued until you are back online',
  error: 'Sync failed — will retry automatically. Click to retry now'
}
