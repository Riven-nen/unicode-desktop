import { describe, expect, it } from 'vitest'
import { countNewer } from './notifications'

const items = [
  { createdAt: '2026-11-14T10:00:00Z' },
  { createdAt: '2026-11-15T10:00:00Z' },
  { createdAt: 'not-a-date' }
]

describe('countNewer', (): void => {
  it('counts only items created after the seen timestamp', (): void => {
    expect(countNewer(items, Date.parse('2026-11-14T12:00:00Z'))).toBe(1)
  })

  it('treats an unset timestamp as everything being new', (): void => {
    expect(countNewer(items, 0)).toBe(3)
    expect(countNewer(items, Number.NaN)).toBe(3)
  })

  it('ignores malformed timestamps and returns zero for older seen marks', (): void => {
    expect(countNewer(items, Date.parse('2026-11-20T00:00:00Z'))).toBe(0)
    expect(countNewer([{ createdAt: 'nope' }], 1)).toBe(0)
  })
})
