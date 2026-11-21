import type { IcsBand, IcsScoreRow } from '../types/professor'

/** Maximum points each weighted term can contribute to the 0-100 ICS. */
export const TERM_META = [
  { key: 'paste', label: 'Paste', weight: 0.35, max: 35 },
  // The stored key stays `cadence` for database/API compatibility; the input
  // is now authorship evidence (see lib/authorship.ts).
  { key: 'cadence', label: 'Authorship', weight: 0.25, max: 25 },
  { key: 'focus', label: 'Focus', weight: 0.2, max: 20 },
  { key: 'compilation', label: 'Compilation', weight: 0.2, max: 20 }
] as const

export interface DerivedIcsInputs {
  /** P: pasted chars / inserted chars, 0..1 */
  pasteRatio: number
  /** A: authorship evidence, 0..100 */
  authorship: number
  /** F: focus retention, 0..100 */
  focus: number
  /** K: compilation profile, 0..100 */
  compilation: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * The database stores weighted contributions (e.g. 31.5 of 35 for paste), so
 * the raw inputs are recovered by inverting each weight. This keeps the UI
 * honest about the numbers behind the bars.
 */
export function deriveRawInputs(score: IcsScoreRow): DerivedIcsInputs {
  return {
    pasteRatio: clamp(1 - score.pasteTerm / 35, 0, 1),
    authorship: clamp(score.cadenceTerm / 0.25, 0, 100),
    focus: clamp(score.focusTerm / 0.2, 0, 100),
    compilation: clamp(score.compilationTerm / 0.2, 0, 100)
  }
}

export function termValue(score: IcsScoreRow, key: (typeof TERM_META)[number]['key']): number {
  if (key === 'paste') return score.pasteTerm
  if (key === 'cadence') return score.cadenceTerm
  if (key === 'focus') return score.focusTerm
  return score.compilationTerm
}

export interface IcsBreakdown {
  pasteTerm: number
  cadenceTerm: number
  focusTerm: number
  compilationTerm: number
  ics: number
  band: IcsBand
}

/**
 * Weighted score for the student-facing demo. Mirrors the database formula:
 * paste 35, authorship 25, focus 20, compilation 20. Inputs are clamped so
 * the gauge can never leave 0-100.
 */
export function computeIcs(inputs: DerivedIcsInputs): IcsBreakdown {
  const pasteTerm = 35 * (1 - clamp(inputs.pasteRatio, 0, 1))
  const cadenceTerm = 25 * (clamp(inputs.authorship, 0, 100) / 100)
  const focusTerm = 20 * (clamp(inputs.focus, 0, 100) / 100)
  const compilationTerm = 20 * (clamp(inputs.compilation, 0, 100) / 100)
  const ics = pasteTerm + cadenceTerm + focusTerm + compilationTerm
  return {
    pasteTerm,
    cadenceTerm,
    focusTerm,
    compilationTerm,
    ics,
    band: bandForScore(ics)
  }
}

/** A short, plain-language explanation of what dragged the score down. */
export function describeIcs(score: IcsScoreRow): string {
  const raw = deriveRawInputs(score)
  const weakest = TERM_META.map((term) => ({
    key: term.key,
    ratio: termValue(score, term.key) / term.max
  })).sort((a, b) => a.ratio - b.ratio)[0]

  const prefix =
    score.band === 'pass'
      ? 'Strong submission.'
      : score.band === 'review'
        ? 'Mixed signals.'
        : 'Integrity concern.'

  if (weakest.key === 'paste') {
    return `${prefix} Paste is the weakest term: about ${Math.round(raw.pasteRatio * 100)}% of inserted characters came from clipboard events.`
  }
  if (weakest.key === 'cadence') {
    return `${prefix} Authorship evidence is the weakest term (${Math.round(raw.authorship)}/100).`
  }
  if (weakest.key === 'focus') {
    return `${prefix} Focus retention is the weakest term (${Math.round(raw.focus)}/100).`
  }
  return `${prefix} Compilation success is the weakest term (${Math.round(raw.compilation)}/100).`
}

export function bandForScore(score: number): IcsBand {
  if (score >= 80) return 'pass'
  if (score >= 60) return 'review'
  return 'flag'
}
