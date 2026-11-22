# Snapshot retention

Snapshot telemetry is the largest storage cost in Unicode Lab. Every automatic
snapshot stores the **full file content**, not a diff, so the cost grows with
how often a student edits and how long the file is.

This document explains what is safe to remove after evaluation and how to do it
without losing the evidence used by the ICS or the professor review tools.

## What is expensive

| Data                    | Growth pattern                                         | Relative cost |
| ----------------------- | ------------------------------------------------------ | ------------- |
| `code_snapshots`        | Full file content per auto snapshot, every ~30 s       | High          |
| `paste_events`          | One row per paste, with the full pasted text           | Medium        |
| `submissions`           | One row per attempt                                    | Low           |
| `assessment_drafts`     | One row per session, updated in place                  | Low           |
| `assessment_events`     | Small rows per tab-out, warning, override, auto-submit | Low           |
| `comments`, `code_runs` | Small and bounded                                      | Low           |

The default cadence is now:

- 1.5 s idle debounce after the last keystroke
- 30 s minimum spacing between automatic snapshots

At 30 s spacing, a single 5 KB file produces about **600 KB per active hour**
instead of about 1.8 MB at the old 10 s spacing. For a 40-student, 2-hour exam
that is roughly **48 MB** of snapshot content instead of about 144 MB.

## Is it safe to delete after evaluation?

Yes — but only the redundant automatic snapshots, and only after the ICS row
has been computed and stored.

The pruning function freezes the evaluation first:

1. If the submission has no `ics_scores` row, `recompute_ics` runs.
2. The stored ICS row remains as the evaluation of record.
3. The public `recompute_ics` RPC refuses to recompute a pruned submission.
4. Bulk recompute skips pruned submissions instead of failing the batch.

Do **not** prune before grades are final or before any academic-integrity
appeal window has closed.

## What is kept

`prune_submission_snapshots` only deletes rows where `snapshot_type = 'auto'`.
It protects:

- the submission's `final_snapshot_id`
- every `paste`, `manual`, and `restore` snapshot
- every snapshot referenced by a `paste_events` row
- every snapshot referenced by an inline comment
- the first and last snapshot of each file
- the first N automatic snapshots per file per hour (default 1)

That leaves the final work, all paste evidence, all deliberate checkpoints, all
professor annotations, and a coarse timeline intact.

Paste events themselves, comments, grades, ICS rows, submissions, drafts, and
assessment events are never deleted by this process.

## Dry run

The default is a dry run. It reports how many auto snapshots would be removed
and how many bytes of snapshot content that represents.

```powershell
# All submissions older than 30 days
npm run prune:snapshots -- --days 30

# One class (code or exact name)
npm run prune:snapshots -- --class CS101 --days 14

# One assignment or submission
npm run prune:snapshots -- --assignment <assignment-uuid>
npm run prune:snapshots -- --submission <submission-uuid>
```

`--days 0` includes every submitted attempt regardless of age.

## Apply

```powershell
npm run prune:snapshots -- --days 30 --apply
npm run prune:snapshots -- --class CS101 --days 14 --apply
npm run prune:snapshots -- --submission <submission-uuid> --apply
```

Use `--auto-per-hour 0` to keep only the first/last snapshot of each file plus
the protected milestones. Use a larger value, such as `4`, for a denser
timeline.

The script uses `SUPABASE_SERVICE_ROLE_KEY` and does not need a signed-in
professor session. The same RPC is also callable by the class professor, so a
future retention screen can call it without service credentials.

## After pruning

- A pruned submission keeps its ICS score, band, confidence, evidence, and
  band reason.
- `submissions.snapshots_pruned_at` records when pruning happened.
- `submissions.snapshots_pruned_count` records how many rows were removed.
- Recomputing that submission raises a clear "ICS is frozen" error.
- Admins can still re-apply an adjusted ICS metric to the stored evidence
  ledger, because re-apply does not read snapshots.
- Reopening an attempt still works: the new attempt captures new snapshots and
  creates a new submission.

The service-role retention script only prunes submissions that already have an
`ics_scores` row. It skips unevaluated work rather than computing a score with
retention credentials.

`freed_bytes` in the report is **content bytes only**. PostgreSQL may not
return the space to the operating system until autovacuum or a manual
`VACUUM` runs, and indexes add overhead on top of the content size.

## Recommended policy

| Time                    | Action                                            |
| ----------------------- | ------------------------------------------------- |
| During an exam          | Keep everything                                   |
| After grades are final  | Keep everything for the appeal window             |
| After the appeal window | Dry run, then prune redundant auto snapshots      |
| End of term             | Prune all eligible submissions older than 30 days |

A reasonable default is to prune once per term with `--days 30`, keeping one
auto snapshot per file per hour. If the school requires a longer retention
period, increase `--days`; the function does not delete evidence that is still
inside the window.

## Future improvements

If storage still grows too quickly, the next steps are:

1. Store automatic snapshots as deltas against the previous snapshot.
2. Move old snapshot content to object storage and keep only metadata in
   PostgreSQL.
3. Add a scheduled retention job once `pg_cron` is available.
