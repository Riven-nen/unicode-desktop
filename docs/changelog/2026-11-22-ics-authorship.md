# Overall Summary: ICS Authorship Signal

> Superseded by the [v3 evidence ledger](2026-11-22-ics-evidence-v3.md). This
> entry documents the v2 authorship term that v3 replaced.

**Date:** 2026-11-22

## Overall summary

The 25-point typing term no longer measures typing speed. It measures
**authorship evidence**: what a student does when they resume typing after a
pause. Corrections, revisits to earlier lines, and hesitation inside a line count
in the student's favour. A pause followed by a complete, uncorrected line
(a **line chunk**) counts against them.

Pauses themselves are never scored, and the Focus term no longer treats a
2–5 minute thinking pause as idle time. The weights stay 35/25/20/20, the band
thresholds stay 80/60, and the database column keeps its historical name
(`cadence_term`) so the professor views and paper tables do not change shape.

## Why

Two runs of the old demo showed the problem from both sides:

| Run                               | Cadence   | Total | Band   |
| --------------------------------- | --------- | ----- | ------ |
| Hand-copied from a second monitor | 24 → 6.0  | 71    | review |
| Normal typing                     | 61 → 15.3 | 80    | pass   |

Nine points separated honest work from copying, and the pass line sat between
them. The old cadence input was a coefficient of variation, so it punished
thinking pauses and rewarded regular, metronomic typing — the opposite of the
intended signal. In the real pipeline the effect was worse: `DEBOUNCE_MS = 1500`
cleared the interval buffer at every snapshot, so gaps over 1.5 seconds were
erased before they reached the database and both runs scored near 90.

## What changed

### Telemetry

- `code_snapshots.edit_stats` (jsonb) stores a delta of edit behaviour:
  insertions and deletions, undo/redo, revisits, pauses, mid-line pauses, and
  line-chunk bursts.
- `useCodeTracker` keeps a rolling `AuthorshipTracker` per file. It is **not**
  cleared on snapshot capture, so a pause that straddles a snapshot boundary is
  still scored. The existing `typing_intervals` buffer is unchanged and still
  feeds the heatmap.
- Pastes and single-change insertions over 30 characters are excluded from the
  counters, so pasting cannot look like typing. The same limit applies to
  deletions, so clearing a starter file does not count as rework.

### Scoring

New `recompute_ics` (migration `20261122100000_ics_authorship.sql`):

```text
rework     = corrected bursts / bursts
revisit    = min(1, edits above current line / bursts)
hesitation = mid-line resumes / pauses
chunk      = line-chunk bursts / max(1, pauses)

A = 100 × clamp(0.70 + 0.30·rework + 0.20·revisit + 0.10·hesitation
                − 0.85·max(0, chunk − 0.35), 0, 1)
```

- Shrunk toward neutral 50 below 8 bursts.
- A line chunk is a pause of at least 1.5 s followed by at least 20 characters
  typed from the line's first non-whitespace column through the end of the line,
  with no correction in the burst. Indentation is ignored when deciding whether a
  burst started at the beginning of a line.
- Bulk edits (pastes and select-all deletes over 30 characters) are ignored, so
  clearing the starter file does not look like rework.
- The score is stored in `cadence_term` as before.
- Submissions captured before this migration have no `edit_stats`, so the
  function keeps the old interval/session-gap estimate as a fallback.

### Band cap

A strong transcription profile cannot pass on the strength of the free terms:
`chunk ≥ 0.5` with `rework ≤ 0.10` is held at **review**. The extreme profile
(`chunk ≥ 0.7`, `rework ≤ 0.05`, `revisit ≤ 0.10`, `hesitation ≤ 0.15`) is
**flag**. The cap only applies when less than 20% of inserted text was pasted,
because paste already has its own term.

### Focus

A gap now counts as active time up to 5 minutes instead of 2, so a long think
does not lower Focus. Breaks over 30 minutes are still excluded from the session.

### UI and docs

- The ICS term is labelled **Authorship** in the professor panel and the student
  demo. The typing-rhythm heatmap remains available as a diagnostic.
- The demo runs the same authorship rules locally and shows the counter detail
  (`N corrections · N revisits · N line chunks`) plus a notice when the cap fires.
- Updated `docs/02_TECHNICAL_OVERVIEW.md` §13, `README.md`, the feature master
  list (ICS-01/07/11/12), the plain-language overview, the QA checklist, and
  paper §4.3.2.

## Expected effect

Synthetic unit scenarios (`src/renderer/src/lib/authorship.test.ts`):

| Scenario                                            | Authorship | Old cadence | Band           |
| --------------------------------------------------- | ---------- | ----------- | -------------- |
| Thinking pauses + corrections + revisits            | ~74–89     | 61 → 15.3   | pass           |
| Line-by-line transcription with a few corrections    | ~30–50     | 24 → 6.0    | review         |
| Transcription, zero corrections/revisits/hesitation | ~15        | —           | flag           |

The manual demo runs (honest session, second-monitor session) should be repeated
after the migration is applied; the table above is from unit scenarios, not the
GUI.

## Rollout

1. Apply the migration **before** running the new build. The tracker now sends
   `edit_stats`, and inserts fail if the column does not exist.
2. Existing submissions keep their score until a professor recomputes; the
   fallback path makes recompute safe for old snapshots.
3. Only new snapshots carry authorship counters, so a submission that mixes old
   and new snapshots scores with whatever counters exist.

## Limitations

- This is a heuristic screen, not proof. Deliberate rework and pointless
  revisits are easy to add.
- A student who genuinely writes complete lines with no corrections and no
  mid-line pauses can look like a transcriber. The review cap is the compromise;
  the flag case additionally requires no revisits and no hesitation.
- No raw keystroke content, window focus, or second-device signal is recorded.
  Copying from another screen is inferred from edit shape only.
