-- 20261123150000_interruption_key.sql
--
-- Exam interruption lock. A tab-out or fullscreen exit now requires a
-- professor-issued resume key plus a student explanation before the attempt can
-- continue. The interruption count is not reset, so the next interruption can
-- still auto-submit.

alter table public.assessment_events
  drop constraint if exists assessment_events_event_type_check;
alter table public.assessment_events
  add constraint assessment_events_event_type_check
  check (event_type in (
    'tab_out', 'fullscreen_exit', 'paste_blocked', 'warning', 'focus_return',
    'override', 'auto_submit', 'interruption_excused'
  ));

alter table public.assessment_override_codes
  drop constraint if exists assessment_override_codes_action_check;
alter table public.assessment_override_codes
  add constraint assessment_override_codes_action_check
  check (action in ('extend_time', 'excuse_interruption', 'reopen', 'resume_interruption'));

alter table public.assessment_overrides
  drop constraint if exists assessment_overrides_action_check;
alter table public.assessment_overrides
  add constraint assessment_overrides_action_check
  check (action in ('extend_time', 'excuse_interruption', 'reopen', 'resume_interruption'));

create or replace function public.create_assessment_override_code(
  target_session uuid,
  override_action text,
  override_minutes integer default null,
  override_reason text default null,
  valid_minutes integer default 15
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  current_professor uuid := auth.uid();
  session_row public.assessment_sessions%rowtype;
  v_code text;
begin
  if current_professor is null then raise exception 'Sign in to create an override code.'; end if;
  if valid_minutes is null or valid_minutes < 1 or valid_minutes > 1440 then
    raise exception 'Choose a validity between 1 and 1440 minutes.';
  end if;

  select * into session_row from public.assessment_sessions where id = target_session;
  if session_row.id is null then raise exception 'Assessment session not found.'; end if;
  if not public.is_professor_of_assignment(session_row.assignment_id) then
    raise exception 'You do not teach the class for this assessment.';
  end if;
  if override_action not in (
    'extend_time', 'excuse_interruption', 'reopen', 'resume_interruption'
  ) then
    raise exception 'Unknown override action.';
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.assessment_override_codes (
    session_id, professor_id, code_hash, action, minutes, reason, expires_at
  )
  values (
    target_session, current_professor, md5(v_code), override_action, override_minutes,
    override_reason, now() + make_interval(mins => valid_minutes)
  );
  return v_code;
end;
$$;

revoke all on function public.create_assessment_override_code(uuid, text, integer, text, integer)
  from public, anon;
grant execute on function public.create_assessment_override_code(uuid, text, integer, text, integer)
  to authenticated, service_role;

drop function if exists public.redeem_interruption_key(uuid, text, text);

create or replace function public.redeem_interruption_key(
  target_session uuid,
  override_code text
)
returns table (status text, expires_at timestamptz, server_now timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  current_student uuid := auth.uid();
  session_row public.assessment_sessions%rowtype;
  code_row public.assessment_override_codes%rowtype;
begin
  if current_student is null then
    raise exception 'Sign in to continue this assessment.';
  end if;

  select * into session_row
    from public.assessment_sessions
    where id = target_session
    for update;

  if session_row.id is null or session_row.student_id <> current_student then
    raise exception 'Assessment session not found.';
  end if;
  if session_row.status <> 'active' then
    raise exception 'This assessment is no longer active.';
  end if;

  select * into code_row
    from public.assessment_override_codes
    where session_id = target_session
      and code_hash = md5(upper(trim(override_code)))
      and action = 'resume_interruption'
      and used_at is null
      and expires_at > now()
    order by created_at desc
    limit 1;

  if code_row.id is null then
    raise exception 'That key is invalid, expired, or already used.';
  end if;

  update public.assessment_override_codes
  set used_at = now(), used_by = current_student
  where id = code_row.id;

  insert into public.assessment_overrides (session_id, professor_id, action, minutes, reason)
  values (
    target_session,
    code_row.professor_id,
    'resume_interruption',
    null,
    coalesce(code_row.reason, 'Student resumed after an interruption.')
  );

  insert into public.assessment_events (session_id, student_id, event_type, metadata)
  values (
    target_session,
    current_student,
    'interruption_excused',
    jsonb_build_object(
      'via', 'one_time_code',
      'code_id', code_row.id
    )
  );

  return query select session_row.status, session_row.expires_at, now();
end;
$$;

revoke all on function public.redeem_interruption_key(uuid, text) from public, anon;
grant execute on function public.redeem_interruption_key(uuid, text)
  to authenticated, service_role;
