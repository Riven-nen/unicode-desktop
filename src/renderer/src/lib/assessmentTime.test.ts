import { describe, expect, it } from 'vitest'
import {
  assessmentAvailability,
  assessmentRemainingMs,
  formatCountdown,
  liveWindowError,
  timingSummary
} from './assessmentTime'

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

describe('timingSummary', () => {
  it('shows the effective short window instead of the configured duration', () => {
    const summary = timingSummary({
      timingMode: 'live_window',
      durationMinutes: 60,
      opensAt: '2026-11-23T10:00:00.000Z',
      closesAt: '2026-11-23T10:02:00.000Z'
    })
    expect(summary).toMatch(/^Shared 2 min window /)
    expect(summary).toContain('→')
  })

  it('shows the configured duration when the close time allows it', () => {
    const summary = timingSummary({
      timingMode: 'live_window',
      durationMinutes: 60,
      opensAt: '2026-11-23T10:00:00.000Z',
      closesAt: '2026-11-23T11:00:00.000Z'
    })
    expect(summary).toMatch(/^Shared 60 min window /)
  })

  it('keeps the take-home wording for duration mode', () => {
    expect(
      timingSummary({
        timingMode: 'duration',
        durationMinutes: 60,
        opensAt: null,
        closesAt: null
      })
    ).toBe('60 min · starts when you open it')
  })
})

describe('liveWindowError', () => {
  it('rejects a close time that truncates the configured duration', () => {
    expect(liveWindowError(60, '2026-11-23T15:00', '2026-11-23T15:02')).toContain(
      'cuts the 60-minute window to 2 minutes'
    )
  })

  it('allows a close time that covers the full duration', () => {
    expect(liveWindowError(60, '2026-11-23T15:00', '2026-11-23T16:00')).toBeNull()
  })

  it('rejects a close time before the open time', () => {
    expect(liveWindowError(60, '2026-11-23T15:00', '2026-11-23T14:00')).toBe(
      'The closing time must be after the opening time.'
    )
  })

  it('allows missing times so the required-field check owns that case', () => {
    expect(liveWindowError(60, null, '2026-11-23T15:00')).toBeNull()
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
