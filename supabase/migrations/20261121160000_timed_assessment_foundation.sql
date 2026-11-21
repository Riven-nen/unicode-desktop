-- 20261121160000_timed_assessment_foundation.sql
--
-- Phase 1 of timed assessments: assignments can optionally be timed, and a
-- server-owned session records the start, deadline, draft, and final
-- submission. Client clocks are never trusted for the deadline.

-- Assessment configuration ---------------------------------------------------
alter table public.assignments
  add column if not exists kind text not null default 'assignment'
    check (kind in ('assignment', 'seatwork')),
  add column if not exists timing_mode text not null default 'none'
    check (timing_mode in ('none', 'duration', 'live_window')),
  add column if not exists duration_minutes integer
    check (duration_minutes is null or duration_minutes > 0),
  add column if not exists opens_at timestamptz,
  add column if not exists closes_at timestamptz,
  add column if not exists auto_submit boolean not null default true,
  add column if not exists show_timer boolean not null default true;

create index if not exists assignments_kind_idx on public.assignments (kind);

-- One session per student per assessment. Phase 1 is intentionally
-- single-attempt; retakes need an explicit reset flow later.
create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'submitted', 'auto_submitted', 'expired', 'abandoned')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  last_saved_at timestamptz,
  draft_revision integer not null default 0,
  final_submission_id uuid references public.submissions (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index if not exists assessment_sessions_assignment_idx
  on public.assessment_sessions (assignment_id);
create index if not exists assessment_sessions_student_idx
  on public.assessment_sessions (student_id);
create index if not exists assessment_sessions_active_idx
  on public.assessment_sessions (status, expires_at)
  where status = 'active';

create table if not exists public.assessment_drafts (
  session_id uuid primary key references public.assessment_sessions (id) on delete cascade,
  content text not null default '',
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.submissions
  add column if not exists assessment_session_id uuid
    references public.assessment_sessions (id) on delete set null;

create index if not exists submissions_assessment_session_idx
  on public.submissions (assessment_session_id);

-- Professor helper -----------------------------------------------------------
create or replace function public.is_professor_of_assignment(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_professor_of_class(public.class_of_assignment(target));
$$;

revoke all on function public.is_professor_of_assignment(uuid) from public, anon;
grant execute on function public.is_professor_of_assignment(uuid) to authenticated, service_role;

-- RLS: students see their own sessions; professors see sessions in their
-- classes. All writes go through the security-definer RPCs below.
alter table public.assessment_sessions enable row level security;
alter table public.assessment_drafts enable row level security;

create policy "assessment_sessions_select_own_or_class_professor"
  on public.assessment_sessions for select to authenticated
  using (student_id = auth.uid() or public.is_professor_of_assignment(assignment_id));

revoke all on public.assessment_sessions from anon;
revoke all on public.assessment_drafts from anon;
grant select on public.assessment_sessions to authenticated;
grant all on public.assessment_sessions, public.assessment_drafts to service_role;

-- Internal finalizer ---------------------------------------------------------
-- Not callable by clients. It creates the normal submission and final snapshot
-- from the latest content, so the existing review/grade/ICS pipeline works.
create or replace function public.finalize_assessment_session(
  target_session uuid,
  submitted_content text,
  target_status text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  session_row public.assessment_sessions%rowtype;
  assignment_row public.assignments%rowtype;
  draft_row public.assessment_drafts%rowtype;
  new_submission uuid;
  final_snapshot uuid;
  target_file text;
  content text;
begin
  select * into session_row
    from public.assessment_sessions
    where id = target_session
    for update;

  if session_row.id is null then
    raise exception 'Assessment session not found.';
  end if;
  if session_row.final_submission_id is not null then
    return session_row.final_submission_id;
  end if;
  if session_row.status not in ('active') then
    return session_row.final_submission_id;
  end if;
  if target_status not in ('submitted', 'auto_submitted') then
    raise exception 'Invalid assessment session status.';
  end if;

  select * into assignment_row from public.assignments where id = session_row.assignment_id;
  select * into draft_row from public.assessment_drafts where session_id = target_session;

  content := coalesce(submitted_content, draft_row.content, assignment_row.starter_code, '');
  if length(content) > 500000 then
    content := left(content, 500000);
  end if;
  target_file := coalesce(nullif(assignment_row.file_name, ''), 'seatwork.txt');

  insert into public.submissions (
    assignment_id,
    student_id,
    assessment_session_id,
    status,
    submitted_at
  )
  values (
    assignment_row.id,
    session_row.student_id,
    session_row.id,
    target_status,
    now()
  )
  returning id into new_submission;

  -- Attach any unsynced workspace snapshots for this assignment file.
  update public.code_snapshots
  set submission_id = new_submission
  where user_id = session_row.student_id
    and file_name = target_file
    and submission_id is null;

  insert into public.code_snapshots (
    id,
    user_id,
    submission_id,
    file_name,
    content,
    snapshot_type,
    version,
    char_count,
    line_count,
    language,
    created_at
  )
  values (
    gen_random_uuid(),
    session_row.student_id,
    new_submission,
    target_file,
    content,
    'manual',
    0,
    length(content),
    1 + (length(content) - length(replace(content, E'\n', ''))),
    assignment_row.language,
    now()
  )
  returning id into final_snapshot;

  perform set_config('app.submit_assignment', 'on', true);
  update public.submissions
  set final_snapshot_id = final_snapshot
  where id = new_submission;
  perform set_config('app.submit_assignment', 'off', true);

  update public.assessment_sessions
  set status = target_status,
      submitted_at = now(),
      last_saved_at = now(),
      final_submission_id = new_submission
  where id = target_session;

  return new_submission;
end;
$$;

revoke all on function public.finalize_assessment_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_assessment_session(uuid, text, text) to service_role;

-- Expire active sessions whose server deadline has passed. Called by the RPCs
-- below and by the professor monitor. A future pg_cron schedule can call it
-- periodically when the extension is available.
create or replace function public.expire_assessment_sessions()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  expired_id uuid;
  draft_content text;
  expired_count integer := 0;
begin
  for expired_id in
    select id
    from public.assessment_sessions
    where status = 'active'
      and expires_at is not null
      and expires_at < now()
  loop
    select content into draft_content
      from public.assessment_drafts
      where session_id = expired_id;
    perform public.finalize_assessment_session(expired_id, draft_content, 'auto_submitted');
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

revoke all on function public.expire_assessment_sessions() from public, anon;
grant execute on function public.expire_assessment_sessions() to authenticated, service_role;

-- Start or resume ------------------------------------------------------------
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

-- Resume/read ----------------------------------------------------------------
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

-- Autosave ------------------------------------------------------------------
create or replace function public.save_assessment_draft(
  target_session uuid,
  draft_content text,
  client_revision integer
)
returns table (
  revision integer,
  saved_at timestamptz,
  expires_at timestamptz,
  server_now timestamptz,
  status text
)
language plpgsql security definer set search_path = public
as $$
declare
  current_student uuid := auth.uid();
  session_row public.assessment_sessions%rowtype;
  draft_row public.assessment_drafts%rowtype;
  v_revision integer;
begin
  if current_student is null then
    raise exception 'Sign in to save this assessment.';
  end if;
  if length(coalesce(draft_content, '')) > 500000 then
    raise exception 'This draft is too large to save.';
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
  if session_row.expires_at is not null and session_row.expires_at <= now() then
    perform public.finalize_assessment_session(session_row.id, null, 'auto_submitted');
    raise exception 'The time limit has expired. Your latest saved draft was submitted.';
  end if;

  select * into draft_row from public.assessment_drafts where session_id = target_session;
  v_revision := greatest(session_row.draft_revision, coalesce(client_revision, 0));

  if draft_row.session_id is null then
    insert into public.assessment_drafts (session_id, content, revision, updated_at)
    values (target_session, coalesce(draft_content, ''), v_revision, now());
  elsif v_revision > draft_row.revision then
    update public.assessment_drafts
    set content = coalesce(draft_content, ''), revision = v_revision, updated_at = now()
    where session_id = target_session;
  end if;

  update public.assessment_sessions
  set draft_revision = greatest(draft_revision, v_revision), last_saved_at = now()
  where id = target_session;

  return query
    select v_revision, now(), session_row.expires_at, now(), session_row.status;
end;
$$;

revoke all on function public.save_assessment_draft(uuid, text, integer) from public, anon;
grant execute on function public.save_assessment_draft(uuid, text, integer) to authenticated, service_role;

-- Submit --------------------------------------------------------------------
create or replace function public.submit_assessment_session(
  target_session uuid,
  submitted_content text
)
returns table (
  submission_id uuid,
  status text,
  submitted_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare
  current_student uuid := auth.uid();
  session_row public.assessment_sessions%rowtype;
  draft_row public.assessment_drafts%rowtype;
  v_submission uuid;
  v_status text;
begin
  if current_student is null then
    raise exception 'Sign in to submit this assessment.';
  end if;

  perform public.expire_assessment_sessions();

  select * into session_row
    from public.assessment_sessions
    where id = target_session
    for update;

  if session_row.id is null or session_row.student_id <> current_student then
    raise exception 'Assessment session not found.';
  end if;
  if session_row.final_submission_id is not null then
    return query select session_row.final_submission_id, session_row.status, session_row.submitted_at;
    return;
  end if;
  if session_row.status <> 'active' then
    raise exception 'This assessment session is no longer active.';
  end if;

  select * into draft_row from public.assessment_drafts where session_id = target_session;

  if session_row.expires_at is not null
     and now() > session_row.expires_at + interval '10 seconds' then
    v_submission := public.finalize_assessment_session(
      target_session,
      draft_row.content,
      'auto_submitted'
    );
    v_status := 'auto_submitted';
  else
    v_submission := public.finalize_assessment_session(
      target_session,
      coalesce(submitted_content, draft_row.content),
      'submitted'
    );
    v_status := 'submitted';
  end if;

  return query
    select v_submission, v_status, now();
end;
$$;

revoke all on function public.submit_assessment_session(uuid, text) from public, anon;
grant execute on function public.submit_assessment_session(uuid, text) to authenticated, service_role;

-- Professor monitor ----------------------------------------------------------
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
  server_now timestamptz
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
           s.last_saved_at, s.draft_revision, s.final_submission_id, now()
    from public.assessment_sessions s
    join public.profiles p on p.id = s.student_id
    where s.assignment_id = target_assignment
    order by s.started_at asc;
end;
$$;

revoke all on function public.fetch_assessment_sessions(uuid) from public, anon;
grant execute on function public.fetch_assessment_sessions(uuid) to authenticated, service_role;

-- Optional future scheduler. The extension is not enabled in the current
-- project, so the RPCs and professor monitor perform lazy expiry.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'unicode-lab-expire-assessments',
      '* * * * *',
      'select public.expire_assessment_sessions();'
    );
  end if;
end;
$$;
