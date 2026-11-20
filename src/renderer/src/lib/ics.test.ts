import { describe, expect, it } from 'vitest'
import { bandForScore, computeIcs, deriveRawInputs, describeIcs, termValue } from './ics'
import type { IcsScoreRow } from '../types/professor'

const perfect: IcsScoreRow = {
  submissionId: 'sub-1',
  pasteTerm: 35,
  cadenceTerm: 25,
  focusTerm: 20,
  compilationTerm: 20,
  ics: 100,
  band: 'pass',
  computedAt: '2026-11-14T00:00:00Z'
}

describe('deriveRawInputs', (): void => {
  it('inverts the weighted terms back to 0-100 inputs', (): void => {
    expect(deriveRawInputs(perfect)).toEqual({
      pasteRatio: 0,
      cadence: 100,
      focus: 100,
      compilation: 100
    })
  })

  it('clamps out-of-range stored values', (): void => {
    const score: IcsScoreRow = {
      ...perfect,
      pasteTerm: -10,
      cadenceTerm: 40,
      focusTerm: -5,
      compilationTerm: 0
    }
    const raw = deriveRawInputs(score)
    expect(raw.pasteRatio).toBe(1)
    expect(raw.cadence).toBe(100)
    expect(raw.focus).toBe(0)
    expect(raw.compilation).toBe(0)
  })
})

describe('termValue', (): void => {
  it('returns the matching weighted term', (): void => {
    expect(termValue(perfect, 'paste')).toBe(35)
    expect(termValue(perfect, 'cadence')).toBe(25)
    expect(termValue(perfect, 'focus')).toBe(20)
    expect(termValue(perfect, 'compilation')).toBe(20)
  })
})

describe('bandForScore', (): void => {
  it('uses the 80 / 60 thresholds', (): void => {
    expect(bandForScore(100)).toBe('pass')
    expect(bandForScore(80)).toBe('pass')
    expect(bandForScore(79.9)).toBe('review')
    expect(bandForScore(60)).toBe('review')
    expect(bandForScore(59.9)).toBe('flag')
  })
})

describe('computeIcs', (): void => {
  it('awards full points for a clean session', (): void => {
    const breakdown = computeIcs({ pasteRatio: 0, cadence: 100, focus: 100, compilation: 100 })
    expect(breakdown.pasteTerm).toBe(35)
    expect(breakdown.ics).toBe(100)
    expect(breakdown.band).toBe('pass')
  })

  it('weights each term and clamps out-of-range inputs', (): void => {
    const breakdown = computeIcs({ pasteRatio: 2, cadence: 50, focus: -10, compilation: 80 })
    expect(breakdown.pasteTerm).toBe(0)
    expect(breakdown.cadenceTerm).toBeCloseTo(12.5)
    expect(breakdown.focusTerm).toBe(0)
    expect(breakdown.compilationTerm).toBeCloseTo(16)
    expect(breakdown.ics).toBeCloseTo(28.5)
    expect(breakdown.band).toBe('flag')
  })
})

describe('describeIcs', (): void => {
  it('prefixes the explanation with the band', (): void => {
    expect(describeIcs(perfect).startsWith('Strong submission.')).toBe(true)
    expect(describeIcs({ ...perfect, band: 'review', ics: 70 }).startsWith('Mixed signals.')).toBe(
      true
    )
    expect(
      describeIcs({ ...perfect, band: 'flag', ics: 20 }).startsWith('Integrity concern.')
    ).toBe(true)
  })
})
