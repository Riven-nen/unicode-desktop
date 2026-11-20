import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueSubmission,
  isNetworkError,
  listPendingSubmissions,
  pendingAssignmentIds,
  recordPendingFailure,
  removePendingSubmission,
  subscribePendingSubmissions
} from './submissionQueue'
import type { PendingSubmission } from './submissionQueue'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  clear(): void {
    this.data.clear()
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

const entry = (overrides: Partial<PendingSubmission>): PendingSubmission => ({
  token: 'token-1',
  assignmentId: 'assignment-1',
  assignmentTitle: 'Fibonacci',
  fileName: 'CS101/fibonacci.py',
  content: 'print(1)',
  createdAt: '2026-11-19T00:00:00Z',
  attempts: 1,
  lastError: null,
  ...overrides
})

beforeEach((): void => {
  globalThis.localStorage = new MemoryStorage()
})

describe('submission queue', (): void => {
  it('stores entries newest-first and deduplicates by token', (): void => {
    enqueueSubmission(entry({ token: 'one' }))
    enqueueSubmission(entry({ token: 'two' }))
    enqueueSubmission(entry({ token: 'one', content: 'print(2)' }))

    const items = listPendingSubmissions()
    expect(items).toHaveLength(2)
    expect(items[0].token).toBe('one')
    expect(items[0].content).toBe('print(2)')
    expect(pendingAssignmentIds().has('assignment-1')).toBe(true)
  })

  it('caps the queue at five submissions', (): void => {
    for (let index = 0; index < 7; index += 1) {
      enqueueSubmission(entry({ token: `token-${index}` }))
    }
    expect(listPendingSubmissions()).toHaveLength(5)
  })

  it('removes entries and records failed attempts', (): void => {
    enqueueSubmission(entry({ token: 'keep' }))
    enqueueSubmission(entry({ token: 'drop' }))
    removePendingSubmission('drop')
    recordPendingFailure('keep', 'Still offline')

    const items = listPendingSubmissions()
    expect(items).toHaveLength(1)
    expect(items[0].attempts).toBe(2)
    expect(items[0].lastError).toBe('Still offline')
  })

  it('notifies subscribers when the queue changes', (): void => {
    const listener = vi.fn()
    const unsubscribe = subscribePendingSubmissions(listener)
    enqueueSubmission(entry({}))
    removePendingSubmission('token-1')
    unsubscribe()

    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('isNetworkError', (): void => {
  it('recognises offline and fetch errors', (): void => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('NetworkError when attempting to fetch'))).toBe(true)
    expect(isNetworkError(new Error('The operation timed out'))).toBe(true)
  })

  it('does not treat validation errors as offline', (): void => {
    expect(isNetworkError(new Error('Submit the assignment file "fibonacci.py".'))).toBe(false)
    expect(isNetworkError(new Error('You are not enrolled in this class.'))).toBe(false)
  })
})
