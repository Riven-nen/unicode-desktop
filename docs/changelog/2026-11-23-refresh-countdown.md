# Overall Summary: Refresh Feedback and Seatwork Countdown

**Date:** 2026-11-23

## Overall summary

Adds spinning feedback to refresh and recompute actions across the admin,
student, workspace, preview, and professor surfaces. Scheduled seatworks can now
be pressed before they open; instead of failing, they show a live countdown
modal and unlock Start at zero.

## Refresh feedback

- Added a shared `.is-spinning` animation.
- Admin dashboard Refresh spins while its data reloads.
- Student dashboard Refresh spins for its class/feedback reload.
- Workspace and HTML preview Refresh buttons spin briefly.
- Professor monitor, event log, exam overview, Live Lab, class refresh, and ICS
  recompute buttons spin while their action is in flight.

## Scheduled seatwork countdown

- Before `opens_at`, the seatwork card no longer shows a disabled button. It
  shows a pressable **Starts in …** button.
- Pressing it opens a new countdown modal with:
  - the seatwork title and timing summary
  - a large live `HH:MM:SS` countdown
  - the exact open time
  - a progress bar that fills while waiting
  - a disabled **Waiting…** action until the window opens
- At zero, the modal switches to **Opening now** and unlocks **Start seatwork**.
- Starting from the modal uses the normal server-authoritative start RPC.
- The assignment detail modal’s upcoming action now opens the same countdown.
- If the seatwork closes while the modal is open, it switches to Closed.

## Verification

- Desktop typecheck, lint, tests, and build pass.
- Admin typecheck and build pass.
- Tests: 20 files, 133 tests.
- Live Electron check: the scheduled button opened the modal, the countdown
  changed from 06:16 to 06:14 over two seconds, and no page errors were raised.
- Headless admin check: Refresh showed the spinning icon and “Refreshing…” state,
  then returned to normal.
