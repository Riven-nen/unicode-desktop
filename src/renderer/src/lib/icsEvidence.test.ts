import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ICS_POLICY,
  awayPattern,
  authoredEvidence,
  evaluateEvidence,
  evidenceConfidence,
  rhythmAnomaly
} from './icsEvidence'
import type { EvidenceEditCounts, EvidenceInput } from './icsEvidence'

const baseEdits = (overrides: Partial<EvidenceEditCounts> = {}): EvidenceEditCounts => ({
  inserts: 0,
  fixes: 0,
  reworks: 0,
  revisits: 0,
  midLineResumes: 0,
  undoRedo: 0,
  pauses: 0,
  chunkBursts: 0,
  chunkChars: 0,
  deletions: 0,
  bursts: 0,
  ...overrides
})

const input = (overrides: Partial<EvidenceInput> = {}): EvidenceInput => ({
  insertedChars: 0,
  pastedChars: 0,
  edits: baseEdits(),
  returns: 0,
  immediateChunks: 0,
  intervals: [],
  similarity: 0,
  coverage: 1,
  ...overrides
})

describe('evaluateEvidence', () => {
  it('passes a normal authored session', () => {
    const result = evaluateEvidence(
      input({
        insertedChars: 320,
        edits: baseEdits({
          inserts: 300,
          fixes: 4,
          reworks: 2,
          revisits: 2,
          midLineResumes: 3,
          pauses: 10,
          chunkBursts: 1,
          chunkChars: 20,
          deletions: 6,
          bursts: 12
        })
      })
    )
    expect(result.values.authored).toBeGreaterThan(0.8)
    expect(result.score).toBeGreaterThan(80)
    expect(result.band).toBe('pass')
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it('holds a hand-copied block at review, not pass and not flag alone', () => {
    const result = evaluateEvidence(
      input({
        insertedChars: 160,
        edits: baseEdits({
          inserts: 150,
          pauses: 10,
          chunkBursts: 8,
          chunkChars: 160,
          deletions: 0,
          bursts: 10
        })
      })
    )
    expect(result.values.authored).toBe(0)
    expect(result.values.transcription).toBeGreaterThan(0.7)
    expect(result.band).toBe('review')
    expect(result.rules).toContain('transcription_pattern')
  })

  it('flags transcription when the refocus pattern corroborates it', () => {
    const result = evaluateEvidence(
      input({
        insertedChars: 160,
        edits: baseEdits({ inserts: 150, pauses: 10, chunkBursts: 8, chunkChars: 160, bursts: 10 }),
        returns: 4,
        immediateChunks: 4
      })
    )
    expect(result.values.away).toBeGreaterThanOrEqual(0.5)
    expect(result.band).toBe('flag')
    expect(result.rules).toContain('transcription_after_refocus')
  })

  it('flags a dominant novel paste', () => {
    const result = evaluateEvidence(
      input({ insertedChars: 20, pastedChars: 200, edits: baseEdits({ bursts: 2 }) })
    )
    expect(result.values.paste).toBe(1)
    expect(result.band).toBe('flag')
  })

  it('never passes a short session with little evidence', () => {
    const result = evaluateEvidence(
      input({
        insertedChars: 100,
        edits: baseEdits({ inserts: 80, fixes: 1, bursts: 2 })
      })
    )
    expect(result.confidence).toBeLessThan(0.3)
    expect(result.band).toBe('review')
    expect(result.limited).toBe(true)
  })

  it('passes a refactor with deletions and revisits', () => {
    const result = evaluateEvidence(
      input({
        insertedChars: 400,
        edits: baseEdits({
          inserts: 350,
          fixes: 8,
          reworks: 5,
          revisits: 6,
          midLineResumes: 4,
          pauses: 14,
          chunkBursts: 1,
          deletions: 30,
          bursts: 18
        })
      })
    )
    expect(result.score).toBeGreaterThan(85)
    expect(result.band).toBe('pass')
  })

  it('does not let robotic rhythm flag an otherwise authored session', () => {
    const result = evaluateEvidence(
      input({
        insertedChars: 300,
        edits: baseEdits({
          inserts: 280,
          fixes: 5,
          reworks: 1,
          revisits: 2,
          midLineResumes: 2,
          pauses: 8,
          chunkBursts: 1,
          deletions: 8,
          bursts: 12
        }),
        intervals: Array.from({ length: 200 }, () => 40)
      })
    )
    expect(result.values.rhythm).toBe(1)
    expect(result.band).not.toBe('flag')
  })

  it('does not pass a smooth copy with only typo fixes', () => {
    const result = evaluateEvidence(
      input({
        insertedChars: 379,
        edits: baseEdits({
          inserts: 360,
          fixes: 3,
          reworks: 0,
          revisits: 0,
          pauses: 4,
          bursts: 4
        })
      })
    )
    expect(result.values.authored).toBeLessThanOrEqual(0.5)
    expect(result.band).not.toBe('pass')
  })

  it('caps typo fixes so a correction-heavy copy cannot pass', () => {
    const result = evaluateEvidence(
      input({
        insertedChars: 436,
        edits: baseEdits({
          inserts: 400,
          fixes: 25,
          reworks: 0,
          revisits: 0,
          pauses: 2,
          bursts: 3
        })
      })
    )
    expect(result.values.authored).toBeLessThanOrEqual(0.5)
    expect(result.band).not.toBe('pass')
  })

  it('does not let a single revisit unlock a pass in a short session', () => {
    const result = evaluateEvidence(
      input({
        insertedChars: 197,
        edits: baseEdits({
          inserts: 190,
          fixes: 4,
          reworks: 0,
          revisits: 1,
          pauses: 5,
          bursts: 5
        })
      })
    )
    expect(result.values.authored).toBeLessThan(0.7)
    expect(result.band).toBe('review')
  })

  it('scales authored evidence down when the session is short', () => {
    const edits = baseEdits({ inserts: 100, fixes: 4, reworks: 2, revisits: 2, bursts: 6 })
    const short = evaluateEvidence(input({ insertedChars: 100, edits }))
    const long = evaluateEvidence(input({ insertedChars: 400, edits }))
    expect(short.values.authored).toBeLessThan(long.values.authored)
    expect(short.values.authored).toBeLessThanOrEqual(0.5)
  })

  it('never passes below 300 characters even with perfect authorship', () => {
    const result = evaluateEvidence(
      input({
        insertedChars: 250,
        edits: baseEdits({
          inserts: 200,
          fixes: 5,
          reworks: 3,
          revisits: 3,
          pauses: 6,
          bursts: 6
        })
      })
    )
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.band).toBe('review')
    expect(result.limited).toBe(true)
    expect(result.rules).toContain('short_submission')
  })

  it('does not raise the score when a pause is added', () => {
    const edits = baseEdits({
      inserts: 280,
      fixes: 2,
      reworks: 1,
      revisits: 1,
      chunkBursts: 2,
      chunkChars: 40,
      pauses: 3,
      bursts: 6
    })
    const before = evaluateEvidence(input({ insertedChars: 300, edits }))
    const after = evaluateEvidence(
      input({
        insertedChars: 300,
        edits: { ...edits, pauses: 4, midLineResumes: 1, bursts: 7 }
      })
    )
    expect(after.score).toBeLessThanOrEqual(before.score)
    expect(after.values.transcription).toBe(before.values.transcription)
  })

  it('respects the collaboration policy', () => {
    const result = evaluateEvidence(input({ insertedChars: 300, pastedChars: 300 }), {
      ...DEFAULT_ICS_POLICY,
      pairAllowed: true
    })
    expect(result.band).toBe('review')
    expect(result.rules).toContain('collaboration_allowed')
  })
})

describe('authoredEvidence', () => {
  it('lifts the authorship cap gradually with structural events', () => {
    const probe = (revisits: number): number =>
      authoredEvidence(baseEdits({ inserts: 150, fixes: 5, revisits }), 200)
    expect(probe(0)).toBeLessThanOrEqual(0.5)
    expect(probe(1)).toBeLessThanOrEqual(0.5)
    expect(probe(2)).toBeCloseTo(0.75, 3)
    expect(probe(3)).toBe(1)
  })

  it('never exceeds one half when the only evidence is typo fixes', () => {
    const edits = baseEdits({ inserts: 400, fixes: 5 })
    expect(authoredEvidence(edits, 400)).toBeLessThanOrEqual(0.5)
  })
})

describe('confidence and rhythm helpers', () => {
  it('scales confidence with volume and coverage', () => {
    expect(evidenceConfidence(0, baseEdits())).toBe(0)
    expect(evidenceConfidence(300, baseEdits({ inserts: 30 }))).toBe(1)
    expect(evidenceConfidence(150, baseEdits({ inserts: 15 }))).toBeCloseTo(0.25)
    expect(evidenceConfidence(100, baseEdits({ inserts: 100 }))).toBe(0)
  })

  it('caps away evidence when there are too few returns', () => {
    expect(awayPattern(0, 0)).toBe(0)
    expect(awayPattern(1, 1)).toBeCloseTo(1 / 3, 2)
    expect(awayPattern(3, 3)).toBe(1)
  })

  it('only treats very fast or impossibly regular input as robotic', () => {
    expect(rhythmAnomaly([])).toBe(0)
    expect(rhythmAnomaly(Array.from({ length: 120 }, () => 180))).toBe(1)
    expect(rhythmAnomaly(Array.from({ length: 120 }, () => 40))).toBe(1)
    expect(rhythmAnomaly(Array.from({ length: 120 }, (_, i) => 80 + (i % 7) * 90))).toBe(0)
  })
})
