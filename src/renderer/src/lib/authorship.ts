/**
 * Authorship evidence for the ICS.
 *
 * A pause on its own is never evidence: people stop to think. What carries
 * information is what happens when typing resumes — did the student correct
 * something, go back to an earlier line, or paste a complete line in one
 * uninterrupted burst? Duration is only used to split bursts, never scored.
 *
 * The same constants are mirrored in `supabase/migrations/*_ics_authorship.sql`
 * and must stay in sync.
 */

/** Gap between edits that ends one burst and starts the next. */
export const PAUSE_MS = 1500
/** A burst this long, starting at column 1, with no correction, is a chunk. */
export const CHUNK_MIN_CHARS = 20
/** Single-change insertions larger than this are pastes/programmatic. */
export const BULK_INSERT_CHARS = 30
/** Below this many bursts the score is pulled toward neutral. */
export const BURSTS_FOR_CONFIDENCE = 8

export interface EditStats {
  inserts: number
  insertedChars: number
  /** Small deletions of 1–3 characters (typo corrections). */
  deletes: number
  /** Deletions of 4–30 characters (rewrites of real code). */
  reworks: number
  deletedChars: number
  undoRedo: number
  revisits: number
  bursts: number
  reworkBursts: number
  chunkBursts: number
  /** Characters produced by chunk bursts. */
  chunkChars: number
  /** Line chunks that were the first burst after a window refocus. */
  immediateChunks: number
  pauses: number
  midLinePauses: number
}

export const emptyEditStats = (): EditStats => ({
  inserts: 0,
  insertedChars: 0,
  deletes: 0,
  reworks: 0,
  deletedChars: 0,
  undoRedo: 0,
  revisits: 0,
  bursts: 0,
  reworkBursts: 0,
  chunkBursts: 0,
  chunkChars: 0,
  immediateChunks: 0,
  pauses: 0,
  midLinePauses: 0
})

const STAT_KEYS = Object.keys(emptyEditStats()) as (keyof EditStats)[]

function addStats(a: EditStats, b: EditStats): EditStats {
  const out = emptyEditStats()
  for (const key of STAT_KEYS) out[key] = a[key] + b[key]
  return out
}

export interface ContentChange {
  insertedChars: number
  deletedChars: number
  startLine: number
  startColumn: number
  /** Leading whitespace on the start line, so indented lines still count as line starts. */
  lineIndent?: number
  /** The inserted text contains a line break. */
  containsNewline?: boolean
  /** Inserted text, when the caller can provide it. */
  insertedText?: string
  /** Text removed by the change, when the caller can reconstruct it. */
  deletedText?: string
  /** First edit after the window regained focus. */
  afterReturn?: boolean
  isUndoRedo?: boolean
}

interface Burst {
  chars: number
  startedAtLineStart: boolean
  endedAtLineEnd: boolean
  corrected: boolean
  afterReturn: boolean
}

/**
 * Accumulates edit behaviour for one file/model. `drain()` returns the counter
 * delta since the previous call without resetting the burst state, so pauses
 * that straddle a snapshot boundary are still scored.
 */
export class AuthorshipTracker {
  private pending = emptyEditStats()
  private totals = emptyEditStats()
  private lastEventAt = 0
  private maxLine = 1
  private burst: Burst | null = null
  private pauseBefore = 0
  private hasTyped = false
  private deleteRunChars = 0
  private deleteRunActive = false
  private lastDeleteAt = 0
  private revisitOpen = false

  record(change: ContentChange, now: number): void {
    if (change.insertedChars <= 0 && change.deletedChars <= 0) return

    const atContentStart = change.startColumn === (change.lineIndent ?? 0) + 1
    const bulkEdit =
      change.insertedChars > BULK_INSERT_CHARS || change.deletedChars > BULK_INSERT_CHARS

    // Editing at column 1 means the previous burst ended at a line boundary.
    if (this.burst && change.startColumn === 1) this.burst.endedAtLineEnd = true
    // A newline completes the previous line even when it is typed after a
    // pause (the Enter event starts at the end of the line, not column 1).
    if (this.burst && change.containsNewline) this.burst.endedAtLineEnd = true

    if (this.lastEventAt > 0 && now - this.lastEventAt >= PAUSE_MS) {
      this.finishBurst()
      this.pauseBefore = now - this.lastEventAt
      this.pending.pauses += 1
      // Resuming inside a line is hesitation; resuming at the line's content
      // start is a new line and carries no authorship information.
      if (!atContentStart) this.pending.midLinePauses += 1
    }
    this.lastEventAt = now

    if (change.isUndoRedo) this.pending.undoRedo += 1

    // Oversized single edits are pastes or programmatic writes, not typing.
    if (change.insertedChars > 0 && change.insertedChars <= BULK_INSERT_CHARS) {
      this.finishDeleteRun()
      this.hasTyped = true
      if (!this.burst) {
        this.burst = {
          chars: 0,
          startedAtLineStart: atContentStart,
          endedAtLineEnd: false,
          corrected: false,
          afterReturn: change.afterReturn ?? false
        }
      } else if (change.afterReturn) {
        this.burst.afterReturn = true
      }
      this.burst.chars += change.insertedChars
      if (change.containsNewline) this.burst.endedAtLineEnd = true
      this.pending.inserts += 1
      this.pending.insertedChars += change.insertedChars
    }

    // Clearing content before the first typed character is housekeeping; it
    // must not create phantom revisits when typing starts.
    if (!this.hasTyped && change.deletedChars > 0) this.maxLine = 1

    // Small deletions and undo are corrections. Consecutive deletions within a
    // second are one correction (a held Backspace is not 24 separate fixes).
    // Whitespace-only and pre-typing deletes are housekeeping.
    if (change.deletedChars > 0 && change.deletedChars <= BULK_INSERT_CHARS && this.hasTyped) {
      const whitespaceOnly =
        change.deletedText !== undefined && change.deletedText.trim().length === 0
      if (!whitespaceOnly) {
        if (this.deleteRunActive && now - this.lastDeleteAt > 1000) this.finishDeleteRun()
        this.deleteRunActive = true
        this.lastDeleteAt = now
        this.deleteRunChars += change.deletedChars
        if (!this.burst) {
          this.burst = {
            chars: 0,
            startedAtLineStart: false,
            endedAtLineEnd: false,
            corrected: true,
            afterReturn: change.afterReturn ?? false
          }
        } else if (change.afterReturn) {
          this.burst.afterReturn = true
        }
        this.burst.corrected = true
      }
    } else if (change.deletedChars > BULK_INSERT_CHARS) {
      this.finishDeleteRun()
      this.pending.deletedChars += change.deletedChars
      // Clearing a block moves the working region back with it.
      this.maxLine = Math.min(this.maxLine, change.startLine)
    }

    // Only insertions of real content count as revisits. Adding a blank line or
    // indentation above the cursor is formatting, not authored evidence. One
    // return is one revisit: typing several characters in the earlier line is
    // the same excursion, not a fresh signal for every keystroke.
    if (!bulkEdit && change.insertedChars > 0) {
      const insertedContent =
        change.insertedText === undefined || change.insertedText.trim().length > 0
      if (insertedContent) {
        if (change.startLine < this.maxLine) {
          if (!this.revisitOpen) {
            this.pending.revisits += 1
            this.revisitOpen = true
          }
        } else {
          // Back at the working frontier; the next return above it is a new
          // excursion.
          this.revisitOpen = false
          if (change.startLine > this.maxLine) this.maxLine = change.startLine
        }
      }
    }
  }

  /** Delta since the previous drain; burst state survives so nothing is lost. */
  drain(): EditStats {
    this.finishDeleteRun()
    const delta = this.pending
    this.pending = emptyEditStats()
    this.totals = addStats(this.totals, delta)
    return delta
  }

  /** Drops the open burst after a paste so pasted text never counts as typing. */
  discardBurst(): void {
    this.burst = null
    this.pauseBefore = 0
  }

  /** Cumulative view plus the burst that is still open, for live display. */
  snapshot(): EditStats {
    const stats = addStats(this.totals, this.pending)
    if (this.deleteRunActive) {
      stats.deletedChars += this.deleteRunChars
      if (this.deleteRunChars <= 3) stats.deletes += 1
      else stats.reworks += 1
    }
    const burst = this.burst
    if (burst && (burst.chars > 0 || burst.corrected)) {
      stats.bursts += 1
      if (burst.corrected) stats.reworkBursts += 1
      else if (this.isChunk(burst)) {
        stats.chunkBursts += 1
        stats.chunkChars += burst.chars
        if (burst.afterReturn) stats.immediateChunks += 1
      }
    }
    return stats
  }

  reset(): void {
    this.pending = emptyEditStats()
    this.totals = emptyEditStats()
    this.lastEventAt = 0
    this.maxLine = 1
    this.burst = null
    this.pauseBefore = 0
    this.hasTyped = false
    this.deleteRunChars = 0
    this.deleteRunActive = false
    this.lastDeleteAt = 0
    this.revisitOpen = false
  }

  private finishDeleteRun(): void {
    if (!this.deleteRunActive) return
    this.pending.deletedChars += this.deleteRunChars
    if (this.deleteRunChars <= 3) this.pending.deletes += 1
    else this.pending.reworks += 1
    this.deleteRunChars = 0
    this.deleteRunActive = false
  }

  private isChunk(burst: Burst): boolean {
    return (
      !burst.corrected &&
      burst.chars >= CHUNK_MIN_CHARS &&
      burst.startedAtLineStart &&
      burst.endedAtLineEnd &&
      this.pauseBefore >= PAUSE_MS
    )
  }

  private finishBurst(): void {
    const burst = this.burst
    this.burst = null
    if (!burst) {
      this.pauseBefore = 0
      return
    }
    if (burst.chars === 0 && !burst.corrected) {
      this.pauseBefore = 0
      return
    }
    this.pending.bursts += 1
    if (burst.corrected) {
      this.pending.reworkBursts += 1
    } else if (this.isChunk(burst)) {
      this.pending.chunkBursts += 1
      this.pending.chunkChars += burst.chars
      if (burst.afterReturn) this.pending.immediateChunks += 1
    }
    this.pauseBefore = 0
  }
}

export interface AuthorshipFeatures {
  bursts: number
  reworkRatio: number
  revisitRatio: number
  hesitationRatio: number
  chunkRatio: number
}

export function authorshipFeatures(stats: EditStats): AuthorshipFeatures {
  const bursts = Math.max(stats.bursts, 1)
  return {
    bursts: stats.bursts,
    reworkRatio: stats.reworkBursts / bursts,
    revisitRatio: Math.min(1, stats.revisits / bursts),
    hesitationRatio: stats.pauses > 0 ? stats.midLinePauses / stats.pauses : 0,
    // Share of pauses followed by a complete, uncorrected line. Measured
    // against pauses rather than bursts so writing several lines per pause
    // does not look like transcription.
    chunkRatio: stats.chunkBursts / Math.max(stats.pauses, 1)
  }
}

/**
 * 0-100 authorship score. The 0.70 baseline means a student is assumed honest
 * unless the behaviour looks like transcription. Chunking below 0.35 is
 * tolerated; the penalty only grows once most pauses produce whole lines.
 */
export function authorshipScore(stats: EditStats): number {
  const f = authorshipFeatures(stats)
  const chunkPressure = Math.max(0, f.chunkRatio - 0.35)
  const raw =
    0.7 +
    0.3 * f.reworkRatio +
    0.2 * f.revisitRatio +
    0.1 * f.hesitationRatio -
    0.85 * chunkPressure
  const clamped = Math.min(100, Math.max(0, raw * 100))
  const confidence = Math.min(1, f.bursts / BURSTS_FOR_CONFIDENCE)
  return Math.round(50 + (clamped - 50) * confidence)
}

/**
 * Band override for a strong transcription pattern. Paste is already scored
 * as its own term, so this only applies when almost nothing was pasted. The
 * flag case also requires no revisits and no mid-line hesitation: a student
 * who never once went back or paused inside a line is the copy profile.
 */
export function transcriptionCap(stats: EditStats, pasteRatio = 0): 'none' | 'review' | 'flag' {
  const f = authorshipFeatures(stats)
  if (pasteRatio >= 0.2) return 'none'

  // No corrections and no revisits over a meaningful amount of text. Kept at
  // review only when the pauses also produce whole lines; otherwise a careful
  // typist who simply made no typos would be punished.
  const noEvidence = stats.insertedChars >= 120 && stats.reworkBursts === 0 && stats.revisits === 0
  if (noEvidence && f.chunkRatio >= 0.7) return 'flag'
  if (noEvidence && f.chunkRatio >= 0.4) return 'review'

  if (f.bursts < BURSTS_FOR_CONFIDENCE) return 'none'
  if (
    f.chunkRatio >= 0.7 &&
    f.reworkRatio <= 0.05 &&
    f.revisitRatio <= 0.1 &&
    f.hesitationRatio <= 0.15
  ) {
    return 'flag'
  }
  if (f.chunkRatio >= 0.5 && f.reworkRatio <= 0.1) return 'review'
  return 'none'
}
