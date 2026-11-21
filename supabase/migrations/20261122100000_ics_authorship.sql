-- 20261122100000_ics_authorship.sql
--
-- The 25-point typing term now scores authorship evidence instead of typing
-- speed. A pause is not evidence: what matters is what happens when typing
-- resumes — corrections, revisits to earlier lines, hesitation inside a line
-- — versus a complete line inserted in one uninterrupted burst ("line
-- chunk"), which is what copying from a second screen looks like.
--
-- New counters arrive from the renderer in code_snapshots.edit_stats. Snapshots
-- captured before this migration have no edit_stats, so the function falls back
-- to the previous typing-interval / session-gap estimate.
--
-- Constants mirror src/renderer/src/lib/authorship.ts:
--   pause 1500 ms, chunk >= 20 chars through the end of a line, bulk edits
--   > 30 chars ignored, confidence 8 bursts, baseline 0.70, chunk penalty
--   0.85 applied above a 0.35 chunk ratio.

alter table public.code_snapshots
  add column if not exists edit_stats jsonb;

comment on column public.code_snapshots.edit_stats is
  'Authorship counters (inserts, deletes, revisits, bursts, ...) since the previous snapshot.';

comment on column public.ics_scores.cadence_term is
  'Weighted authorship term (25 max). Historical column name: the input is authorship evidence, not typing speed.';

create or replace function public.recompute_ics(target_submission uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_student uuid;
  snapshot_count integer;
  final_chars integer;
  pasted_chars integer;
  paste_ratio numeric;
  gap_count integer;
  mean_gap numeric;
  sd_gap numeric;
  session_seconds numeric;
  active_seconds numeric;
  typing_count integer;
  typing_share numeric;
  stats_bursts integer := 0;
  stats_rework integer := 0;
  stats_revisits integer := 0;
  stats_pauses integer := 0;
  stats_mid_line integer := 0;
  stats_chunks integer := 0;
  rework_ratio numeric := 0;
  revisit_ratio numeric := 0;
  hesitation_ratio numeric := 0;
  chunk_ratio numeric := 0;
  authorship_raw numeric;
  authorship numeric;
  focus_raw numeric;
  focus numeric;
  compilation numeric;
  run_count integer;
  run_passed integer;
  paste_term numeric;
  cadence_term numeric;
  focus_term numeric;
  compilation_term numeric;
  total numeric;
  band text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to recompute integrity scores.';
  end if;

  if not public.is_professor_of_submission(target_submission) then
    raise exception 'You do not teach the class for this submission.';
  end if;

  select submissions.student_id
    into target_student
    from public.submissions
    where submissions.id = target_submission;

  if target_student is null then
    raise exception 'Submission not found.';
  end if;

  select count(*), max(code_snapshots.char_count)
    into snapshot_count, final_chars
    from public.code_snapshots
    where code_snapshots.submission_id = target_submission;

  if snapshot_count = 0 then
    raise exception 'This submission has no captured snapshots to score.';
  end if;

  -- Count only text that did not already exist in an earlier snapshot of this
  -- submission. Cut/copy/paste moves and duplicates of the student's own code
  -- are therefore not scored as external paste evidence.
  select coalesce(sum(paste_events.pasted_chars), 0)
    into pasted_chars
    from public.paste_events
    join public.code_snapshots as paste_snapshot
      on paste_snapshot.id = paste_events.snapshot_id
    where paste_snapshot.submission_id = target_submission
      and not exists (
        select 1
        from public.code_snapshots as earlier
        where earlier.submission_id = target_submission
          and earlier.id <> paste_snapshot.id
          and (
            earlier.created_at < paste_snapshot.created_at
            or (
              earlier.created_at = paste_snapshot.created_at
              and earlier.version < paste_snapshot.version
            )
          )
          and position(paste_events.pasted_text in earlier.content) > 0
      );

  paste_ratio := case
    when greatest(coalesce(final_chars, 0), pasted_chars, 1) = 0 then 0
    else pasted_chars::numeric / greatest(coalesce(final_chars, 0), pasted_chars, 1)
  end;
  paste_ratio := least(1, greatest(0, paste_ratio));

  -- Session snapshot gaps. Gaps over 30 minutes are treated as breaks, not
  -- activity, so an old unattached snapshot cannot poison the score.
  with ordered as (
    select
      code_snapshots.created_at,
      lag(code_snapshots.created_at) over (order by code_snapshots.created_at) as previous_at
    from public.code_snapshots
    where code_snapshots.submission_id = target_submission
  ),
  gaps as (
    select extract(epoch from (ordered.created_at - ordered.previous_at)) as seconds
    from ordered
    where ordered.previous_at is not null
      and ordered.created_at > ordered.previous_at
      and extract(epoch from (ordered.created_at - ordered.previous_at)) <= 1800
  )
  select
    count(*)::integer,
    avg(gaps.seconds),
    stddev_pop(gaps.seconds),
    coalesce(sum(gaps.seconds), 0),
    -- A pause up to 5 minutes is thinking, not abandonment.
    coalesce(sum(case when gaps.seconds <= 300 then gaps.seconds else 0 end), 0)
    into gap_count, mean_gap, sd_gap, session_seconds, active_seconds
  from gaps;

  -- Authorship from the edit counters the tracker now records.
  select
    coalesce(sum((code_snapshots.edit_stats ->> 'bursts')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'reworkBursts')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'revisits')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'pauses')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'midLinePauses')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'chunkBursts')::integer), 0)
    into stats_bursts, stats_rework, stats_revisits, stats_pauses, stats_mid_line, stats_chunks
  from public.code_snapshots
  where code_snapshots.submission_id = target_submission
    and code_snapshots.edit_stats is not null;

  if stats_bursts > 0 then
    rework_ratio := stats_rework::numeric / stats_bursts;
    revisit_ratio := least(1, stats_revisits::numeric / stats_bursts);
    hesitation_ratio := case
      when stats_pauses > 0 then stats_mid_line::numeric / stats_pauses
      else 0
    end;
    chunk_ratio := stats_chunks::numeric / greatest(stats_pauses, 1);

    authorship_raw := 100 * least(1, greatest(0,
      0.70
      + 0.30 * rework_ratio
      + 0.20 * revisit_ratio
      + 0.10 * hesitation_ratio
      - 0.85 * greatest(0, chunk_ratio - 0.35)
    ));
    -- Fewer than eight bursts is weak evidence: pull toward neutral 50.
    authorship := 50 + (authorship_raw - 50) * least(1, stats_bursts::numeric / 8);
  else
    -- Legacy submissions: no edit counters, so keep the previous estimate.
    select
      count(*)::integer,
      avg(case when samples.interval_ms <= 1500 then 1 else 0 end)
      into typing_count, typing_share
    from public.code_snapshots
    cross join lateral unnest(
      coalesce(code_snapshots.typing_intervals, '{}'::integer[])
    ) as samples(interval_ms)
    where code_snapshots.submission_id = target_submission;

    if typing_count is not null and typing_count > 0 and typing_share is not null then
      authorship := 100 * typing_share;
    elsif gap_count is not null and gap_count >= 2 and mean_gap is not null and mean_gap > 0 then
      authorship := 100 * least(1, greatest(0, 1 - coalesce(sd_gap, 0) / mean_gap));
      authorship := 50 + (authorship - 50) * least(1, gap_count::numeric / 4);
    else
      authorship := 50;
    end if;
  end if;

  if gap_count is null or gap_count = 0 or session_seconds <= 0 then
    focus := 50;
  else
    focus_raw := 100 * least(1, greatest(0, active_seconds / session_seconds));
    focus := 50 + (focus_raw - 50) * least(1, gap_count::numeric / 4);
  end if;

  with latest_runs as (
    select distinct on (code_runs.test_case_id)
      code_runs.test_case_id,
      code_runs.passed
    from public.code_runs
    where code_runs.submission_id = target_submission
      and code_runs.test_case_id is not null
      and code_runs.passed is not null
    order by code_runs.test_case_id, code_runs.created_at desc
  )
  select
    count(*)::integer,
    count(*) filter (where latest_runs.passed)::integer
    into run_count, run_passed
  from latest_runs;

  if run_count is null or run_count = 0 then
    compilation := 50;
  else
    compilation := 100 * run_passed::numeric / run_count;
  end if;

  paste_term := round(100 * 0.35 * (1 - paste_ratio), 2);
  cadence_term := round(100 * 0.25 * (authorship / 100), 2);
  focus_term := round(100 * 0.2 * (focus / 100), 2);
  compilation_term := round(100 * 0.2 * (compilation / 100), 2);
  total := round(paste_term + cadence_term + focus_term + compilation_term, 2);
  band := case when total >= 80 then 'pass' when total >= 60 then 'review' else 'flag' end;

  -- A strong line-chunk pattern cannot pass, no matter how the free terms add
  -- up. Paste has its own term, so this only applies when almost nothing was
  -- pasted.
  if stats_bursts >= 8 and paste_ratio < 0.2 then
    if chunk_ratio >= 0.7
       and rework_ratio <= 0.05
       and revisit_ratio <= 0.1
       and hesitation_ratio <= 0.15 then
      band := 'flag';
    elsif chunk_ratio >= 0.5 and rework_ratio <= 0.10 and band = 'pass' then
      band := 'review';
    end if;
  end if;

  insert into public.ics_scores (
    submission_id,
    paste_term,
    cadence_term,
    focus_term,
    compilation_term,
    ics,
    band,
    computed_at
  )
  values (
    target_submission,
    paste_term,
    cadence_term,
    focus_term,
    compilation_term,
    total,
    band,
    now()
  )
  on conflict (submission_id) do update
    set paste_term = excluded.paste_term,
        cadence_term = excluded.cadence_term,
        focus_term = excluded.focus_term,
        compilation_term = excluded.compilation_term,
        ics = excluded.ics,
        band = excluded.band,
        computed_at = excluded.computed_at;
end;
$$;

revoke all on function public.recompute_ics(uuid) from public, anon;
grant execute on function public.recompute_ics(uuid) to authenticated, service_role;
