# Overall Summary: Physical Interruption Keys

**Date:** 2026-11-23

## Overall summary

A tab-out or fullscreen exit now locks the exam until the professor physically
issues a resume key. The student cannot continue without the key, and no written
explanation is stored.

## Student flow

- The first interruption opens a non-dismissible **Assessment paused** modal.
- The modal shows the remaining time and the interruption count.
- The professor must come to the station and issue a one-time resume key.
- The student enters the key and continues.
- The interruption still counts toward the allowed total.
- The next interruption after the allowed count auto-submits the attempt.

## Professor flow

- The monitor shows the interruption in real time.
- **Code** now includes **Resume after interruption**.
- The key is one-time, expiring, and tied to the session.
- The event timeline shows **Resume key used** and the auto-submit.
- No student explanation field is rendered or stored.

## Data

- `assessment_events` now accepts `interruption_excused`.
- `assessment_override_codes` and `assessment_overrides` now accept
  `resume_interruption`.
- `redeem_interruption_key(session, code)` marks the key used and records the
  resume event without an explanation.
- Tab-out detection pauses while the interruption modal is open, so fetching the
  key from the professor does not create another interruption.

## Demo

- The demo seatwork uses **1 allowed interruption**.
- First tab-out: lock and resume key.
- Second tab-out: auto-submit.
- The script calls out that this is a physical intervention, not a writing task.
