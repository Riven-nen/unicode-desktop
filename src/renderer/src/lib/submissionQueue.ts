/**
 * Local queue for submissions that could not reach Supabase. Each entry keeps
 * the exact content and a client token so a retry is idempotent even if the
 * first request actually succeeded but its response was lost.
 */

export interface PendingSubmission {
  token: string
  assignmentId: string
  assignmentTitle: string
  fileName: string
  content: string
  createdAt: string
  attempts: number
  lastError: string | null
}

const STORAGE_KEY = 'unicode-lab.pendingSubmissions'
const MAX_ENTRIES = 5
const listeners = new Set<() => void>()

const storage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

const isEntry = (value: unknown): value is PendingSubmission => {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.token === 'string' &&
    typeof entry.assignmentId === 'string' &&
    typeof entry.assignmentTitle === 'string' &&
    typeof entry.fileName === 'string' &&
    typeof entry.content === 'string' &&
    typeof entry.createdAt === 'string' &&
    typeof entry.attempts === 'number'
  )
}

export function listPendingSubmissions(): PendingSubmission[] {
  const store = storage()
  if (!store) return []
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry)
  } catch {
    return []
  }
}

function persist(entries: PendingSubmission[]): boolean {
  const store = storage()
  let ok = true
  try {
    if (!store) ok = false
    else store.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    ok = false
  }
  for (const listener of listeners) listener()
  return ok
}

export function subscribePendingSubmissions(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Adds or replaces a queued submission. Returns false if storage is full. */
export function enqueueSubmission(entry: PendingSubmission): boolean {
  const entries = listPendingSubmissions().filter((existing) => existing.token !== entry.token)
  entries.unshift(entry)
  return persist(entries.slice(0, MAX_ENTRIES))
}

export function removePendingSubmission(token: string): void {
  persist(listPendingSubmissions().filter((entry) => entry.token !== token))
}

export function recordPendingFailure(token: string, message: string): void {
  persist(
    listPendingSubmissions().map((entry) =>
      entry.token === token ? { ...entry, attempts: entry.attempts + 1, lastError: message } : entry
    )
  )
}

export function pendingAssignmentIds(): Set<string> {
  return new Set(listPendingSubmissions().map((entry) => entry.assignmentId))
}

/** Heuristic for “the network is down”, not for validation failures. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch|networkerror|network error|load failed|fetch failed|timed? ?out|offline|econn|enotfound/i.test(
    message
  )
}
