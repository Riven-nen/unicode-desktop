-- 20261120160000_professor_insights.sql
--
-- Data needed by the professor insight views:
--   * typing intervals on snapshots (cadence heatmap)
--   * student presence heartbeats (Live Lab)
--   * a class-scoped paste-similarity RPC (pg_trgm)

alter table public.code_snapshots
  add column if not exists typing_intervals integer[];

-- Live Lab presence ---------------------------------------------------------

create table if not exists public.student_presence (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  current_file text,
  status text not null default 'idle'
    check (status in ('active', 'idle', 'flagged')),
  idle_seconds integer not null default 0 check (idle_seconds >= 0),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_presence_seen_idx
  on public.student_presence (last_seen_at desc);

alter table public.student_presence enable row level security;

create policy "student_presence_select_own_or_class_professor"
  on public.student_presence
  for select to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1
        from public.enrollments e
        join public.classes c on c.id = e.class_id
       where e.student_id = student_presence.student_id
         and c.professor_id = auth.uid()
    )
  );

create policy "student_presence_insert_own"
  on public.student_presence
  for insert to authenticated
  with check (student_id = auth.uid());

create policy "student_presence_update_own"
  on public.student_presence
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

revoke all on public.student_presence from anon;
grant select, insert, update on public.student_presence to authenticated;
grant all on public.student_presence to service_role;

create or replace function public.touch_student_presence(
  current_file text,
  current_status text,
  current_idle_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Sign in to update presence.';
  end if;
  if current_status not in ('active', 'idle', 'flagged') then
    raise exception 'Unknown presence status.';
  end if;

  insert into public.student_presence (
    student_id,
    current_file,
    status,
    idle_seconds,
    last_seen_at,
    updated_at
  )
  values (
    actor,
    nullif(left(trim(coalesce(current_file, '')), 300), ''),
    current_status,
    greatest(coalesce(current_idle_seconds, 0), 0),
    now(),
    now()
  )
  on conflict (student_id) do update
    set current_file = excluded.current_file,
        status = excluded.status,
        idle_seconds = excluded.idle_seconds,
        last_seen_at = now(),
        updated_at = now();
end;
$$;

revoke all on function public.touch_student_presence(text, text, integer)
  from public, anon;
grant execute on function public.touch_student_presence(text, text, integer)
  to authenticated, service_role;

-- Paste similarity ----------------------------------------------------------

create or replace function public.professor_paste_matches(
  target_submission uuid,
  min_similarity real default 0.45
)
returns table (
  paste_id uuid,
  pasted_text text,
  paste_created_at timestamptz,
  similarity real,
  match_paste_id uuid,
  match_text text,
  match_submission_id uuid,
  match_student_id uuid,
  match_student_name text,
  match_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  target_student uuid;
  threshold real := greatest(0, least(1, coalesce(min_similarity, 0.45)));
begin
  if auth.uid() is null then
    raise exception 'Sign in to compare pastes.';
  end if;

  select a.class_id, s.student_id
    into target_class, target_student
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
   where s.id = target_submission;

  if target_class is null then
    raise exception 'Submission not found.';
  end if;
  if not public.is_professor_of_class(target_class) then
    raise exception 'You do not teach the class for this submission.';
  end if;

  return query
    select distinct on (target.paste_id)
      target.paste_id,
      target.pasted_text,
      target.paste_created_at,
      similarity(target.pasted_text, other.pasted_text) as similarity,
      other.paste_id,
      other.pasted_text,
      other.match_submission_id,
      other.match_student_id,
      coalesce(
        nullif(trim(profile.display_name), ''),
        profile.email,
        'Student'
      ) as match_student_name,
      other.match_created_at
    from (
      select
        paste_events.id as paste_id,
        paste_events.pasted_text,
        paste_events.created_at as paste_created_at
      from public.paste_events
      join public.code_snapshots
        on code_snapshots.id = paste_events.snapshot_id
      where code_snapshots.submission_id = target_submission
        and char_length(paste_events.pasted_text) >= 20
    ) as target
    join lateral (
      select
        candidate.id as paste_id,
        candidate.pasted_text,
        candidate.created_at as match_created_at,
        candidate_snapshot.submission_id as match_submission_id,
        candidate_snapshot.user_id as match_student_id
      from public.paste_events as candidate
      join public.code_snapshots as candidate_snapshot
        on candidate_snapshot.id = candidate.snapshot_id
      join public.submissions as candidate_submission
        on candidate_submission.id = candidate_snapshot.submission_id
      join public.assignments as candidate_assignment
        on candidate_assignment.id = candidate_submission.assignment_id
      where candidate_assignment.class_id = target_class
        and candidate_submission.student_id <> target_student
        and char_length(candidate.pasted_text) >= 20
        and similarity(target.pasted_text, candidate.pasted_text) >= threshold
      order by similarity(target.pasted_text, candidate.pasted_text) desc
      limit 1
    ) as other on true
    join public.profiles as profile on profile.id = other.match_student_id
    order by target.paste_id, similarity(target.pasted_text, other.pasted_text) desc;
end;
$$;

revoke all on function public.professor_paste_matches(uuid, real) from public, anon;
grant execute on function public.professor_paste_matches(uuid, real)
  to authenticated, service_role;

-- Realtime for Live Lab -----------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'student_presence'
  ) then
    alter publication supabase_realtime add table public.student_presence;
  end if;
end $$;
