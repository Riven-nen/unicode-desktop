-- 20261123160000_presence_students_only.sql
--
-- Live Lab presence is student-only. A professor account starts life as a
-- student (profiles.role defaults to 'student'), so a heartbeat from the brief
-- student window used to leave a presence row behind after promotion. Ignore
-- heartbeats from any non-student actor so the row can never be created.
--
-- The Live Lab read filters on profiles.role as well, so existing stale rows
-- stop appearing without deleting history.

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

  -- Only students belong in the Live Lab. This also covers a client whose
  -- role lookup fell back to 'student' after a profile read error.
  if not exists (
    select 1
      from public.profiles
     where profiles.id = actor
       and profiles.role = 'student'
  ) then
    return;
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
