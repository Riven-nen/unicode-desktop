# Overall Summary: ICS Demo Moved to Admin Console

**Date:** 2026-11-23

## Overall summary

Moves the live ICS playground from the student desktop app to the admin web
console. The demo now runs against the current admin-managed metric and is
lazy-loaded so the accounts/classes dashboard does not pull Monaco until the
demo is opened.

## Admin console

- Added an **ICS demo** button to the console header.
- Ported the Monaco playground, live gauge, evidence ledger, confidence bar,
  scenario recording, score timeline, saved runs, and keylog.
- The demo reads `ics_settings` and uses the live weights, score range, band
  thresholds, pass floor, and confidence gate.
- The header shows the metric version, or “shipped defaults” if loading fails.
- Timeline bands use the live pass/review thresholds.
- HTML mode uses an inline `iframe` preview instead of the Electron loopback
  preview server.
- Monaco and its workers are bundled locally and lazy-loaded as a separate
  chunk.

## Desktop app

- Removed the ICS demo button and modal from the student dashboard and class
  page.
- Deleted the desktop `IntegrityDemo.tsx` component.
- The professor ICS panel, submission review, and server scoring are unchanged.

## Verification

- Admin typecheck passes.
- Admin build passes.
- Desktop typecheck passes.
- Lint passes.
- Tests pass.
- Desktop build passes.
