# Overall Summary: Timed Assessments Phase 1, Professor Review Terminal, and Documentation Refresh

**Date:** 2026-11-22

## Overall summary

This batch turns assignments and seatworks into two distinct coursework paths.
Assignments are take-home work and may carry an optional server-enforced timer;
seatworks are in-person timed work with a shared live window, per-student
countdown, draft autosave, crash-resume, and deadline auto-submit. Professors
create both from the class page, see a live session monitor, and receive the
finished work through the existing submission, grading, ICS, and review
pipeline.

The same batch includes the professor's local submission terminal, which writes
a reviewed snapshot to a temporary directory and runs it with the installed
toolchain outside Judge0. It also records the novel-paste ICS change and adds
the paper/QA documentation, diagrams, and preliminary-survey results that were
prepared alongside Phase 1.

## Timed assessments — Phase 1

### Schema and server authority

- Added `assignments.kind` (`assignment` / `seatwork`) and timing fields:
  `timing_mode`, `duration_minutes`, `opens_at`, `closes_at`, `auto_submit`,
  and `show_timer`.
- Added `assessment_sessions` with one attempt per student/assessment and
  statuses `active`, `submitted`, `auto_submitted`, `expired`, `abandoned`.
- Added `assessment_drafts` for the latest autosaved content and a monotonic
  revision counter.
- Added `submissions.assessment_session_id` so timed work reuses the existing
  snapshot, grade-release, ICS, comment, and similarity pipeline.
- Added security-definer RPCs:
  `start_assessment_session`, `get_assessment_session`,
  `save_assessment_draft`, `submit_assessment_session`,
  `expire_assessment_sessions`, `fetch_assessment_sessions`, and the internal
  `finalize_assessment_session`.
- Server deadline formulas:
  - timed take-home: `min(started_at + duration, closes_at)`
  - live seatwork: `min(opens_at + duration, closes_at)`
- Submission grace is 10 seconds. After that, finalization uses the latest
  saved draft and marks the session `auto_submitted`.
- `pg_cron` is not installed in the project, so expiry is lazy: it runs from the
  assessment RPCs and the professor monitor. There is no background scheduler.
- `finalize_assessment_session` generates the final snapshot UUID, attaches
  unsynced snapshots, and records the standard submission row.

### Professor experience

- Class overview now has **Assignments** and **Seatworks** tabs with separate
  counts and creation actions.
- The assignment editor accepts type, timing mode, duration, opening time,
  cut-off, auto-submit, and show-timer settings.
- Timed work shows its window and policy in the assignment header.
- A **Session monitor** lists each student's status, start, deadline, last save,
  draft revision, and a Review action for the final submission.
- The monitor refreshes opportunistically and runs lazy expiry on each refresh.

### Student experience

- Class detail now has **Assignments** and **Seatworks** tabs.
- Timed work shows a Start/Resume action, server-offset countdown, scheduled and
  closed states, and a submitted state.
- Starting or resuming writes the server draft into the workspace file, so a
  crash or restart resumes the same content.
- Drafts autosave every 8 seconds and on window hide. Submitting sends the live
  editor content when available.
- A workspace countdown bar shows time remaining, autosave state, Open file, and
  Submit. At zero the client asks the server to finalize; the server remains the
  authority on whether the attempt is on time.
- Students can only have one active timed assessment open at a time. Starting a
  second one is blocked until the first is submitted.

### Phase 1 boundaries

Intentionally not included: tab-out detection, strikes, professor password or
override, paste blocking, fullscreen enforcement, run-only terminal, MCQ
quizzes, and exam-mode ICS renormalization. These remain Phase 2 work.

## Professor review terminal

- Submission review can open a local terminal for the selected snapshot.
- The snapshot is written to a temporary directory, and **Run file** uses the
  installed toolchain.
- Closing the terminal removes the temporary copy with a process-tree kill and
  retry cleanup.
- Student code runs with the professor's local OS permissions, outside Judge0;
  the UI warns about this explicitly.

## Integrity and documentation

- ICS paste scoring counts only **novel** pasted characters. Moving or
  duplicating code already present in an earlier snapshot no longer lowers the
  paste term.
- Added system-flow and data-flow diagrams, the current ICS formula diagram and
  LaTeX equation images, and preliminary-survey item/group charts.
- Added system requirements, development status, paper section 4.3, and updated
  survey results documents.
- Added this changelog folder with an index and this overall summary.

## Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test` passes: 13 files, 74 tests.
- `npm run build` passes.
- Live RPC smoke test passes: start, save, resume with the saved draft, submit,
  final submission link, professor monitor visibility, and rejection of a second
  attempt.
- Live expiry smoke test passes: forcing an expired session finalizes it as
  `auto_submitted` and captures the latest saved draft.
- Remote migration check confirms 7 assignment timing columns, 2 assessment
  tables, and 7 assessment RPCs.

## Known limits

- No `pg_cron`; deadline finalization is lazy rather than scheduled.
- A submitted attempt is final in Phase 1; there is no retake/reset flow.
- The desktop build is unsigned.
- Judge0 still depends on a live external endpoint.
- The local C++ diagnostics path requires `g++`; this machine did not have it
  installed.
