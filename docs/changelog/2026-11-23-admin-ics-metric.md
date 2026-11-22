# Overall Summary: Admin ICS Metric

**Date:** 2026-11-23

## Overall summary

Moves the ICS v3 metric constants out of code and into a single admin-managed
settings row, then adds an admin console panel to tune and preview them. Scores
record the settings version that produced them, and an admin action can
re-apply the metric to stored v3 evidence without re-reading snapshots.

## Settings

New `public.ics_settings` single-row table:

- base score
- score floor and ceiling
- authored weight
- paste, transcription, rhythm, away/refocus, and similarity weights
- pass and review thresholds
- pass minimum characters
- minimum confidence

Defaults reproduce the shipped v3 metric exactly. The row is readable only by
admins through RLS; writes go through a guarded admin RPC.

## Scoring

- `recompute_ics_exam` still calls the v3 base calculation, then enriches the
  evidence ledger with inserted characters, bursts, operation counts, snapshot
  count, and the base score/band/confidence.
- `apply_ics_settings` re-scores that stored evidence with the current weights
  and bands. It preserves the hard rules for dominant novel paste, corroborated
  transcription, and paste-plus-similarity.
- `ics_scores` now stores `settings_version` and `settings_snapshot`.
- Legacy v2 rows are not changed.

## Admin console

- New **ICS metric** panel with grouped sliders for score composition, negative
  weights, and band thresholds. Each slider shows its current value and a small
  explanation that changes as the value moves.
- Live band map with Flag/Review/Pass zones and markers for authored, mixed, and
  paste-heavy scenarios.
- Save, reset-to-defaults, and re-apply-to-existing-v3-actions.
- Version and last-editor display.

## Re-apply behavior

`admin_reapply_ics_settings` iterates stored v3 evidence rows and calls
`apply_ics_settings`. It does not read snapshots or student code, so it also
works after snapshot retention has pruned redundant auto snapshots.

## Verification

- `npm run typecheck` passes.
- Admin typecheck passes.
- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes.
- Live smoke test passes: admin read/update, version increment, threshold change
  rebands a 79.6 Review to Pass, re-apply count, default restore, and unchanged
  v2 rows.
- Retention smoke test passes, including admin re-apply after pruning.
