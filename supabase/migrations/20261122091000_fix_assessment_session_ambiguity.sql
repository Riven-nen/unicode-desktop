-- 20261122091000_fix_assessment_session_ambiguity.sql
--
-- `session_id` is both a real column on assessment_drafts and an output
-- column of these RETURNS TABLE functions. Qualify the draft lookups so
-- PL/pgSQL does not report an ambiguous column reference.

create or replace function public.start_assessment_session(target_assignment uuid)
returns table (
  session_id uuid,
  assignment_id uuid,
  status text,
  started_at timestamptz,
  expires_at timestamptz,
  server_now timestamptz,
  draft_content text,
  draft_revision integer
)
language plpgsql security definer set search_path = public
as $$
declare
  current_student uuid := auth.uid();
  assignment_row public.assignments%rowtype;
  session_row public.assessment_sessions%rowtype;
  draft_row public.assessment_drafts%rowtype;
  v_started timestamptz := now();
  v_expires timestamptz;
  v_session_id uuid;
begin
  if current_student is null then
    raise exception 'Sign in to start this assessment.';
  end if;

  perform public.expire_assessment_sessions();

  select * into assignment_row from public.assignments where id = target_assignment;
  if assignment_row.id is null then
    raise exception 'Assessment not found.';
  end if;
  if not public.is_enrolled_in_class(assignment_row.class_id) then
    raise exception 'You are not enrolled in this class.';
  end if;
  if not assignment_row.published then
    raise exception 'This assessment is not published.';
  end if;
  if assignment_row.publish_at is not null and assignment_row.publish_at > v_started then
    raise exception 'This assessment is not yet available.';
  end if;
  if assignment_row.timing_mode = 'none' then
    raise exception 'This assessment does not use a timed session.';
  end if;
  if assignment_row.duration_minutes is null or assignment_row.duration_minutes <= 0 then
    raise exception 'This assessment has no valid duration.';
  end if;
  if assignment_row.opens_at is not null and v_started < assignment_row.opens_at then
    raise exception 'This assessment has not opened yet.';
  end if;
  if assignment_row.closes_at is not null and v_started > assignment_row.closes_at then
    raise exception 'This assessment is closed.';
  end if;

  select * into session_row
    from public.assessment_sessions
    where assessment_sessions.assignment_id = target_assignment
      and assessment_sessions.student_id = current_student;

  if session_row.id is not null then
    if session_row.status in ('submitted', 'auto_submitted') then
      raise exception 'You have already submitted this assessment.';
    end if;
    if session_row.status <> 'active' then
      raise exception 'This assessment session is no longer active.';
    end if;
    if session_row.expires_at is not null and session_row.expires_at <= v_started then
      perform public.finalize_assessment_session(session_row.id, null, 'auto_submitted');
      raise exception 'The time limit has expired. Your latest saved draft was submitted.';
    end if;

    select * into draft_row
      from public.assessment_drafts
      where assessment_drafts.session_id = session_row.id;
    return query
      select session_row.id, session_row.assignment_id, session_row.status,
             session_row.started_at, session_row.expires_at, now(),
             coalesce(draft_row.content, assignment_row.starter_code, ''),
             coalesce(draft_row.revision, session_row.draft_revision, 0);
    return;
  end if;

  if assignment_row.timing_mode = 'live_window' then
    v_expires := coalesce(assignment_row.opens_at, v_started)
      + make_interval(mins => assignment_row.duration_minutes);
  else
    v_expires := v_started + make_interval(mins => assignment_row.duration_minutes);
  end if;
  if assignment_row.closes_at is not null then
    v_expires := least(v_expires, assignment_row.closes_at);
  end if;
  if v_expires <= v_started then
    raise exception 'The assessment window has already closed.';
  end if;

  insert into public.assessment_sessions (
    assignment_id, student_id, status, started_at, expires_at, draft_revision
  )
  values (target_assignment, current_student, 'active', v_started, v_expires, 0)
  returning id into v_session_id;

  insert into public.assessment_drafts (session_id, content, revision, updated_at)
  values (v_session_id, coalesce(assignment_row.starter_code, ''), 0, v_started);

  return query
    select v_session_id, target_assignment, 'active'::text, v_started, v_expires, now(),
           coalesce(assignment_row.starter_code, ''), 0;
end;
$$;

revoke all on function public.start_assessment_session(uuid) from public, anon;
grant execute on function public.start_assessment_session(uuid) to authenticated, service_role;

create or replace function public.get_assessment_session(target_session uuid)
returns table (
  session_id uuid,
  assignment_id uuid,
  status text,
  started_at timestamptz,
  expires_at timestamptz,
  server_now timestamptz,
  draft_content text,
  draft_revision integer
)
language plpgsql security definer set search_path = public
as $$
declare
  current_student uuid := auth.uid();
  session_row public.assessment_sessions%rowtype;
  draft_row public.assessment_drafts%rowtype;
begin
  if current_student is null then
    raise exception 'Sign in to open this assessment.';
  end if;

  perform public.expire_assessment_sessions();

  select * into session_row from public.assessment_sessions where id = target_session;
  if session_row.id is null then
    raise exception 'Assessment session not found.';
  end if;
  if session_row.student_id <> current_student
     and not public.is_professor_of_assignment(session_row.assignment_id) then
    raise exception 'You cannot view this assessment session.';
  end if;

  select * into draft_row
    from public.assessment_drafts
    where assessment_drafts.session_id = target_session;

  return query
    select session_row.id, session_row.assignment_id, session_row.status,
           session_row.started_at, session_row.expires_at, now(),
           case when session_row.student_id = current_student
                then coalesce(draft_row.content, '')
                else null
           end,
           coalesce(draft_row.revision, session_row.draft_revision, 0);
end;
$$;

revoke all on function public.get_assessment_session(uuid) from public, anon;
grant execute on function public.get_assessment_session(uuid) to authenticated, service_role;
