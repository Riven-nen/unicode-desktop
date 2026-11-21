-- 20261123100000_exam_operations.sql
--
-- Finish the exam operations loop:
--   * professors can reopen a terminal attempt with a fresh deadline
--   * monitor events/sessions stream over Realtime
--   * override reasons and reopen counts are auditable

alter table public.assessment_sessions
  add column if not exists reopen_count integer not null default 0;

alter table public.assessment_overrides
  drop constraint if exists assessment_overrides_action_check;
alter table public.assessment_overrides
  add constraint assessment_overrides_action_check
  check (action in ('extend_time', 'excuse_interruption', 'reopen'));

create or replace function public.apply_assessment_override(
  target_session uuid,
  override_action text,
  override_minutes integer default null,
  override_reason text default null
)
returns table (
  status text,
  expires_at timestamptz,
  interruption_count integer,
  override_note text,
  override_at timestamptz,
  server_now timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare
  current_professor uuid := auth.uid();
  session_row public.assessment_sessions%rowtype;
  v_expires timestamptz;
begin
  if current_professor is null then
    raise exception 'Sign in to apply an override.';
  end if;
  select * into session_row
    from public.assessment_sessions
    where id = target_session
    for update;
  if session_row.id is null then
    raise exception 'Assessment session not found.';
  end if;
  if not public.is_professor_of_assignment(session_row.assignment_id) then
    raise exception 'You do not teach the class for this assessment.';
  end if;

  if override_action = 'extend_time' then
    if session_row.status <> 'active' then
      raise exception 'Only an active session can be extended.';
    end if;
    if override_minutes is null or override_minutes < 1 or override_minutes > 240 then
      raise exception 'Choose an extension between 1 and 240 minutes.';
    end if;
    v_expires := greatest(now(), coalesce(session_row.expires_at, now()))
      + make_interval(mins => override_minutes);
    update public.assessment_sessions
    set expires_at = v_expires,
        override_note = coalesce(override_reason, 'Time extended by professor.'),
        override_at = now(),
        override_by = current_professor
    where id = target_session
    returning * into session_row;
  elsif override_action = 'excuse_interruption' then
    if session_row.status <> 'active' then
      raise exception 'Only an active session can be excused.';
    end if;
    update public.assessment_sessions
    set tab_out_count = 0,
        fullscreen_exit_count = 0,
        interruption_count = 0,
        override_note = coalesce(override_reason, 'Interruptions excused by professor.'),
        override_at = now(),
        override_by = current_professor
    where id = target_session
    returning * into session_row;
  elsif override_action = 'reopen' then
    if session_row.status = 'active' then
      raise exception 'This session is already active.';
    end if;
    v_expires := now() + make_interval(mins => coalesce(override_minutes, 10));
    update public.assessment_sessions
    set status = 'active',
        started_at = now(),
        expires_at = v_expires,
        submitted_at = null,
        final_submission_id = null,
        tab_out_count = 0,
        fullscreen_exit_count = 0,
        interruption_count = 0,
        blocked_paste_count = 0,
        reopen_count = reopen_count + 1,
        override_note = coalesce(override_reason, 'Attempt reopened by professor.'),
        override_at = now(),
        override_by = current_professor
    where id = target_session
    returning * into session_row;
  else
    raise exception 'Unknown override action.';
  end if;

  insert into public.assessment_overrides (
    session_id, professor_id, action, minutes, reason
  )
  values (
    target_session, current_professor, override_action, override_minutes, override_reason
  );
  insert into public.assessment_events (session_id, student_id, event_type, metadata)
  values (
    target_session,
    session_row.student_id,
    'override',
    jsonb_build_object(
      'action', override_action,
      'minutes', override_minutes,
      'reason', override_reason,
      'professor_id', current_professor
    )
  );

  return query
    select session_row.status, session_row.expires_at, session_row.interruption_count,
           session_row.override_note, session_row.override_at, now();
end;
$$;

revoke all on function public.apply_assessment_override(uuid, text, integer, text) from public, anon;
grant execute on function public.apply_assessment_override(uuid, text, integer, text) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'assessment_sessions'
  ) then
    alter publication supabase_realtime add table public.assessment_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'assessment_events'
  ) then
    alter publication supabase_realtime add table public.assessment_events;
  end if;
end $$;
