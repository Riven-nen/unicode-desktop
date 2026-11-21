import { describe, expect, it } from 'vitest'
import {
  AuthorshipTracker,
  authorshipFeatures,
  authorshipScore,
  transcriptionCap
} from './authorship'
import type { ContentChange } from './authorship'

/** Drives a tracker with a synthetic typing session. */
class Session {
  readonly tracker = new AuthorshipTracker()
  now = 1_000

  insertChars(
    count: number,
    line: number,
    column: number,
    newline = false,
    lineIndent = 0,
    insertedText?: string
  ): void {
    this.now += 150
    this.tracker.record(
      {
        insertedChars: count,
        deletedChars: 0,
        insertedText,
        startLine: line,
        startColumn: column,
        lineIndent,
        containsNewline: newline
      },
      this.now
    )
  }

  deleteChars(
    count: number,
    line: number,
    column: number,
    undo = false,
    deletedText?: string
  ): void {
    this.now += 150
    this.tracker.record(
      {
        insertedChars: 0,
        deletedChars: count,
        deletedText,
        startLine: line,
        startColumn: column,
        isUndoRedo: undo
      },
      this.now
    )
  }

  pause(ms: number): void {
    this.now += ms
  }

  typeLine(line: number, length: number, corrected: boolean): void {
    for (let column = 1; column <= length; column += 1) {
      this.insertChars(1, line, column, column === length)
    }
    if (corrected) {
      this.deleteChars(2, line, length)
      this.insertChars(2, line, length)
    }
  }

  feed(changes: ContentChange[], gapMs = 150): void {
    for (const change of changes) {
      this.now += gapMs
      this.tracker.record(change, this.now)
    }
  }
}

describe('authorshipScore', () => {
  it('keeps an honest session high even with long thinking pauses', () => {
    const session = new Session()
    for (let line = 1; line <= 10; line += 1) {
      session.pause(8_000) // thinking, not copying
      session.typeLine(line, 18, line % 2 === 0)
      if (line === 7) {
        // Go back and rename something above the current line.
        session.insertChars(1, 3, 8)
      }
    }
    const stats = session.tracker.snapshot()
    const features = authorshipFeatures(stats)
    expect(features.reworkRatio).toBeGreaterThan(0.3)
    expect(features.chunkRatio).toBeLessThan(0.3)
    expect(authorshipScore(stats)).toBeGreaterThan(70)
    expect(transcriptionCap(stats)).toBe('none')
  })

  it('scores a line-by-line transcription low and flags it', () => {
    const session = new Session()
    for (let line = 1; line <= 12; line += 1) {
      session.pause(4_000) // look at the other screen
      session.typeLine(line, 26, false)
    }
    const stats = session.tracker.snapshot()
    const features = authorshipFeatures(stats)
    expect(features.chunkRatio).toBeGreaterThan(0.9)
    expect(features.reworkRatio).toBe(0)
    expect(authorshipScore(stats)).toBeLessThan(40)
    expect(transcriptionCap(stats)).toBe('flag')
  })

  it('does not care how long a pause lasts', () => {
    const run = (pauseMs: number): number => {
      const session = new Session()
      for (let line = 1; line <= 8; line += 1) {
        session.pause(pauseMs)
        session.typeLine(line, 22, line % 3 === 0)
      }
      return authorshipScore(session.tracker.snapshot())
    }
    expect(run(2_000)).toBe(run(120_000))
  })

  it('pulls toward neutral when there are too few bursts', () => {
    const session = new Session()
    session.pause(3_000)
    session.typeLine(1, 20, false)
    expect(authorshipScore(session.tracker.snapshot())).toBeLessThan(60)
  })

  it('ignores pasted blocks', () => {
    const session = new Session()
    session.pause(3_000)
    session.insertChars(200, 1, 1)
    expect(session.tracker.snapshot().insertedChars).toBe(0)
  })

  it('counts a line as a chunk when Enter is pressed after a pause', () => {
    const session = new Session()
    session.insertChars(1, 1, 1)
    session.pause(2_000)
    for (let column = 1; column <= 25; column += 1) {
      session.insertChars(1, 7, column + 4, false, 4)
    }
    session.pause(2_000)
    session.insertChars(5, 7, 30, true, 4)
    const stats = session.tracker.snapshot()
    expect(stats.chunkBursts).toBe(1)
    expect(stats.chunkChars).toBe(25)
  })

  it('groups a held Backspace into one correction', () => {
    const session = new Session()
    session.insertChars(1, 1, 1)
    for (let index = 0; index < 10; index += 1) {
      session.deleteChars(1, 1, 1)
    }
    const stats = session.tracker.snapshot()
    expect(stats.deletes + stats.reworks).toBe(1)
  })

  it('does not count a blank line as a revisit', () => {
    const session = new Session()
    session.insertChars(1, 1, 1)
    session.pause(2_000)
    session.typeLine(1, 20, false)
    session.pause(2_000)
    session.typeLine(2, 20, false)
    session.pause(2_000)
    session.insertChars(1, 1, 5, true, 0, '\n')
    const stats = session.tracker.snapshot()
    expect(stats.revisits).toBe(0)
  })

  it('counts one return to an earlier line as one revisit', () => {
    const session = new Session()
    for (let line = 1; line <= 3; line += 1) session.typeLine(line, 12, false)
    // Moving up and typing several characters is one excursion, not one
    // revisit per keystroke.
    for (let column = 1; column <= 5; column += 1) session.insertChars(1, 1, column)
    expect(session.tracker.snapshot().revisits).toBe(1)
    // Type on the working line, then go up again: a second excursion.
    session.insertChars(1, 3, 13)
    session.insertChars(1, 1, 6)
    expect(session.tracker.snapshot().revisits).toBe(2)
  })

  it('ignores whitespace-only deletions', () => {
    const session = new Session()
    session.insertChars(4, 1, 1)
    session.deleteChars(1, 1, 4, false, ' ')
    session.deleteChars(4, 1, 1, false, '    ')
    const stats = session.tracker.snapshot()
    expect(stats.deletes).toBe(0)
    expect(stats.reworks).toBe(0)
  })

  it('does not count starter clearing as rework or revisits', () => {
    const session = new Session()
    for (let index = 0; index < 5; index += 1) {
      session.deleteChars(1, 1, 1)
    }
    session.pause(2_000)
    session.typeLine(1, 30, false)
    const stats = session.tracker.snapshot()
    expect(stats.deletes).toBe(0)
    expect(stats.reworks).toBe(0)
    expect(stats.revisits).toBe(0)
  })

  it('flags an indented block copied after clearing the starter', () => {
    const session = new Session()
    session.pause(1_000)
    session.deleteChars(200, 1, 1) // select-all delete of the starter
    for (let line = 1; line <= 10; line += 1) {
      session.pause(2_500)
      for (let column = 1; column <= 24; column += 1) {
        session.insertChars(1, line, column + 4, column === 24, 4)
      }
    }
    const stats = session.tracker.snapshot()
    expect(stats.reworkBursts).toBe(0)
    expect(stats.chunkBursts).toBeGreaterThanOrEqual(6)
    expect(transcriptionCap(stats)).not.toBe('none')
    expect(authorshipScore(stats)).toBeLessThan(60)
  })
})

describe('transcriptionCap', () => {
  it('does not cap when pasting is already the dominant signal', () => {
    const session = new Session()
    for (let line = 1; line <= 12; line += 1) {
      session.pause(2_000)
      session.typeLine(line, 25, false)
    }
    expect(transcriptionCap(session.tracker.snapshot(), 0.5)).toBe('none')
  })

  it('holds a mixed pattern at review instead of flag', () => {
    const session = new Session()
    for (let line = 1; line <= 12; line += 1) {
      session.pause(2_000)
      session.typeLine(line, 25, false)
    }
    session.deleteChars(1, 12, 25) // one correction
    const stats = session.tracker.snapshot()
    expect(transcriptionCap(stats)).toBe('review')
  })
})

describe('drain', () => {
  it('returns deltas and keeps cumulative totals', () => {
    const session = new Session()
    session.pause(2_000)
    session.typeLine(1, 5, false)
    const first = session.tracker.drain()
    expect(first.inserts).toBe(5)
    expect(session.tracker.snapshot().inserts).toBe(5)
    session.insertChars(1, 1, 6)
    expect(session.tracker.snapshot().inserts).toBe(6)
  })
})
