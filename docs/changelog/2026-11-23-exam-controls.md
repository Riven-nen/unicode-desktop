# Overall Summary: Phase 2/3 Exam Controls

**Date:** 2026-11-23

## Overall summary

Phase 2 turns live seatworks into supervised exam sessions. The server records
tab-outs, fullscreen exits, and blocked paste attempts, issues warnings, and
auto-submits when the configured interruption allowance is exceeded. Professors
can see the event summary and apply audited overrides. Phase 3 marks paste as
N/A for seatwork ICS while retaining the remaining evidence score.

## Student controls

- Tab-out/window blur detection after a 2.5-second grace period.
- Fullscreen request on seatwork start, with exit detection.
- Warning dialog for each allowed interruption.
- Server-side auto-submit once `interruptions > allowed_tab_outs`.
- Paste and drag-drop rejected in exam mode.
- Run-only terminal: arbitrary shell input is disabled, Run file still works.
- Exam status bar shows interruptions, blocked pastes, fullscreen re-entry, and
  override state.

## Professor controls

- Seatwork editor settings:
  - allowed interruptions (0–10)
  - require fullscreen
  - block paste and drag-drop
  - run-only terminal
- Session monitor shows interruption count, tab-outs, fullscreen exits, blocked
  pastes, and override state.
- **+5m** extends the active server deadline.
- **Excuse** resets the interruption counters.
- Every override writes to `assessment_overrides` and `assessment_events`.

## Server authority

- `assessment_events` records the audit trail.
- Interruption counters live on `assessment_sessions`.
- `record_assessment_event` decides warning vs auto-submit.
- `apply_assessment_override` is professor-only and audited.
- Exam settings are copied onto the session at start.

## Exam-mode ICS

- Seatwork ICS rows carry `exam_mode = true`.
- Paste is treated as N/A and the remaining evidence score is preserved.
- Review panel labels the paste signal as **Paste (N/A)**, with the exam-mode
  reason appended.

## Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test` passes: 18 files, 121 tests.
- `npm run build` passes.
- Live RPC smoke test passes: settings snapshot, first tab-out warning, blocked
  paste logging, second interruption auto-submit, override audit, and event
  trail.
- Live exam ICS smoke test passes: seatwork row marked exam mode and paste N/A.

## Still deferred

MCQ quizzes remain out of scope; UniCode remains an IDE.
