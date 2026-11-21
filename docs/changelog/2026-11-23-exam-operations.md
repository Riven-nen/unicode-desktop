# Overall Summary: Exam Operations — Realtime Monitor, Event Timeline, and Reopen

**Date:** 2026-11-23

## Overall summary

Completes the exam-operations loop on top of Phase 2/3: the professor monitor now
updates over Realtime, each session has a server-recorded event timeline with CSV
export, overrides use a reason/minutes modal, and a terminal attempt can be
reopened with a fresh deadline.

## Realtime monitor

- Published `assessment_sessions` and `assessment_events` to Supabase Realtime.
- Professor dashboard refreshes the session monitor when either table changes.
- The existing 15-second poll remains as a fallback.

## Event timeline and export

- New **Events** action on each exam session.
- Timeline lists tab-outs, fullscreen exits, blocked pastes, warnings, overrides,
  and auto-submits with timestamps and metadata.
- **Export CSV** writes the selected session’s audit trail.
- Events remain readable by the owning student and class professor only.

## Override workflow

- New override modal collects action, minutes, and reason.
- Active sessions support:
  - extend time
  - excuse interruptions
- Terminal sessions support:
  - reopen with a fresh deadline
- Every action is written to `assessment_overrides` and `assessment_events`.
- `reopen` clears the terminal state and final submission link, resets exam
  counters, starts a new active window, and allows another submission.
- `reopen_count` tracks repeated reopenings.

## Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test` passes: 18 files, 121 tests.
- `npm run build` passes.
- Live reopen smoke test passes: active status restored, final submission
  cleared, reopen count incremented, and a second submission accepted.
