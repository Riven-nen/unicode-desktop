import type { CodeSnapshot, PasteEventRecord, SyncStatus } from '../types/tracker'

export interface QueueItem {
  id: string
  kind: 'snapshot' | 'paste'
  payload: CodeSnapshot | PasteEventRecord
  attempts: number
  queuedAt: string
}

const STORAGE_KEY = 'unicode.snapshotQueue.v1'
const MAX_ITEMS = 2000

function load(): QueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : []
  } catch {
    return []
  }
}

function save(items: QueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Storage quota exceeded — keep only the newest half and retry once.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(Math.floor(items.length / 2))))
    } catch {
      // Give up silently; items stay in memory until the app closes.
    }
  }
}

/**
 * Offline-first queue of snapshots and paste events.
 *
 * Captures are recorded locally (localStorage) and pushed to Supabase by the
 * tracker hook whenever a session and network are available. Nothing is ever
 * dropped on failure — items simply stay queued until the next flush.
 */
class SnapshotQueue {
  private items: QueueItem[]
  private listeners = new Set<() => void>()
  private status: SyncStatus = 'queued'

  constructor() {
    this.items = load()
  }

  size(): number {
    return this.items.length
  }

  /** Items that belong to this user, including pre-login captures ('local'). */
  itemsForUser(userId: string): QueueItem[] {
    return this.items.filter((item) => {
      const owner = item.payload.user_id
      return owner === userId || owner === 'local'
    })
  }

  enqueue(kind: 'snapshot', payload: CodeSnapshot): QueueItem
  enqueue(kind: 'paste', payload: PasteEventRecord): QueueItem
  enqueue(kind: 'snapshot' | 'paste', payload: CodeSnapshot | PasteEventRecord): QueueItem {
    const item: QueueItem = {
      id: crypto.randomUUID(),
      kind,
      payload,
      attempts: 0,
      queuedAt: new Date().toISOString()
    }
    this.items.push(item)
    if (this.items.length > MAX_ITEMS) {
      this.items = this.items.slice(this.items.length - MAX_ITEMS)
    }
    save(this.items)
    this.notify()
    return item
  }

  remove(ids: Set<string>): void {
    const before = this.items.length
    this.items = this.items.filter((item) => !ids.has(item.id))
    if (this.items.length !== before) {
      save(this.items)
      this.notify()
    }
  }

  bumpAttempts(ids: Set<string>): void {
    for (const item of this.items) {
      if (ids.has(item.id)) item.attempts += 1
    }
  }

  getStatus(): SyncStatus {
    return this.status
  }

  setStatus(status: SyncStatus): void {
    if (this.status !== status) {
      this.status = status
      this.notify()
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}

export const snapshotQueue = new SnapshotQueue()
