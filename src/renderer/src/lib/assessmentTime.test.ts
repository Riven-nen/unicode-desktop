import { describe, expect, it } from 'vitest'
import { assessmentAvailability, assessmentRemainingMs, formatCountdown } from './assessmentTime'

const NOW = Date.parse('2026-11-23T10:00:00.000Z')

describe('formatCountdown', () => {
  it('formats minutes and seconds under an hour', () => {
    expect(formatCountdown(65_000)).toBe('01:05')
    expect(formatCountdown(500)).toBe('00:01')
  })

  it('formats hours when needed', () => {
    expect(formatCountdown(3_665_000)).toBe('1:01:05')
  })

  it('clamps a finished countdown to zero', () => {
    expect(formatCountdown(-1_000)).toBe('00:00')
  })
})

describe('assessmentAvailability', () => {
  it('is upcoming before the open time', () => {
    expect(
      assessmentAvailability({ opensAt: '2026-11-23T10:05:00.000Z', closesAt: null }, NOW)
    ).toBe('upcoming')
  })

  it('is open inside the window', () => {
    expect(
      assessmentAvailability(
        { opensAt: '2026-11-23T09:00:00.000Z', closesAt: '2026-11-23T11:00:00.000Z' },
        NOW
      )
    ).toBe('open')
  })

  it('is closed after the close time', () => {
    expect(
      assessmentAvailability(
        { opensAt: '2026-11-23T08:00:00.000Z', closesAt: '2026-11-23T09:00:00.000Z' },
        NOW
      )
    ).toBe('closed')
  })
})

describe('assessmentRemainingMs', () => {
  it('corrects the deadline by the server clock offset', () => {
    expect(
      assessmentRemainingMs({ expiresAt: '2026-11-23T10:00:10.000Z', serverOffsetMs: 5_000 }, NOW)
    ).toBe(5_000)
  })

  it('returns null without an expiry', () => {
    expect(assessmentRemainingMs(null, NOW)).toBeNull()
  })
})
