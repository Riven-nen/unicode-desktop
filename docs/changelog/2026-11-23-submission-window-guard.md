# Overall Summary: Seatwork Window Guard and Submit Clarity

**Date:** 2026-11-23

## Overall summary

Fixes a confusing seatwork case where a 60-minute duration was cut to a
2-minute window by the close time. The student started with 15 seconds left, the
timer auto-submitted the latest draft, and the student kept typing without
realizing the work was already final.

## Live-window guard

- The assignment editor now rejects a live seatwork when `closes_at` is earlier
  than `opens_at + duration_minutes`.
- The validation error states the configured duration and the shorter available
  window, and suggests either moving the close time or reducing the duration.
- The timing summary now shows the effective shared window and both times:
  `Shared 2 min window 22 Nov, 03:32 PM → 03:34 PM`.
- This prevents the duration field from silently claiming 60 minutes when only
  2 minutes are available.

## Auto-submit clarity

- Auto-submit now opens a visible **Time is up** modal.
- The modal says the server submitted the latest saved draft, the submission is
  final, and any later editor typing is not part of the submitted work.
- The modal offers **View editor** and **Back to dashboard**.
- The toast remains as a secondary notice.

## Draft capture

- Timed-assessment draft autosave moved from 8 seconds to 2 seconds.
- The deadline path still submits the live editor content when the client is
  active; the shorter autosave window reduces the amount of work at risk when
  the server finalizes first.

## Review snapshot

- When the professor switches submissions, the review now resets to the new
  submission’s final snapshot instead of keeping the previous timeline stop.

## Verification

- Desktop typecheck, lint, tests, and build pass.
- Admin typecheck and build pass.
- Tests: 20 files, 140 tests.
- The live data confirmed the old `test` seatwork had `opens_at` 15:32,
  `closes_at` 15:34, and a 60-minute duration, explaining the 15-second attempt
  and the incomplete draft.
