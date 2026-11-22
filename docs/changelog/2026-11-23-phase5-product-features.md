# Overall Summary: Phase 5 Product Features

**Date:** 2026-11-23

## Overall summary

Adds multiple attempts, one-time override codes, exam templates, bulk class
policies, proctoring filters, class-wide exam analytics, and a CSS/JavaScript
course. MCQ quizzes remain deferred.

## Multiple attempts

- Assignments now have `max_attempts` (1–10, default 1).
- Assessment sessions carry `attempt_number`; the unique key is now
  `(assignment_id, student_id, attempt_number)`.
- Start resumes the latest active attempt, creates the next attempt after a
  terminal one, and rejects starts once the limit is used.
- Students see attempt numbers on seatwork cards and a full attempt history in
  assignment details.
- Professor monitor shows attempt number and reopen count per attempt.

## One-time override codes

- Professors can generate an 8-character code for an active or terminal session.
- Codes support extend time, excuse interruptions, and reopen.
- Codes are hashed in storage, expire, and can be redeemed once.
- Students redeem from the assignment details modal.
- Redemption writes the normal override audit and event rows.

## Exam templates and bulk policies

- Saved exam templates include duration, interruption allowance, fullscreen,
  paste block, run-only terminal, auto-submit, and timer visibility.
- Templates can be applied from the seatwork editor and saved from current
  settings.
- Bulk exam policy updates every seatwork in a class from the class page.
- Existing sessions keep their snapshotted settings.

## Proctoring analytics

- Session monitor filters by search, status, interruptions, and overrides.
- Class page shows an exam overview across timed work:
  attempts, active, auto-submitted, interruptions, blocked pastes, overrides.

## Content

- Added `WEB102 - CSS & JavaScript` with four assignments:
  - CSS selectors and the box model
  - Flexbox layout
  - DOM and events
  - Interactive gallery project
- Join code: `WEB102C4S`; students 1–6 are enrolled.

## Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test` passes: 18 files, 121 tests.
- `npm run build` passes.
- Live smoke test passes: second attempt allowed, third rejected, override code
  generated/redeemed, one-time reuse rejected, and class exam overview returned.
- Seed rerun creates WEB102 and preserves the ICS v3 demo bands.
