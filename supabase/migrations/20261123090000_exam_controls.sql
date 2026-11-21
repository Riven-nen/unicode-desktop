-- 20261123090000_exam_controls.sql
--
-- Phase 2/3 exam controls: tab-out/fullscreen interruptions, paste blocking,
-- run-only terminal, authenticated professor overrides, and an event audit.
--
-- The client reports events; the database owns the strike count and decides
-- whether the next interruption auto-submits. The client cannot lower its own
-- counters or apply an override.

-- Settings copied into the session at start so mid-session edits do not loosen
-- an assessment that is already running.
alter table public.assignments
  add column if not exists allowed_tab_outs integer not null default 1
    check (allowed_tab_outs >= 0),
  add column if not exists fullscreen_required boolean not null default true,
  add column if not exists block_paste boolean not null default true,
  add column if not exists run_only_terminal boolean not null default true;

alter table public.assessment_sessions
  add column if not exists exam_mode boolean not null default false,
  add column if not exists allowed_tab_outs integer not null default 1,
  add column if not exists fullscreen_required boolean not null default true,
  add column if not exists block_paste boolean not null default true,
  add column if not exists run_only_terminal boolean not null default true,
  add column if not exists tab_out_count integer not null default 0,
  add column if not exists fullscreen_exit_count integer not null default 0,
  add column if not exists blocked_paste_count integer not null default 0,
  add column if not exists interruption_count integer not null default 0,
  add column if not exists override_note text,
  add column if not exists override_at timestamptz,
  add column if not exists override_by uuid references public.profiles (id) on delete set null;

create table if not exists public.assessment_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'tab_out', 'fullscreen_exit', 'paste_blocked', 'warning', 'focus_return',
      'override', 'auto_submit'
    )),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists assessment_events_session_idx
  on public.assessment_events (session_id, occurred_at);
create index if not exists assessment_events_student_idx
  on public.assessment_events (student_id, occurred_at);

create table if not exists public.assessment_overrides (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  professor_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('extend_time', 'excuse_interruption')),
  minutes integer check (minutes is null or minutes between 1 and 240),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists assessment_overrides_session_idx
  on public.assessment_overrides (session_id, created_at);

create or replace function public.is_professor_of_session(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_professor_of_assignment(
    (select assignment_id from public.assessment_sessions where id = target)
  );
$$;

revoke all on function public.is_professor_of_session(uuid) from public, anon;
grant execute on function public.is_professor_of_session(uuid) to authenticated, service_role;

alter table public.assessment_events enable row level security;
alter table public.assessment_overrides enable row level security;

drop policy if exists "assessment_events_select_own_or_class" on public.assessment_events;
create policy "assessment_events_select_own_or_class"
  on public.assessment_events for select to authenticated
  using (student_id = auth.uid() or public.is_professor_of_session(session_id));

drop policy if exists "assessment_overrides_select_class" on public.assessment_overrides;
create policy "assessment_overrides_select_class"
  on public.assessment_overrides for select to authenticated
  using (public.is_professor_of_session(session_id));

revoke all on public.assessment_events from anon;
revoke all on public.assessment_overrides from anon;
grant select on public.assessment_events, public.assessment_overrides to authenticated;
grant all on public.assessment_events, public.assessment_overrides to service_role;

-- Start/resume now snapshots the exam settings onto the session. Return shape is
-- unchanged; the client reads counters through fetch_assessment_exam_state.
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
  v_exam_mode boolean;
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

  v_exam_mode := assignment_row.kind = 'seatwork';

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

    -- Refresh snapshotted controls for sessions created before this migration.
    update public.assessment_sessions
    set exam_mode = v_exam_mode,
        allowed_tab_outs = assignment_row.allowed_tab_outs,
        fullscreen_required = assignment_row.fullscreen_required,
        block_paste = assignment_row.block_paste,
        run_only_terminal = assignment_row.run_only_terminal
    where id = session_row.id
    returning * into session_row;

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
    assignment_id, student_id, status, started_at, expires_at, draft_revision,
    exam_mode, allowed_tab_outs, fullscreen_required, block_paste, run_only_terminal
  )
  values (
    target_assignment, current_student, 'active', v_started, v_expires, 0,
    v_exam_mode, assignment_row.allowed_tab_outs, assignment_row.fullscreen_required,
    assignment_row.block_paste, assignment_row.run_only_terminal
  )
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

-- Exam state read model for the student workspace and professor monitor.
create or replace function public.fetch_assessment_exam_state(target_session uuid)
returns table (
  session_id uuid,
  status text,
  expires_at timestamptz,
  exam_mode boolean,
  allowed_tab_outs integer,
  tab_out_count integer,
  fullscreen_exit_count integer,
  blocked_paste_count integer,
  interruption_count integer,
  fullscreen_required boolean,
  block_paste boolean,
  run_only_terminal boolean,
  override_note text,
  override_at timestamptz,
  server_now timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare
  requester uuid := auth.uid();
  session_row public.assessment_sessions%rowtype;
begin
  if requester is null then
    raise exception 'Sign in to read this assessment.';
  end if;
  select * into session_row
    from public.assessment_sessions
    where id = target_session;
  if session_row.id is null then
    raise exception 'Assessment session not found.';
  end if;
  if session_row.student_id <> requester
     and not public.is_professor_of_assignment(session_row.assignment_id) then
    raise exception 'You cannot read this assessment session.';
  end if;

  return query
    select session_row.id, session_row.status, session_row.expires_at,
           session_row.exam_mode, session_row.allowed_tab_outs,
           session_row.tab_out_count, session_row.fullscreen_exit_count,
           session_row.blocked_paste_count, session_row.interruption_count,
           session_row.fullscreen_required, session_row.block_paste,
           session_row.run_only_terminal, session_row.override_note,
           session_row.override_at, now();
end;
$$;

revoke all on function public.fetch_assessment_exam_state(uuid) from public, anon;
grant execute on function public.fetch_assessment_exam_state(uuid) to authenticated, service_role;

-- Event reporting. The server decides warning vs auto-submit.
create or replace function public.record_assessment_event(
  target_session uuid,
  event_type text,
  event_metadata jsonb default '{}'::jsonb
)
returns table (
  action text,
  status text,
  tab_out_count integer,
  fullscreen_exit_count integer,
  blocked_paste_count integer,
  interruption_count integer,
  allowed_tab_outs integer,
  submission_id uuid,
  server_now timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare
  current_student uuid := auth.uid();
  session_row public.assessment_sessions%rowtype;
  v_submission uuid;
  v_action text := 'logged';
  v_status text;
begin
  if current_student is null then
    raise exception 'Sign in to record this event.';
  end if;
  if event_type not in (
    'tab_out', 'fullscreen_exit', 'paste_blocked', 'warning', 'focus_return'
  ) then
    raise exception 'Invalid assessment event.';
  end if;

  select * into session_row
    from public.assessment_sessions
    where id = target_session
    for update;
  if session_row.id is null or session_row.student_id <> current_student then
    raise exception 'Assessment session not found.';
  end if;
  if session_row.status <> 'active' then
    raise exception 'This assessment session is no longer active.';
  end if;

  insert into public.assessment_events (session_id, student_id, event_type, metadata)
  values (target_session, current_student, event_type, coalesce(event_metadata, '{}'::jsonb));

  if session_row.exam_mode and event_type = 'tab_out' then
    update public.assessment_sessions as s
    set tab_out_count = s.tab_out_count + 1,
        interruption_count = s.interruption_count + 1
    where s.id = target_session
    returning * into session_row;
  elsif session_row.exam_mode and event_type = 'fullscreen_exit' then
    update public.assessment_sessions as s
    set fullscreen_exit_count = s.fullscreen_exit_count + 1,
        interruption_count = s.interruption_count + 1
    where s.id = target_session
    returning * into session_row;
  elsif session_row.exam_mode and event_type = 'paste_blocked' then
    update public.assessment_sessions as s
    set blocked_paste_count = s.blocked_paste_count + 1
    where s.id = target_session
    returning * into session_row;
  end if;

  v_status := session_row.status;
  if session_row.exam_mode
     and event_type in ('tab_out', 'fullscreen_exit')
     and session_row.interruption_count > session_row.allowed_tab_outs then
    v_submission := public.finalize_assessment_session(target_session, null, 'auto_submitted');
    insert into public.assessment_events (session_id, student_id, event_type, metadata)
    values (target_session, current_student, 'auto_submit',
            jsonb_build_object('reason', event_type, 'count', session_row.interruption_count));
    v_action := 'auto_submit';
    v_status := 'auto_submitted';
  elsif session_row.exam_mode
        and event_type in ('tab_out', 'fullscreen_exit') then
    v_action := 'warning';
  end if;

  return query
    select v_action, v_status, session_row.tab_out_count, session_row.fullscreen_exit_count,
           session_row.blocked_paste_count, session_row.interruption_count,
           session_row.allowed_tab_outs, v_submission, now();
end;
$$;

revoke all on function public.record_assessment_event(uuid, text, jsonb) from public, anon;
grant execute on function public.record_assessment_event(uuid, text, jsonb) to authenticated, service_role;

-- Authenticated professor override. Every action is audited.
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
    update public.assessment_sessions
    set tab_out_count = 0,
        fullscreen_exit_count = 0,
        interruption_count = 0,
        override_note = coalesce(override_reason, 'Interruptions excused by professor.'),
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

-- Monitor return type changes, so drop and recreate rather than replace.
drop function if exists public.fetch_assessment_sessions(uuid);

create or replace function public.fetch_assessment_sessions(target_assignment uuid)
returns table (
  session_id uuid,
  student_id uuid,
  student_name text,
  student_email text,
  status text,
  started_at timestamptz,
  expires_at timestamptz,
  submitted_at timestamptz,
  last_saved_at timestamptz,
  draft_revision integer,
  final_submission_id uuid,
  server_now timestamptz,
  exam_mode boolean,
  allowed_tab_outs integer,
  tab_out_count integer,
  fullscreen_exit_count integer,
  blocked_paste_count integer,
  interruption_count integer,
  fullscreen_required boolean,
  block_paste boolean,
  run_only_terminal boolean,
  override_note text,
  override_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to view assessment sessions.';
  end if;
  if not public.is_professor_of_assignment(target_assignment) then
    raise exception 'You do not teach the class for this assessment.';
  end if;

  perform public.expire_assessment_sessions();

  return query
    select s.id, s.student_id,
           coalesce(p.display_name, p.email, 'Student'),
           p.email,
           s.status, s.started_at, s.expires_at, s.submitted_at,
           s.last_saved_at, s.draft_revision, s.final_submission_id, now(),
           s.exam_mode, s.allowed_tab_outs, s.tab_out_count,
           s.fullscreen_exit_count, s.blocked_paste_count, s.interruption_count,
           s.fullscreen_required, s.block_paste, s.run_only_terminal,
           s.override_note, s.override_at
    from public.assessment_sessions s
    join public.profiles p on p.id = s.student_id
    where s.assignment_id = target_assignment
    order by s.started_at asc;
end;
$$;

revoke all on function public.fetch_assessment_sessions(uuid) from public, anon;
grant execute on function public.fetch_assessment_sessions(uuid) to authenticated, service_role;
