import { describe, expect, it } from 'vitest'
import {
  AUTO_SNAPSHOT_DEBOUNCE_MS,
  AUTO_SNAPSHOT_MIN_INTERVAL_MS,
  autoSnapshotCooldownMs
} from './snapshotCadence'

const NOW = Date.parse('2026-11-23T10:00:00.000Z')
const at = (offsetMs: number): string => new Date(NOW - offsetMs).toISOString()

describe('autoSnapshotCooldownMs', () => {
  it('allows a snapshot when there is no prior snapshot', () => {
    expect(autoSnapshotCooldownMs(null, NOW)).toBeNull()
    expect(autoSnapshotCooldownMs(undefined, NOW)).toBeNull()
  })

  it('allows a snapshot once the minimum interval has elapsed', () => {
    expect(autoSnapshotCooldownMs(at(AUTO_SNAPSHOT_MIN_INTERVAL_MS), NOW)).toBeNull()
    expect(autoSnapshotCooldownMs(at(AUTO_SNAPSHOT_MIN_INTERVAL_MS + 5_000), NOW)).toBeNull()
  })

  it('waits out the remainder of the cooldown plus the debounce', () => {
    expect(autoSnapshotCooldownMs(at(10_000), NOW)).toBe(
      AUTO_SNAPSHOT_MIN_INTERVAL_MS - 10_000 + AUTO_SNAPSHOT_DEBOUNCE_MS
    )
    expect(autoSnapshotCooldownMs(at(0), NOW)).toBe(
      AUTO_SNAPSHOT_MIN_INTERVAL_MS + AUTO_SNAPSHOT_DEBOUNCE_MS
    )
  })

  it('treats an invalid timestamp as ready instead of stalling capture', () => {
    expect(autoSnapshotCooldownMs('not-a-date', NOW)).toBeNull()
  })
})
