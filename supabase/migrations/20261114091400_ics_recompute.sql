-- 20261114091400_ics_recompute.sql
--
-- Real ICS pipeline. Weights match the seeded model:
--   ICS = 35 * (1 - P) + 25 * C/100 + 20 * F/100 + 20 * K/100
--
-- P (paste)  = pasted chars / max(final chars, pasted chars)
-- C (cadence) = snapshot-interval consistency, shrunk toward 50 when there
--               are fewer than five intervals
-- F (focus)   = share of elapsed time covered by gaps of <= 2 minutes
-- K (compile) = newest Judge0 result per test case, as a pass percentage;
--               neutral 50 when no test-case run exists
--
-- The score is computed server-side so every client sees the same numbers.

create or replace function public.recompute_ics(target_submission uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_student uuid;
  snapshot_count integer;
  first_at timestamptz;
  last_at timestamptz;
  final_chars integer;
  pasted_chars integer;
  paste_ratio numeric;
  gap_count integer;
  mean_gap numeric;
  sd_gap numeric;
  elapsed_seconds numeric;
  active_seconds numeric;
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

  select
    count(*),
    min(code_snapshots.created_at),
    max(code_snapshots.created_at),
    max(code_snapshots.char_count)
    into snapshot_count, first_at, last_at, final_chars
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
  )
  select
    count(*)::integer,
    avg(gaps.seconds),
    stddev_pop(gaps.seconds)
    into gap_count, mean_gap, sd_gap
  from gaps;

  elapsed_seconds := greatest(extract(epoch from (last_at - first_at)), 0);

  if gap_count is null or gap_count < 2 or mean_gap is null or mean_gap <= 0 then
    cadence := 50;
  else
    cadence_raw := 100 * least(1, greatest(0, 1 - coalesce(sd_gap, 0) / mean_gap));
    -- Two or three intervals are weak evidence: pull toward the neutral 50.
    cadence := 50 + (cadence_raw - 50) * least(1, gap_count::numeric / 4);
  end if;

  if gap_count is null or gap_count = 0 or elapsed_seconds <= 0 then
    focus := 50;
  else
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
    )
    select coalesce(sum(case when gaps.seconds <= 120 then gaps.seconds else 0 end), 0)
      into active_seconds
    from gaps;

    focus_raw := 100 * least(1, greatest(0, active_seconds / elapsed_seconds));
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

create or replace function public.recompute_ics_for_assignment(target_assignment uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  submission_row record;
  computed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to recompute integrity scores.';
  end if;

  target_class := public.class_of_assignment(target_assignment);
  if target_class is null then
    raise exception 'Assignment not found.';
  end if;
  if not public.is_professor_of_class(target_class) then
    raise exception 'You do not teach this class.';
  end if;

  for submission_row in
    select submissions.id
    from public.submissions
    where submissions.assignment_id = target_assignment
  loop
    perform public.recompute_ics(submission_row.id);
    computed := computed + 1;
  end loop;

  return computed;
end;
$$;

revoke all on function public.recompute_ics(uuid) from public, anon;
revoke all on function public.recompute_ics_for_assignment(uuid) from public, anon;
grant execute on function public.recompute_ics(uuid) to authenticated, service_role;
grant execute on function public.recompute_ics_for_assignment(uuid) to authenticated, service_role;
