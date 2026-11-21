/**
 * ICS v3 evidence ledger.
 *
 * The score is not a sum of positive-looking terms. It starts at 50 and moves
 * only when there is evidence: authored behaviour pushes it up, paste,
 * transcription shape, robotic rhythm, and away/resume patterns push it down.
 * Confidence gates the band instead of moving the score.
 *
 * Mirrored by `recompute_ics` in
 * `supabase/migrations/20261122120000_ics_evidence.sql`.
 */

import type { IcsBand } from '../types/professor'

export const EVIDENCE_WEIGHTS = {
  authored: 45,
  paste: 40.5,
  transcription: 36,
  rhythm: 9,
  away: 13.5,
  similarity: 22.5
} as const

export const MIN_CONFIDENCE = 0.3
export const CONFIDENCE_CHARS = 300
export const CONFIDENCE_EDITS = 30
/** A pass cannot be issued below this many inserted characters. */
export const PASS_MIN_CHARS = 300
export const PASTE_SATURATION = 0.6
export const TRANSCRIPTION_MIN_CHARS = 120
/** Below this many characters, authored evidence is scaled down linearly. */
export const AUTHORED_VOLUME_CHARS = 200
/** Structural events needed before the authorship cap is fully lifted. */
export const AUTHORED_STRUCTURAL_EVENTS = 3

export interface EvidenceEditCounts {
  /** Content-change events that inserted typing (pastes excluded). */
  inserts: number
  /** Small corrections (1–3 characters). */
  fixes: number
  /** Rewrites of 4–30 characters. */
  reworks: number
  /** Edits above the highest line reached so far. */
  revisits: number
  /** Pauses resumed inside a line. */
  midLineResumes: number
  undoRedo: number
  pauses: number
  /** Pauses followed by a complete, uncorrected line. */
  chunkBursts: number
  /** Characters produced by chunk bursts. */
  chunkChars: number
  /** Small deletions, excluding bulk clears. */
  deletions: number
  bursts: number
}

export interface EvidenceInput {
  insertedChars: number
  pastedChars: number
  edits: EvidenceEditCounts
  /** Window refocus count. */
  returns?: number
  /** Refocus → first burst is a line chunk. */
  immediateChunks?: number
  /** Typed intervals in ms, used only for the automation check. */
  intervals?: number[]
  /** 0..1 token similarity to another submission. */
  similarity?: number
  /** 0..1 data-coverage factor. */
  coverage?: number
}

export interface IcsPolicy {
  pasteAllowance: number
  pairAllowed: boolean
  minConfidence: number
}

export const DEFAULT_ICS_POLICY: IcsPolicy = {
  pasteAllowance: 0.1,
  pairAllowed: false,
  minConfidence: MIN_CONFIDENCE
}

export interface EvidenceValues {
  authored: number
  paste: number
  transcription: number
  rhythm: number
  away: number
  similarity: number
}

export interface EvidenceResult {
  score: number
  band: IcsBand
  confidence: number
  values: EvidenceValues
  /** Signed points each signal added or removed. */
  contributions: EvidenceValues
  eMinus: number
  reason: string
  /** True when the band was gated by low evidence volume. */
  limited: boolean
  /** Rules that forced the band, for the review panel. */
  rules: string[]
}

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value))

export function authoredEvidence(edits: EvidenceEditCounts, insertedChars: number): number {
  const weighted =
    0.5 * Math.min(edits.fixes, 5) +
    1.5 * edits.reworks +
    1.5 * edits.revisits +
    1.0 * edits.undoRedo
  const rate = (100 * weighted) / Math.max(insertedChars, 1)
  const scored = clamp(rate / 2.5)
  // Going back to an earlier line is cheap to perform and common in ordinary
  // work, so it is not, on its own, proof of authorship. One structural event
  // cannot lift the cap at all; two earn three quarters of it, and three
  // independent events (rework, revisit, undo) earn full credit.
  const structural = edits.reworks + edits.revisits + edits.undoRedo
  const structuralCap = 0.5 + 0.5 * clamp((structural - 1) / (AUTHORED_STRUCTURAL_EVENTS - 1))
  // Short sessions cannot reach full credit however busy they look. A 120-char
  // snippet can be reviewed, not passed, which keeps the pass band meaningful.
  const volume = clamp(insertedChars / AUTHORED_VOLUME_CHARS)
  return Math.min(scored, structuralCap) * volume
}

export function pastePressure(input: EvidenceInput, policy: IcsPolicy): number {
  if (policy.pairAllowed) return 0
  const denominator = Math.max(input.insertedChars + input.pastedChars, 1)
  const ratio = input.pastedChars / denominator
  const allowance = clamp(policy.pasteAllowance, 0, 0.5)
  return clamp((ratio - allowance) / Math.max(PASTE_SATURATION - allowance, 0.01))
}

export function transcriptionShape(edits: EvidenceEditCounts, insertedChars: number): number {
  if (insertedChars < TRANSCRIPTION_MIN_CHARS) return 0
  // Character-weighted so a stall that ends a burst cannot dilute the ratio.
  const chunkRatio = edits.chunkChars / Math.max(insertedChars, 1)
  const appendOnly = clamp(1 - (edits.reworks + edits.undoRedo) / (0.05 * insertedChars + 1))
  // Append-only only amplifies a line-chunk pattern; on its own it is not
  // evidence of transcription (a student can type continuously without typos).
  return clamp(chunkRatio * (0.7 + 0.3 * appendOnly))
}

/** Automation only: very fast or impossibly regular input. Never a flag alone. */
export function rhythmAnomaly(intervals: number[] | undefined): number {
  if (!intervals || intervals.length < 100) return 0
  const sorted = [...intervals].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const mean = sorted.reduce((total, value) => total + value, 0) / sorted.length
  if (mean <= 0) return 0
  const variance = sorted.reduce((total, value) => total + (value - mean) ** 2, 0) / sorted.length
  const cv = Math.sqrt(variance) / mean
  return median < 25 || cv < 0.05 ? 1 : 0
}

export function awayPattern(returns = 0, immediateChunks = 0): number {
  if (returns < 1) return 0
  return clamp((immediateChunks / returns) * Math.min(1, returns / 3))
}

export function evidenceConfidence(
  insertedChars: number,
  edits: EvidenceEditCounts,
  coverage = 1
): number {
  if (insertedChars < 120) return 0
  const operations = edits.inserts + edits.fixes + edits.reworks
  return (
    clamp(insertedChars / CONFIDENCE_CHARS) * clamp(operations / CONFIDENCE_EDITS) * clamp(coverage)
  )
}

export function evaluateEvidence(
  input: EvidenceInput,
  policy: IcsPolicy = DEFAULT_ICS_POLICY
): EvidenceResult {
  if (policy.pairAllowed) {
    return {
      score: 50,
      band: 'review',
      confidence: 1,
      values: { authored: 0.5, paste: 0, transcription: 0, rhythm: 0, away: 0, similarity: 0 },
      contributions: {
        authored: 0,
        paste: 0,
        transcription: 0,
        rhythm: 0,
        away: 0,
        similarity: 0
      },
      eMinus: 0,
      reason: 'Collaboration is allowed for this assignment; authorship is not scored.',
      limited: false,
      rules: ['collaboration_allowed']
    }
  }

  const similarity = input.similarity ?? 0
  const values: EvidenceValues = {
    authored: authoredEvidence(input.edits, input.insertedChars),
    paste: pastePressure(input, policy),
    transcription: transcriptionShape(input.edits, input.insertedChars),
    rhythm: rhythmAnomaly(input.intervals),
    away: awayPattern(input.returns, input.immediateChunks),
    similarity: clamp((similarity - 0.75) / 0.25)
  }

  const eMinus = clamp(
    0.9 * values.paste +
      0.8 * values.transcription +
      0.2 * values.rhythm +
      0.3 * values.away +
      0.5 * values.similarity
  )
  const score =
    Math.round(
      Math.min(95, Math.max(5, 50 + EVIDENCE_WEIGHTS.authored * values.authored - 45 * eMinus)) * 10
    ) / 10
  const confidence = evidenceConfidence(input.insertedChars, input.edits, input.coverage ?? 1)

  const rules: string[] = []
  let reviewFloor = false
  let flagRule = false
  if (values.paste >= 0.8 && values.authored <= 0.2) {
    reviewFloor = true
    rules.push('novel_paste_without_authorship')
    if (values.paste >= 0.99 && values.authored <= 0.01) {
      flagRule = true
      rules.push('novel_paste_dominant')
    }
  }
  if (
    values.transcription >= 0.7 &&
    values.authored <= 0.15 &&
    input.insertedChars >= TRANSCRIPTION_MIN_CHARS
  ) {
    reviewFloor = true
    rules.push('transcription_pattern')
    if (values.away >= 0.5) {
      flagRule = true
      rules.push('transcription_after_refocus')
    }
  }
  if (values.similarity >= 0.9 && values.paste >= 0.5) {
    flagRule = true
    rules.push('similar_submission_and_paste')
  }

  let band: IcsBand
  let reason: string
  let limited = false
  if (flagRule) {
    band = 'flag'
    reason =
      values.transcription >= 0.7
        ? 'Line-chunk transcription with corroborating away/resume evidence.'
        : values.paste >= 0.99
          ? 'Nearly all inserted text came from novel paste.'
          : 'Paste and cross-submission similarity agree.'
  } else if (reviewFloor) {
    band = 'review'
    reason =
      values.paste >= 0.8
        ? 'Novel paste exceeds the allowance without authored evidence.'
        : 'Line-chunk transcription pattern without corroboration.'
  } else if (confidence < policy.minConfidence) {
    band = 'review'
    limited = true
    reason = `Limited evidence: ${input.insertedChars} chars and ${input.edits.bursts} bursts.`
  } else if (score >= 80 && input.insertedChars < PASS_MIN_CHARS) {
    // Volume alone should not turn a good-looking short session into a pass.
    band = 'review'
    limited = true
    rules.push('short_submission')
    reason = `Short submission: ${input.insertedChars} chars; a pass needs ${PASS_MIN_CHARS}.`
  } else if (score >= 80) {
    band = 'pass'
    reason = 'Authored evidence outweighs the negative signals.'
  } else if (score >= 40) {
    band = 'review'
    reason = 'Mixed evidence; review recommended.'
  } else {
    band = 'flag'
    reason = 'Negative evidence outweighs authored evidence.'
  }

  const contributions: EvidenceValues = {
    authored: EVIDENCE_WEIGHTS.authored * values.authored,
    paste: -EVIDENCE_WEIGHTS.paste * values.paste,
    transcription: -EVIDENCE_WEIGHTS.transcription * values.transcription,
    rhythm: -EVIDENCE_WEIGHTS.rhythm * values.rhythm,
    away: -EVIDENCE_WEIGHTS.away * values.away,
    similarity: -EVIDENCE_WEIGHTS.similarity * values.similarity
  }

  return { score, band, confidence, values, contributions, eMinus, reason, limited, rules }
}

export interface DemoKeystroke {
  /** Milliseconds since the first logged event. */
  t: number
  kind:
    | 'insert'
    | 'delete'
    | 'replace'
    | 'undo'
    | 'redo'
    | 'paste'
    | 'copy'
    | 'cut'
    | 'keydown'
    | 'keyup'
    | 'cursor'
    | 'focus'
    | 'blur'
  /** Inserted text, truncated. Empty for pure deletions. */
  text?: string
  /** Deleted text recovered from the previous document, truncated. */
  del?: string
  /** Characters deleted by this event. */
  d?: number
  /** Start line (1-based). */
  l?: number
  /** Start column (1-based). */
  c?: number
  /** Leading whitespace on the start line. */
  i?: number
  /** First edit after the window regained focus. */
  r?: boolean
  /** Raw key for keydown/keyup events. */
  key?: string
  code?: string
  mods?: string
  /** Selection length for cursor events. */
  sel?: number
}

export interface TimelinePoint {
  /** Milliseconds since recording started. */
  t: number
  score: number
  band: IcsBand
  confidence: number
  values: EvidenceValues
  counts: {
    insertedChars: number
    pastedChars: number
    fixes: number
    reworks: number
    revisits: number
    pauses: number
    chunkBursts: number
    chunkChars: number
    bursts: number
    returns: number
    immediateChunks: number
  }
}

export interface TrackedRun {
  id: string
  scenario: string
  at: string
  language: string
  score: number
  band: IcsBand
  confidence: number
  reason: string
  values: EvidenceValues
  counts: {
    insertedChars: number
    pastedChars: number
    fixes: number
    reworks: number
    revisits: number
    pauses: number
    chunkBursts: number
    chunkChars: number
    bursts: number
    returns: number
    immediateChunks: number
  }
  /** Compact change log for inspecting why a run scored the way it did. */
  keylog?: DemoKeystroke[]
  /** Score and evidence samples over the recording. */
  timeline?: TimelinePoint[]
  startedAt?: string
  durationMs?: number
}
