-- 20261121110000_ics_typing_rhythm.sql
--
-- Cadence was being computed from snapshot gaps. That produced false zeros
-- when a submission included an old unattached snapshot from a previous day,
-- even though the student had typed normally in the current session.
--
-- New cadence:
--   * use captured typing intervals when available;
--   * score the share of gaps at or below 1.5 seconds;
--   * fall back to session snapshot gaps for older captures.
--
-- Focus now ignores breaks longer than 30 minutes so overnight gaps do not
-- count against a student's active session.

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
  cadence numeric;
  cadence_raw numeric;
  focus numeric;
  focus_raw numeric;
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

  select coalesce(sum(paste_events.pasted_chars), 0)
    into pasted_chars
    from public.paste_events
    where paste_events.snapshot_id in (
      select code_snapshots.id
      from public.code_snapshots
      where code_snapshots.submission_id = target_submission
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
    coalesce(sum(case when gaps.seconds <= 120 then gaps.seconds else 0 end), 0)
    into gap_count, mean_gap, sd_gap, session_seconds, active_seconds
  from gaps;

  -- Typing rhythm. Each snapshot may carry edit-burst intervals; a normal
  -- typing session should not be scored as zero just because it contains a
  -- few thinking pauses.
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
    cadence_raw := 100 * typing_share;
    -- Fewer than eight intervals is weak evidence: pull toward neutral 50.
    cadence := 50 + (cadence_raw - 50) * least(1, typing_count::numeric / 8);
  elsif gap_count is not null and gap_count >= 2 and mean_gap is not null and mean_gap > 0 then
    cadence_raw := 100 * least(1, greatest(0, 1 - coalesce(sd_gap, 0) / mean_gap));
    cadence := 50 + (cadence_raw - 50) * least(1, gap_count::numeric / 4);
  else
    cadence := 50;
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
  cadence_term := round(100 * 0.25 * (cadence / 100), 2);
  focus_term := round(100 * 0.2 * (focus / 100), 2);
  compilation_term := round(100 * 0.2 * (compilation / 100), 2);
  total := round(paste_term + cadence_term + focus_term + compilation_term, 2);
  band := case when total >= 80 then 'pass' when total >= 60 then 'review' else 'flag' end;

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
