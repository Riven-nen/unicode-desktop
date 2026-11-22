-- 20261123130000_snapshot_retention.sql
--
-- Snapshot retention. Full-content auto snapshots are the dominant storage
-- cost, but they can only be removed after the ICS has been computed. This
-- migration freezes the stored ICS and adds a conservative, opt-in pruning
-- function that keeps every evidentiary snapshot.

alter table public.submissions
  add column if not exists snapshots_pruned_at timestamptz,
  add column if not exists snapshots_pruned_count integer not null default 0;

comment on column public.submissions.snapshots_pruned_at is
  'When redundant auto snapshots were removed after evaluation. ICS is frozen from this point.';
comment on column public.submissions.snapshots_pruned_count is
  'Number of auto snapshots removed by retention pruning.';

-- Keep the existing exam-mode wrapper callable internally, then put the
-- pruning guard in front of the public RPC. A pruned submission can no longer
-- be recomputed because its evidence inputs are intentionally incomplete.
alter function public.recompute_ics(uuid) rename to recompute_ics_exam;

create or replace function public.recompute_ics(target_submission uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  pruned_at timestamptz;
begin
  select s.snapshots_pruned_at
    into pruned_at
    from public.submissions s
    where s.id = target_submission;

  if not found then
    raise exception 'Submission not found.';
  end if;
  if pruned_at is not null then
    raise exception
      'Snapshots for this submission were pruned on %. The stored ICS is frozen and cannot be recomputed.',
      to_char(pruned_at, 'YYYY-MM-DD');
  end if;

  perform public.recompute_ics_exam(target_submission);
end;
$$;

revoke all on function public.recompute_ics(uuid) from public, anon;
grant execute on function public.recompute_ics(uuid) to authenticated, service_role;
revoke all on function public.recompute_ics_exam(uuid) from public, anon, authenticated;
grant execute on function public.recompute_ics_exam(uuid) to service_role;

-- Bulk recompute skips frozen submissions instead of failing the whole batch.
create or replace function public.recompute_ics_for_assignment(target_assignment uuid)
returns integer
language plpgsql security definer set search_path = public
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
    select s.id
    from public.submissions s
    where s.assignment_id = target_assignment
      and s.snapshots_pruned_at is null
  loop
    perform public.recompute_ics(submission_row.id);
    computed := computed + 1;
  end loop;

  return computed;
end;
$$;

revoke all on function public.recompute_ics_for_assignment(uuid) from public, anon;
grant execute on function public.recompute_ics_for_assignment(uuid) to authenticated, service_role;

-- Prune redundant auto snapshots for one submission.
--
-- Protected forever:
--   * the submission's final snapshot
--   * every paste, manual, and restore snapshot
--   * snapshots referenced by paste events or inline comments
--   * the first and last snapshot of each file
--   * the first N auto snapshots per file per hour (retain_auto_per_hour)
--
-- `dry_run` defaults to true. Callers must pass false to delete.
create or replace function public.prune_submission_snapshots(
  target_submission uuid,
  retain_auto_per_hour integer default 1,
  dry_run boolean default true
)
returns table (
  submission_id uuid,
  ics_frozen boolean,
  kept_snapshots integer,
  deleted_snapshots integer,
  freed_bytes bigint,
  already_pruned boolean
)
language plpgsql security definer set search_path = public
as $$
declare
  submission_row public.submissions%rowtype;
  v_total integer := 0;
  v_deleted integer := 0;
  v_freed bigint := 0;
  v_ics_exists boolean := false;
begin
  if retain_auto_per_hour is null
     or retain_auto_per_hour < 0
     or retain_auto_per_hour > 60 then
    raise exception 'Keep between 0 and 60 auto snapshots per file per hour.';
  end if;

  select * into submission_row
    from public.submissions
    where id = target_submission;

  if submission_row.id is null then
    raise exception 'Submission not found.';
  end if;

  if auth.uid() is not null then
    if not public.is_professor_of_submission(target_submission) then
      raise exception 'You do not teach the class for this submission.';
    end if;
  elsif coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Sign in as the professor or use the service role to prune snapshots.';
  end if;

  if submission_row.submitted_at is null then
    raise exception 'Only submitted work can be pruned.';
  end if;

  select count(*)::integer
    into v_total
    from public.code_snapshots
    where code_snapshots.submission_id = target_submission;

  if submission_row.snapshots_pruned_at is not null then
    return query select target_submission, true, v_total, 0, 0::bigint, true;
    return;
  end if;

  select exists (
    select 1
    from public.ics_scores
    where ics_scores.submission_id = target_submission
  ) into v_ics_exists;

  if not v_ics_exists then
    -- The service-role retention script must not evaluate work. A professor
    -- using the RPC can compute the score first; the script skips submissions
    -- that have not been evaluated yet.
    if auth.uid() is null then
      raise exception 'This submission has no ICS yet. Compute the ICS before pruning its snapshots.';
    end if;
    perform public.recompute_ics(target_submission);
  end if;

  -- on commit drop keeps the table scoped to this RPC transaction.
  drop table if exists prune_candidates;
  create temporary table prune_candidates on commit drop as
  with scoped as (
    select
      cs.id,
      cs.file_name,
      cs.snapshot_type,
      cs.created_at,
      octet_length(cs.content)::bigint as bytes,
      row_number() over (
        partition by cs.file_name
        order by cs.created_at asc, cs.id asc
      ) as first_rank,
      row_number() over (
        partition by cs.file_name
        order by cs.created_at desc, cs.id desc
      ) as last_rank
    from public.code_snapshots cs
    where cs.submission_id = target_submission
  ),
  hour_ranked as (
    select
      s.id,
      row_number() over (
        partition by s.file_name, date_trunc('hour', s.created_at)
        order by s.created_at asc, s.id asc
      ) as hour_rank
    from scoped s
  ),
  protected as (
    select s.id
    from scoped s
    where s.first_rank = 1
       or s.last_rank = 1
       or s.snapshot_type <> 'auto'
    union
    select h.id
    from hour_ranked h
    where h.hour_rank <= retain_auto_per_hour
    union
    select sub.final_snapshot_id
    from public.submissions sub
    where sub.id = target_submission
      and sub.final_snapshot_id is not null
    union
    select c.snapshot_id
    from public.comments c
    where c.submission_id = target_submission
      and c.snapshot_id is not null
    union
    select pe.snapshot_id
    from public.paste_events pe
    where pe.snapshot_id is not null
      and exists (select 1 from scoped s2 where s2.id = pe.snapshot_id)
  )
  select s.id, s.bytes
  from scoped s
  where s.snapshot_type = 'auto'
    and not exists (select 1 from protected p where p.id = s.id);

  select count(*)::integer, coalesce(sum(pc.bytes), 0)::bigint
    into v_deleted, v_freed
    from prune_candidates pc;

  if not dry_run and v_deleted > 0 then
    delete from public.code_snapshots cs
    using prune_candidates pc
    where cs.id = pc.id;

    update public.submissions
    set snapshots_pruned_at = now(),
        snapshots_pruned_count = snapshots_pruned_count + v_deleted
    where id = target_submission;
  end if;

  return query select
    target_submission,
    true,
    v_total - v_deleted,
    v_deleted,
    v_freed,
    false;
end;
$$;

revoke all on function public.prune_submission_snapshots(uuid, integer, boolean)
  from public, anon;
grant execute on function public.prune_submission_snapshots(uuid, integer, boolean)
  to authenticated, service_role;
