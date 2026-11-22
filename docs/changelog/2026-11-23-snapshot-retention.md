# Overall Summary: Snapshot Retention

**Date:** 2026-11-23

## Overall summary

Reduces snapshot growth with a 30-second automatic snapshot cadence and adds an
opt-in, evaluation-safe retention workflow. The ICS is frozen before any
snapshot is removed, and only redundant auto snapshots are deleted.

## Snapshot cadence

- Automatic snapshot spacing changed from 10 s to 30 s.
- The 1.5 s idle debounce is unchanged.
- The cadence rule moved into `snapshotCadence.ts` with unit tests.
- Expected effect: about 3x less automatic snapshot content for the same
  editing session.

## Retention

- `submissions` now records `snapshots_pruned_at` and
  `snapshots_pruned_count`.
- `prune_submission_snapshots(submission, auto_per_hour, dry_run)` computes the
  ICS if missing, then plans and optionally deletes redundant auto snapshots.
- Dry run is the default.
- Protected snapshots:
  - final submission snapshot
  - paste, manual, and restore snapshots
  - paste-event snapshots
  - comment-anchored snapshots
  - first and last snapshot of each file
  - the first N auto snapshots per file per hour (default 1)
- Paste events, comments, grades, ICS rows, submissions, drafts, and assessment
  events are never deleted.

## Frozen evaluation

- `recompute_ics` now refuses to run on a pruned submission.
- `recompute_ics_for_assignment` skips pruned submissions and returns the
  number actually recomputed.
- The stored `ics_scores` row remains the evaluation of record.

## Tooling

- `scripts/prune-snapshots.mjs` supports dry run/apply, class/assignment/
  submission scopes, age filters, and auto-per-hour density.
- `npm run prune:snapshots -- --days 30` runs a dry run.
- Documentation: `docs/SNAPSHOT_RETENTION.md`.

## Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes.
- Live dry run reports candidate rows without deleting demo data.
