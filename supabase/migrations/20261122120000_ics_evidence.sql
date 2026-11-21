-- 20261122120000_ics_evidence.sql
--
-- ICS v3: an evidence ledger instead of a weighted sum of positive terms.
-- The score starts at 50 and moves only with evidence:
--   + authored behaviour (fixes, reworks, revisits, undo)
--   - novel paste, transcription shape, robotic rhythm, away/resume pattern,
--     cross-submission similarity
-- Confidence gates the band (limited evidence can never pass), and authored
-- evidence is capped by structural-event count and scaled by session volume.
--
-- Mirrors src/renderer/src/lib/icsEvidence.ts. Snapshots from older builds have
-- no edit counters; those submissions keep the v2 calculation and are labelled
-- model = 'v2'.

alter table public.code_snapshots
  add column if not exists focus_stats jsonb;

alter table public.ics_scores
  add column if not exists confidence numeric,
  add column if not exists evidence jsonb,
  add column if not exists band_reason text,
  add column if not exists model text not null default 'v2';

comment on column public.code_snapshots.focus_stats is
  'Window blur/return counters since the previous snapshot: { blurs, returns, awayMs }.';

comment on column public.ics_scores.evidence is
  'ICS v3 evidence values: authored, paste, transcription, rhythm, away, similarity, e_plus, e_minus.';

comment on column public.ics_scores.model is
  'Scoring model that produced this row: v2 (legacy fallback) or v3.';

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
  paste_allowance numeric;
  paste_ratio numeric;
  p_paste numeric;
  p_authored numeric;
  p_transcription numeric;
  p_rhythm numeric;
  p_away numeric;
  p_similarity numeric := 0;
  e_minus numeric;
  score numeric;
  confidence numeric;
  coverage numeric;
  review_floor boolean := false;
  flag_rule boolean := false;
  rules text[] := '{}';
  band_reason text;
  model text;
  stats_bursts integer := 0;
  stats_fixes integer := 0;
  stats_revisits integer := 0;
  stats_mid_line integer := 0;
  stats_undo integer := 0;
  stats_pauses integer := 0;
  stats_chunks integer := 0;
  stats_chunk_chars integer := 0;
  stats_reworks integer := 0;
  stats_inserted integer := 0;
  stats_inserts integer := 0;
  stats_immediate integer := 0;
  stats_returns integer := 0;
  weighted_edits numeric;
  edit_rate numeric;
  chunk_ratio numeric := 0;
  append_only numeric := 0;
  interval_count integer := 0;
  median_interval numeric;
  mean_interval numeric;
  sd_interval numeric;
  typing_count integer;
  typing_share numeric;
  gap_count integer;
  mean_gap numeric;
  sd_gap numeric;
  session_seconds numeric;
  active_seconds numeric;
  emphasis numeric;
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
  evidence_json jsonb;
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

  -- Novel paste: text that did not already exist in an earlier snapshot of
  -- this submission. Moving or duplicating your own code is not paste.
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

  -- Timed seatwork gets no paste allowance; take-home work gets 10%.
  select case when assignments.kind = 'seatwork' then 0 else 0.10 end
    into paste_allowance
    from public.submissions
    join public.assignments on assignments.id = submissions.assignment_id
    where submissions.id = target_submission;
  paste_allowance := coalesce(paste_allowance, 0.10);

  -- Authorship counters.
  select
    coalesce(sum((code_snapshots.edit_stats ->> 'bursts')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'deletes')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'reworks')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'revisits')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'midLinePauses')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'undoRedo')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'pauses')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'chunkBursts')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'chunkChars')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'insertedChars')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'inserts')::integer), 0),
    coalesce(sum((code_snapshots.edit_stats ->> 'immediateChunks')::integer), 0),
    coalesce(sum((code_snapshots.focus_stats ->> 'returns')::integer), 0)
    into stats_bursts, stats_fixes, stats_reworks, stats_revisits, stats_mid_line, stats_undo,
         stats_pauses, stats_chunks, stats_chunk_chars, stats_inserted, stats_inserts,
         stats_immediate, stats_returns
  from public.code_snapshots
  where code_snapshots.submission_id = target_submission;

  -- Typing intervals, used only for the automation check.
  select
    count(*)::integer,
    percentile_cont(0.5) within group (order by samples.interval_ms),
    avg(samples.interval_ms),
    stddev_pop(samples.interval_ms)
    into interval_count, median_interval, mean_interval, sd_interval
  from public.code_snapshots
  cross join lateral unnest(
    coalesce(code_snapshots.typing_intervals, '{}'::integer[])
  ) as samples(interval_ms)
  where code_snapshots.submission_id = target_submission;

  if stats_bursts > 0 then
    model := 'v3';

    paste_ratio := pasted_chars::numeric
      / greatest(stats_inserted + pasted_chars, 1);
    p_paste := least(1, greatest(0,
      (paste_ratio - paste_allowance)
      / greatest(0.60 - paste_allowance, 0.01)
    ));

    -- A single return to an earlier line is weak, cheap-to-produce evidence and
    -- is common in honest work, so it cannot unlock full authorship credit on
    -- its own. The cap lifts gradually across independent structural events,
    -- and short sessions are scaled down so they cannot reach the pass band.
    weighted_edits :=
      0.5 * least(stats_fixes, 5)
      + 1.5 * stats_reworks
      + 1.5 * stats_revisits
      + 1.0 * stats_undo;
    edit_rate := 100 * weighted_edits / greatest(stats_inserted, 1);
    p_authored := least(1, greatest(0, edit_rate / 2.5));
    p_authored := least(
      p_authored,
      0.5 + 0.5 * least(
        1,
        greatest(0, (stats_reworks + stats_revisits + stats_undo - 1)::numeric / 2)
      )
    );
    p_authored := p_authored * least(1, stats_inserted::numeric / 200);

    if stats_inserted >= 120 then
      chunk_ratio := stats_chunk_chars::numeric / greatest(stats_inserted, 1);
      append_only := least(1, greatest(0,
        1 - (stats_reworks + stats_undo)::numeric / (0.05 * stats_inserted + 1)
      ));
      p_transcription := least(1, greatest(0,
        chunk_ratio * (0.7 + 0.3 * append_only)
      ));
    else
      p_transcription := 0;
    end if;

    if interval_count >= 100 and median_interval is not null then
      if median_interval < 25
         or (mean_interval > 0 and coalesce(sd_interval, 0) / mean_interval < 0.05) then
        p_rhythm := 1;
      else
        p_rhythm := 0;
      end if;
    else
      p_rhythm := 0;
    end if;

    if stats_returns > 0 then
      p_away := least(1, greatest(0,
        (stats_immediate::numeric / stats_returns)
        * least(1, stats_returns::numeric / 3)
      ));
    else
      p_away := 0;
    end if;

    e_minus := least(1, greatest(0,
      0.90 * p_paste
      + 0.80 * p_transcription
      + 0.20 * p_rhythm
      + 0.30 * p_away
      + 0.50 * p_similarity
    ));
    score := round(least(95, greatest(5, 50 + 45 * (p_authored - e_minus))), 1);

    coverage := case
      when snapshot_count >= 3 then 1
      when snapshot_count = 1 then 0.6
      else 0.4
    end;
    confidence := case
      when stats_inserted < 120 then 0
      else
        least(1, stats_inserted::numeric / 300)
        * least(1, (stats_inserts + stats_fixes + stats_reworks)::numeric / 30)
        * coverage
    end;

    if p_paste >= 0.8 and p_authored <= 0.2 then
      review_floor := true;
      rules := array_append(rules, 'novel_paste_without_authorship');
      if p_paste >= 0.99 and p_authored <= 0.01 then
        flag_rule := true;
        rules := array_append(rules, 'novel_paste_dominant');
      end if;
    end if;
    if p_transcription >= 0.7
       and p_authored <= 0.15
       and stats_inserted >= 120 then
      review_floor := true;
      rules := array_append(rules, 'transcription_pattern');
      if p_away >= 0.5 then
        flag_rule := true;
        rules := array_append(rules, 'transcription_after_refocus');
      end if;
    end if;
    if p_similarity >= 0.9 and p_paste >= 0.5 then
      flag_rule := true;
      rules := array_append(rules, 'similar_submission_and_paste');
    end if;

    if flag_rule then
      band := 'flag';
      band_reason := case
        when p_transcription >= 0.7
          then 'Line-chunk transcription with corroborating away/resume evidence.'
        when p_paste >= 0.99
          then 'Nearly all inserted text came from novel paste.'
        else 'Paste and cross-submission similarity agree.'
      end;
    elsif review_floor then
      band := 'review';
      band_reason := case
        when p_paste >= 0.8
          then 'Novel paste exceeds the allowance without authored evidence.'
        else 'Line-chunk transcription pattern without corroboration.'
      end;
    elsif confidence < 0.30 then
      band := 'review';
      band_reason := format(
        'Limited evidence: %s chars and %s bursts.',
        stats_inserted,
        stats_bursts
      );
    elsif score >= 80 then
      band := 'pass';
      band_reason := 'Authored evidence outweighs the negative signals.';
    elsif score >= 40 then
      band := 'review';
      band_reason := 'Mixed evidence; review recommended.';
    else
      band := 'flag';
      band_reason := 'Negative evidence outweighs authored evidence.';
    end if;

    evidence_json := jsonb_build_object(
      'authored', round(p_authored::numeric, 4),
      'paste', round(p_paste::numeric, 4),
      'transcription', round(p_transcription::numeric, 4),
      'rhythm', round(p_rhythm::numeric, 4),
      'away', round(p_away::numeric, 4),
      'similarity', round(p_similarity::numeric, 4),
      'e_plus', round(p_authored::numeric, 4),
      'e_minus', round(e_minus::numeric, 4)
    );

    paste_term := round(35 * (1 - p_paste), 2);
    cadence_term := round(25 * p_authored, 2);
    focus_term := round(20 * (1 - p_away), 2);
    total := score;
  else
    -- Legacy submission: keep the v2 calculation so old work still scores.
    model := 'v2';

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
        and extract(epoch from (ordered.created_at - ordered.previous_at)) <= 1800
    )
    select
      count(*)::integer,
      avg(gaps.seconds),
      stddev_pop(gaps.seconds),
      coalesce(sum(gaps.seconds), 0),
      coalesce(sum(case when gaps.seconds <= 300 then gaps.seconds else 0 end), 0)
      into gap_count, mean_gap, sd_gap, session_seconds, active_seconds
    from gaps;

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
      emphasis := 100 * typing_share;
    elsif gap_count is not null and gap_count >= 2 and mean_gap is not null and mean_gap > 0 then
      emphasis := 100 * least(1, greatest(0, 1 - coalesce(sd_gap, 0) / mean_gap));
      emphasis := 50 + (emphasis - 50) * least(1, gap_count::numeric / 4);
    else
      emphasis := 50;
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
    cadence_term := round(100 * 0.25 * (emphasis / 100), 2);
    focus_term := round(100 * 0.2 * (focus / 100), 2);
    compilation_term := round(100 * 0.2 * (compilation / 100), 2);
    total := round(paste_term + cadence_term + focus_term + compilation_term, 2);
    band := case when total >= 80 then 'pass' when total >= 60 then 'review' else 'flag' end;
    band_reason := 'Legacy submission without authorship counters (v2 fallback).';
    confidence := null;
    evidence_json := null;
  end if;

  -- Judge0 is quality, not integrity, but keep the term for the analytics
  -- views and the professor quality panel.
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
  if model = 'v3' then
    compilation_term := round(20 * (compilation / 100), 2);
  end if;

  insert into public.ics_scores (
    submission_id,
    paste_term,
    cadence_term,
    focus_term,
    compilation_term,
    ics,
    band,
    computed_at,
    confidence,
    evidence,
    band_reason,
    model
  )
  values (
    target_submission,
    paste_term,
    cadence_term,
    focus_term,
    compilation_term,
    total,
    band,
    now(),
    confidence,
    evidence_json,
    band_reason,
    model
  )
  on conflict (submission_id) do update
    set paste_term = excluded.paste_term,
        cadence_term = excluded.cadence_term,
        focus_term = excluded.focus_term,
        compilation_term = excluded.compilation_term,
        ics = excluded.ics,
        band = excluded.band,
        computed_at = excluded.computed_at,
        confidence = excluded.confidence,
        evidence = excluded.evidence,
        band_reason = excluded.band_reason,
        model = excluded.model;
end;
$$;

revoke all on function public.recompute_ics(uuid) from public, anon;
grant execute on function public.recompute_ics(uuid) to authenticated, service_role;
