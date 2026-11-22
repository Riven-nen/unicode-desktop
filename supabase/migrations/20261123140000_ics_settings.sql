-- 20261123140000_ics_settings.sql
--
-- Admin-adjustable ICS metric. The v3 base calculation still gathers the
-- evidence; this migration adds a global settings row and re-scores the
-- evidence with the configured weights and band thresholds.
--
-- Defaults reproduce the shipped v3 metric exactly.

create table if not exists public.ics_settings (
  id smallint primary key default 1 check (id = 1),
  version integer not null default 1,
  base_score numeric(5, 2) not null default 50,
  min_score numeric(5, 2) not null default 5,
  max_score numeric(5, 2) not null default 95,
  authored_weight numeric(6, 3) not null default 45,
  paste_weight numeric(6, 3) not null default 0.9,
  transcription_weight numeric(6, 3) not null default 0.8,
  rhythm_weight numeric(6, 3) not null default 0.2,
  away_weight numeric(6, 3) not null default 0.3,
  similarity_weight numeric(6, 3) not null default 0.5,
  pass_threshold numeric(5, 2) not null default 80,
  review_threshold numeric(5, 2) not null default 40,
  pass_min_chars integer not null default 300,
  min_confidence numeric(4, 3) not null default 0.3,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint ics_settings_score_range
    check (min_score >= 0 and max_score <= 100 and min_score < max_score),
  constraint ics_settings_base_range
    check (base_score between 0 and 100),
  constraint ics_settings_authored_weight
    check (authored_weight between 0 and 100),
  constraint ics_settings_negative_weights
    check (
      paste_weight between 0 and 2
      and transcription_weight between 0 and 2
      and rhythm_weight between 0 and 2
      and away_weight between 0 and 2
      and similarity_weight between 0 and 2
    ),
  constraint ics_settings_band_order
    check (review_threshold >= 0 and pass_threshold <= 100 and review_threshold < pass_threshold),
  constraint ics_settings_pass_chars
    check (pass_min_chars between 0 and 100000),
  constraint ics_settings_confidence
    check (min_confidence between 0 and 1)
);

insert into public.ics_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.ics_scores
  add column if not exists settings_version integer,
  add column if not exists settings_snapshot jsonb;

comment on table public.ics_settings is
  'Single-row global ICS v3 metric configuration. Only admins can change it.';
comment on column public.ics_scores.settings_version is
  'ICS settings version used for this score.';
comment on column public.ics_scores.settings_snapshot is
  'Snapshot of the ICS settings used for this score.';

alter table public.ics_settings enable row level security;

drop policy if exists "ics_settings_admin_read" on public.ics_settings;
create policy "ics_settings_admin_read"
  on public.ics_settings for select to authenticated
  using (public.is_admin());

revoke all on public.ics_settings from anon, authenticated;
grant select on public.ics_settings to authenticated;
grant all on public.ics_settings to service_role;

-- Add the raw counts the settings-aware scorer needs. These are derived from
-- snapshot telemetry, never from student code.
create or replace function public.enrich_ics_evidence(target_submission uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_bursts integer := 0;
  v_snapshot_count integer := 0;
  v_operations integer := 0;
begin
  select
    coalesce(sum(coalesce((code_snapshots.edit_stats ->> 'insertedChars')::integer, 0)), 0),
    coalesce(sum(coalesce((code_snapshots.edit_stats ->> 'bursts')::integer, 0)), 0),
    count(*)::integer,
    coalesce(sum(
      coalesce((code_snapshots.edit_stats ->> 'inserts')::integer, 0)
      + coalesce((code_snapshots.edit_stats ->> 'fixes')::integer, 0)
      + coalesce((code_snapshots.edit_stats ->> 'reworks')::integer, 0)
    ), 0)
    into v_inserted, v_bursts, v_snapshot_count, v_operations
  from public.code_snapshots
  where code_snapshots.submission_id = target_submission;

  update public.ics_scores
  set evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object(
    'inserted_chars', v_inserted,
    'bursts', v_bursts,
    'snapshot_count', v_snapshot_count,
    'operations', v_operations,
    'base_score', ics,
    'base_band', band,
    'base_confidence', confidence
  )
  where submission_id = target_submission
    and model = 'v3';
end;
$$;

-- Re-score a stored v3 evidence ledger with the current admin settings.
-- This is safe to run after snapshots have been pruned because it reads only
-- the stored evidence row, not the snapshots.
create or replace function public.apply_ics_settings(target_submission uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  cfg public.ics_settings%rowtype;
  score_row public.ics_scores%rowtype;
  v_evidence jsonb;
  v_authored numeric;
  v_paste numeric;
  v_transcription numeric;
  v_rhythm numeric;
  v_away numeric;
  v_similarity numeric;
  v_e_minus numeric;
  v_score numeric;
  v_band text;
  v_reason text;
  v_inserted integer;
  v_bursts integer;
  v_confidence numeric;
  v_review_floor boolean := false;
  v_flag boolean := false;
  v_rules text[] := '{}';
begin
  select * into cfg from public.ics_settings where id = 1;

  select * into score_row
    from public.ics_scores
    where submission_id = target_submission;

  if score_row.submission_id is null then
    return;
  end if;

  if score_row.model is distinct from 'v3' or score_row.evidence is null then
    if score_row.exam_mode then
      update public.ics_scores
      set band_reason = concat_ws(
        ' ',
        band_reason,
        'Exam mode: paste is blocked and treated as N/A.'
      )
      where submission_id = target_submission
        and band_reason not like '%Exam mode:%';
    end if;
    return;
  end if;

  v_evidence := score_row.evidence;
  v_authored := coalesce((v_evidence ->> 'authored')::numeric, 0);
  v_paste := coalesce((v_evidence ->> 'paste')::numeric, 0);
  v_transcription := coalesce((v_evidence ->> 'transcription')::numeric, 0);
  v_rhythm := coalesce((v_evidence ->> 'rhythm')::numeric, 0);
  v_away := coalesce((v_evidence ->> 'away')::numeric, 0);
  v_similarity := coalesce((v_evidence ->> 'similarity')::numeric, 0);
  v_inserted := coalesce((v_evidence ->> 'inserted_chars')::integer, 0);
  v_bursts := coalesce((v_evidence ->> 'bursts')::integer, 0);
  v_confidence := coalesce(
    (v_evidence ->> 'base_confidence')::numeric,
    score_row.confidence,
    0
  );

  if score_row.exam_mode then
    v_paste := 0;
  end if;

  v_e_minus := least(1, greatest(0,
    cfg.paste_weight * v_paste
    + cfg.transcription_weight * v_transcription
    + cfg.rhythm_weight * v_rhythm
    + cfg.away_weight * v_away
    + cfg.similarity_weight * v_similarity
  ));

  v_score := round(least(
    cfg.max_score,
    greatest(
      cfg.min_score,
      cfg.base_score + cfg.authored_weight * (v_authored - v_e_minus)
    )
  ), 1);

  -- Hard rules mirror the base model. Settings change the weights and bands,
  -- not whether a dominant novel paste or a corroborated transcription flag.
  if v_paste >= 0.8 and v_authored <= 0.2 then
    v_review_floor := true;
    v_rules := array_append(v_rules, 'novel_paste_without_authorship');
    if v_paste >= 0.99 and v_authored <= 0.01 then
      v_flag := true;
      v_rules := array_append(v_rules, 'novel_paste_dominant');
    end if;
  end if;

  if v_transcription >= 0.7
     and v_authored <= 0.15
     and v_inserted >= 120 then
    v_review_floor := true;
    v_rules := array_append(v_rules, 'transcription_pattern');
    if v_away >= 0.5 then
      v_flag := true;
      v_rules := array_append(v_rules, 'transcription_after_refocus');
    end if;
  end if;

  if v_similarity >= 0.9 and v_paste >= 0.5 then
    v_flag := true;
    v_rules := array_append(v_rules, 'similar_submission_and_paste');
  end if;

  if v_flag then
    v_band := 'flag';
    v_reason := case
      when v_transcription >= 0.7
        then 'Line-chunk transcription with corroborating away/resume evidence.'
      when v_paste >= 0.99
        then 'Nearly all inserted text came from novel paste.'
      else 'Paste and cross-submission similarity agree.'
    end;
  elsif v_review_floor then
    v_band := 'review';
    v_reason := case
      when v_paste >= 0.8
        then 'Novel paste exceeds the allowance without authored evidence.'
      else 'Line-chunk transcription pattern without corroboration.'
    end;
  elsif v_confidence < cfg.min_confidence then
    v_band := 'review';
    v_reason := format(
      'Limited evidence: %s chars and %s bursts.',
      v_inserted,
      v_bursts
    );
  elsif v_score >= cfg.pass_threshold and v_inserted < cfg.pass_min_chars then
    v_band := 'review';
    v_reason := format(
      'Short submission: %s chars; a pass needs %s.',
      v_inserted,
      cfg.pass_min_chars
    );
  elsif v_score >= cfg.pass_threshold then
    v_band := 'pass';
    v_reason := 'Authored evidence outweighs the negative signals.';
  elsif v_score >= cfg.review_threshold then
    v_band := 'review';
    v_reason := 'Mixed evidence; review recommended.';
  else
    v_band := 'flag';
    v_reason := 'Negative evidence outweighs authored evidence.';
  end if;

  if score_row.exam_mode then
    v_reason := concat_ws(
      ' ',
      v_reason,
      'Exam mode: paste is blocked and treated as N/A.'
    );
  end if;

  update public.ics_scores
  set ics = v_score,
      band = v_band,
      band_reason = v_reason,
      evidence = v_evidence || jsonb_build_object(
        'e_minus', round(v_e_minus, 4),
        'rules', to_jsonb(v_rules)
      ),
      settings_version = cfg.version,
      settings_snapshot = to_jsonb(cfg)
  where submission_id = target_submission;
end;
$$;

revoke all on function public.enrich_ics_evidence(uuid) from public, anon, authenticated;
grant execute on function public.enrich_ics_evidence(uuid) to service_role;
revoke all on function public.apply_ics_settings(uuid) from public, anon, authenticated;
grant execute on function public.apply_ics_settings(uuid) to service_role;

-- The exam wrapper now enriches the evidence and applies the current metric.
create or replace function public.recompute_ics_exam(target_submission uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.recompute_ics_base(target_submission);

  if exists (
    select 1
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.id = target_submission
      and a.kind = 'seatwork'
  ) then
    update public.ics_scores
    set exam_mode = true,
        evidence = jsonb_set(
          coalesce(evidence, '{}'::jsonb),
          '{paste}',
          '0'::jsonb,
          true
        )
    where submission_id = target_submission;
  end if;

  perform public.enrich_ics_evidence(target_submission);
  perform public.apply_ics_settings(target_submission);
end;
$$;

revoke all on function public.recompute_ics_exam(uuid) from public, anon, authenticated;
grant execute on function public.recompute_ics_exam(uuid) to service_role;

-- Admin API ----------------------------------------------------------------

create or replace function public.admin_fetch_ics_settings()
returns table (
  id smallint,
  version integer,
  base_score numeric,
  min_score numeric,
  max_score numeric,
  authored_weight numeric,
  paste_weight numeric,
  transcription_weight numeric,
  rhythm_weight numeric,
  away_weight numeric,
  similarity_weight numeric,
  pass_threshold numeric,
  review_threshold numeric,
  pass_min_chars integer,
  min_confidence numeric,
  updated_at timestamptz,
  updated_by uuid,
  updated_by_email text
)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an admin can read ICS settings.';
  end if;

  return query
    select
      s.id,
      s.version,
      s.base_score,
      s.min_score,
      s.max_score,
      s.authored_weight,
      s.paste_weight,
      s.transcription_weight,
      s.rhythm_weight,
      s.away_weight,
      s.similarity_weight,
      s.pass_threshold,
      s.review_threshold,
      s.pass_min_chars,
      s.min_confidence,
      s.updated_at,
      s.updated_by,
      p.email
    from public.ics_settings s
    left join public.profiles p on p.id = s.updated_by
    where s.id = 1;
end;
$$;

create or replace function public.admin_update_ics_settings(
  new_base_score numeric,
  new_min_score numeric,
  new_max_score numeric,
  new_authored_weight numeric,
  new_paste_weight numeric,
  new_transcription_weight numeric,
  new_rhythm_weight numeric,
  new_away_weight numeric,
  new_similarity_weight numeric,
  new_pass_threshold numeric,
  new_review_threshold numeric,
  new_pass_min_chars integer,
  new_min_confidence numeric
)
returns table (
  id smallint,
  version integer,
  base_score numeric,
  min_score numeric,
  max_score numeric,
  authored_weight numeric,
  paste_weight numeric,
  transcription_weight numeric,
  rhythm_weight numeric,
  away_weight numeric,
  similarity_weight numeric,
  pass_threshold numeric,
  review_threshold numeric,
  pass_min_chars integer,
  min_confidence numeric,
  updated_at timestamptz,
  updated_by uuid,
  updated_by_email text
)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an admin can change ICS settings.';
  end if;
  if new_min_score is null or new_max_score is null
     or new_min_score < 0 or new_max_score > 100
     or new_min_score >= new_max_score then
    raise exception 'The score floor must be below the ceiling, within 0-100.';
  end if;
  if new_base_score is null or new_base_score < 0 or new_base_score > 100 then
    raise exception 'The base score must be between 0 and 100.';
  end if;
  if new_authored_weight is null
     or new_authored_weight < 0 or new_authored_weight > 100 then
    raise exception 'The authored weight must be between 0 and 100.';
  end if;
  if new_paste_weight is null or new_paste_weight < 0 or new_paste_weight > 2
     or new_transcription_weight is null
     or new_transcription_weight < 0 or new_transcription_weight > 2
     or new_rhythm_weight is null or new_rhythm_weight < 0 or new_rhythm_weight > 2
     or new_away_weight is null or new_away_weight < 0 or new_away_weight > 2
     or new_similarity_weight is null
     or new_similarity_weight < 0 or new_similarity_weight > 2 then
    raise exception 'Negative-evidence weights must be between 0 and 2.';
  end if;
  if new_review_threshold is null or new_pass_threshold is null
     or new_review_threshold < 0 or new_pass_threshold > 100
     or new_review_threshold >= new_pass_threshold then
    raise exception 'The pass threshold must be above the review threshold, within 0-100.';
  end if;
  if new_pass_min_chars is null
     or new_pass_min_chars < 0 or new_pass_min_chars > 100000 then
    raise exception 'The pass minimum must be between 0 and 100000 characters.';
  end if;
  if new_min_confidence is null
     or new_min_confidence < 0 or new_min_confidence > 1 then
    raise exception 'The minimum confidence must be between 0 and 1.';
  end if;

  update public.ics_settings
  set base_score = new_base_score,
      min_score = new_min_score,
      max_score = new_max_score,
      authored_weight = new_authored_weight,
      paste_weight = new_paste_weight,
      transcription_weight = new_transcription_weight,
      rhythm_weight = new_rhythm_weight,
      away_weight = new_away_weight,
      similarity_weight = new_similarity_weight,
      pass_threshold = new_pass_threshold,
      review_threshold = new_review_threshold,
      pass_min_chars = new_pass_min_chars,
      min_confidence = new_min_confidence,
      version = public.ics_settings.version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where public.ics_settings.id = 1;

  return query
    select
      s.id,
      s.version,
      s.base_score,
      s.min_score,
      s.max_score,
      s.authored_weight,
      s.paste_weight,
      s.transcription_weight,
      s.rhythm_weight,
      s.away_weight,
      s.similarity_weight,
      s.pass_threshold,
      s.review_threshold,
      s.pass_min_chars,
      s.min_confidence,
      s.updated_at,
      s.updated_by,
      p.email
    from public.ics_settings s
    left join public.profiles p on p.id = s.updated_by
    where s.id = 1;
end;
$$;

create or replace function public.admin_reapply_ics_settings()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  score_row record;
  updated integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an admin can apply ICS settings.';
  end if;

  for score_row in
    select submission_id
    from public.ics_scores
    where model = 'v3'
  loop
    perform public.apply_ics_settings(score_row.submission_id);
    update public.ics_scores
    set computed_at = now()
    where submission_id = score_row.submission_id
      and model = 'v3';
    updated := updated + 1;
  end loop;

  return updated;
end;
$$;

revoke all on function public.admin_fetch_ics_settings() from public, anon;
grant execute on function public.admin_fetch_ics_settings() to authenticated, service_role;
revoke all on function public.admin_update_ics_settings(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, integer, numeric
) from public, anon;
grant execute on function public.admin_update_ics_settings(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, integer, numeric
) to authenticated, service_role;
revoke all on function public.admin_reapply_ics_settings() from public, anon;
grant execute on function public.admin_reapply_ics_settings() to authenticated, service_role;
