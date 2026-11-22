-- 20261123120000_phase5_attempts_codes.sql
--
-- Phase 5: multiple attempts, one-time override codes, exam templates, bulk
-- class policies, and a class-wide exam overview.

-- Multiple attempts ----------------------------------------------------------
alter table public.assignments
  add column if not exists max_attempts integer not null default 1
    check (max_attempts between 1 and 10);

alter table public.assessment_sessions
  add column if not exists attempt_number integer not null default 1;

alter table public.assessment_sessions
  drop constraint if exists assessment_sessions_assignment_id_student_id_key;
alter table public.assessment_sessions
  add constraint assessment_sessions_attempt_key
  unique (assignment_id, student_id, attempt_number);

create index if not exists assessment_sessions_latest_idx
  on public.assessment_sessions (assignment_id, student_id, attempt_number desc);

-- Start/resume the latest attempt or create the next one.
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
  v_attempt integer := 1;
begin
  if current_student is null then raise exception 'Sign in to start this assessment.'; end if;
  perform public.expire_assessment_sessions();
  select * into assignment_row from public.assignments where id = target_assignment;
  if assignment_row.id is null then raise exception 'Assessment not found.'; end if;
  if not public.is_enrolled_in_class(assignment_row.class_id) then raise exception 'You are not enrolled in this class.'; end if;
  if not assignment_row.published then raise exception 'This assessment is not published.'; end if;
  if assignment_row.publish_at is not null and assignment_row.publish_at > v_started then raise exception 'This assessment is not yet available.'; end if;
  if assignment_row.timing_mode = 'none' then raise exception 'This assessment does not use a timed session.'; end if;
  if assignment_row.duration_minutes is null or assignment_row.duration_minutes <= 0 then raise exception 'This assessment has no valid duration.'; end if;
  if assignment_row.opens_at is not null and v_started < assignment_row.opens_at then raise exception 'This assessment has not opened yet.'; end if;
  if assignment_row.closes_at is not null and v_started > assignment_row.closes_at then raise exception 'This assessment is closed.'; end if;

  select * into session_row
    from public.assessment_sessions
    where assessment_sessions.assignment_id = target_assignment
      and assessment_sessions.student_id = current_student
    order by assessment_sessions.attempt_number desc
    limit 1;

  if session_row.id is not null and session_row.status = 'active' then
    if session_row.expires_at is not null and session_row.expires_at <= v_started then
      perform public.finalize_assessment_session(session_row.id, null, 'auto_submitted');
      raise exception 'The time limit has expired. Your latest saved draft was submitted.';
    end if;
    update public.assessment_sessions
    set exam_mode = (assignment_row.kind = 'seatwork'),
        allowed_tab_outs = assignment_row.allowed_tab_outs,
        fullscreen_required = assignment_row.fullscreen_required,
        block_paste = assignment_row.block_paste,
        run_only_terminal = assignment_row.run_only_terminal
    where id = session_row.id
    returning * into session_row;
    select * into draft_row from public.assessment_drafts where assessment_drafts.session_id = session_row.id;
    return query select session_row.id, session_row.assignment_id, session_row.status,
      session_row.started_at, session_row.expires_at, now(),
      coalesce(draft_row.content, assignment_row.starter_code, ''),
      coalesce(draft_row.revision, session_row.draft_revision, 0);
    return;
  end if;

  if session_row.id is not null then
    if session_row.attempt_number >= assignment_row.max_attempts then
      raise exception 'You have used all % attempts for this assessment.', assignment_row.max_attempts;
    end if;
    v_attempt := session_row.attempt_number + 1;
  end if;

  if assignment_row.timing_mode = 'live_window' then
    v_expires := coalesce(assignment_row.opens_at, v_started) + make_interval(mins => assignment_row.duration_minutes);
  else
    v_expires := v_started + make_interval(mins => assignment_row.duration_minutes);
  end if;
  if assignment_row.closes_at is not null then v_expires := least(v_expires, assignment_row.closes_at); end if;
  if v_expires <= v_started then raise exception 'The assessment window has already closed.'; end if;

  insert into public.assessment_sessions (
    assignment_id, student_id, status, started_at, expires_at, draft_revision,
    exam_mode, allowed_tab_outs, fullscreen_required, block_paste, run_only_terminal, attempt_number
  )
  values (
    target_assignment, current_student, 'active', v_started, v_expires, 0,
    assignment_row.kind = 'seatwork', assignment_row.allowed_tab_outs,
    assignment_row.fullscreen_required, assignment_row.block_paste,
    assignment_row.run_only_terminal, v_attempt
  )
  returning id into v_session_id;

  insert into public.assessment_drafts (session_id, content, revision, updated_at)
  values (v_session_id, coalesce(assignment_row.starter_code, ''), 0, v_started);

  return query select v_session_id, target_assignment, 'active'::text, v_started, v_expires, now(),
    coalesce(assignment_row.starter_code, ''), 0;
end;
$$;

revoke all on function public.start_assessment_session(uuid) from public, anon;
grant execute on function public.start_assessment_session(uuid) to authenticated, service_role;

drop function if exists public.fetch_assessment_sessions(uuid);
create or replace function public.fetch_assessment_sessions(target_assignment uuid)
returns table (
  session_id uuid, student_id uuid, student_name text, student_email text, status text,
  started_at timestamptz, expires_at timestamptz, submitted_at timestamptz, last_saved_at timestamptz,
  draft_revision integer, final_submission_id uuid, server_now timestamptz, exam_mode boolean,
  allowed_tab_outs integer, tab_out_count integer, fullscreen_exit_count integer, blocked_paste_count integer,
  interruption_count integer, fullscreen_required boolean, block_paste boolean, run_only_terminal boolean,
  override_note text, override_at timestamptz, attempt_number integer, max_attempts integer, reopen_count integer
)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view assessment sessions.'; end if;
  if not public.is_professor_of_assignment(target_assignment) then raise exception 'You do not teach the class for this assessment.'; end if;
  perform public.expire_assessment_sessions();
  return query select s.id, s.student_id, coalesce(p.display_name,p.email,'Student'), p.email,
    s.status, s.started_at, s.expires_at, s.submitted_at, s.last_saved_at, s.draft_revision,
    s.final_submission_id, now(), s.exam_mode, s.allowed_tab_outs, s.tab_out_count,
    s.fullscreen_exit_count, s.blocked_paste_count, s.interruption_count, s.fullscreen_required,
    s.block_paste, s.run_only_terminal, s.override_note, s.override_at,
    s.attempt_number, a.max_attempts, s.reopen_count
  from public.assessment_sessions s
  join public.profiles p on p.id = s.student_id
  join public.assignments a on a.id = s.assignment_id
  where s.assignment_id = target_assignment
  order by s.student_id, s.attempt_number asc;
end; $$;
revoke all on function public.fetch_assessment_sessions(uuid) from public, anon;
grant execute on function public.fetch_assessment_sessions(uuid) to authenticated, service_role;

-- One-time override codes ----------------------------------------------------
create table if not exists public.assessment_override_codes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  professor_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null,
  action text not null check (action in ('extend_time','excuse_interruption','reopen')),
  minutes integer check (minutes is null or minutes between 1 and 240),
  reason text,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists assessment_override_codes_session_idx
  on public.assessment_override_codes (session_id, created_at desc);

alter table public.assessment_override_codes enable row level security;
drop policy if exists "assessment_override_codes_professor" on public.assessment_override_codes;
create policy "assessment_override_codes_professor"
  on public.assessment_override_codes for select to authenticated
  using (professor_id = auth.uid());
revoke all on public.assessment_override_codes from anon;
grant select on public.assessment_override_codes to authenticated;
grant all on public.assessment_override_codes to service_role;

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
  if valid_minutes is null or valid_minutes < 1 or valid_minutes > 1440 then raise exception 'Choose a validity between 1 and 1440 minutes.'; end if;
  select * into session_row from public.assessment_sessions where id = target_session;
  if session_row.id is null then raise exception 'Assessment session not found.'; end if;
  if not public.is_professor_of_assignment(session_row.assignment_id) then raise exception 'You do not teach the class for this assessment.'; end if;
  if override_action not in ('extend_time','excuse_interruption','reopen') then raise exception 'Unknown override action.'; end if;

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
revoke all on function public.create_assessment_override_code(uuid, text, integer, text, integer) from public, anon;
grant execute on function public.create_assessment_override_code(uuid, text, integer, text, integer) to authenticated, service_role;

create or replace function public.redeem_assessment_override_code(
  target_session uuid,
  override_code text
)
returns table (status text, expires_at timestamptz, override_note text, server_now timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  current_student uuid := auth.uid();
  session_row public.assessment_sessions%rowtype;
  code_row public.assessment_override_codes%rowtype;
  v_expires timestamptz;
begin
  if current_student is null then raise exception 'Sign in to redeem this code.'; end if;
  select * into session_row from public.assessment_sessions where id = target_session for update;
  if session_row.id is null or session_row.student_id <> current_student then raise exception 'Assessment session not found.'; end if;
  select * into code_row
    from public.assessment_override_codes
    where session_id = target_session
      and code_hash = md5(upper(trim(override_code)))
      and used_at is null
      and expires_at > now()
    order by created_at desc
    limit 1;
  if code_row.id is null then raise exception 'That override code is invalid, expired, or already used.'; end if;

  if code_row.action = 'extend_time' then
    if session_row.status <> 'active' then raise exception 'Only an active session can be extended.'; end if;
    v_expires := greatest(now(), coalesce(session_row.expires_at, now())) + make_interval(mins => coalesce(code_row.minutes, 5));
    update public.assessment_sessions set expires_at = v_expires,
      override_note = coalesce(code_row.reason, 'Time extended by one-time code.'), override_at = now()
    where id = target_session returning * into session_row;
  elsif code_row.action = 'excuse_interruption' then
    if session_row.status <> 'active' then raise exception 'Only an active session can be excused.'; end if;
    update public.assessment_sessions set tab_out_count = 0, fullscreen_exit_count = 0, interruption_count = 0,
      override_note = coalesce(code_row.reason, 'Interruptions excused by one-time code.'), override_at = now()
    where id = target_session returning * into session_row;
  else
    if session_row.status = 'active' then raise exception 'This session is already active.'; end if;
    v_expires := now() + make_interval(mins => coalesce(code_row.minutes, 10));
    update public.assessment_sessions set status = 'active', started_at = now(), expires_at = v_expires,
      submitted_at = null, final_submission_id = null, tab_out_count = 0, fullscreen_exit_count = 0,
      interruption_count = 0, blocked_paste_count = 0, reopen_count = reopen_count + 1,
      override_note = coalesce(code_row.reason, 'Attempt reopened by one-time code.'), override_at = now()
    where id = target_session returning * into session_row;
  end if;

  update public.assessment_override_codes set used_at = now(), used_by = current_student where id = code_row.id;
  insert into public.assessment_overrides (session_id, professor_id, action, minutes, reason)
  values (target_session, code_row.professor_id, code_row.action, code_row.minutes,
    coalesce(code_row.reason, 'Redeemed one-time override code.'));
  insert into public.assessment_events (session_id, student_id, event_type, metadata)
  values (target_session, current_student, 'override',
    jsonb_build_object('action', code_row.action, 'via', 'one_time_code', 'minutes', code_row.minutes));
  return query select session_row.status, session_row.expires_at, session_row.override_note, now();
end;
$$;
revoke all on function public.redeem_assessment_override_code(uuid, text) from public, anon;
grant execute on function public.redeem_assessment_override_code(uuid, text) to authenticated, service_role;

-- Exam templates -------------------------------------------------------------
create table if not exists public.exam_templates (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  allowed_tab_outs integer not null default 1 check (allowed_tab_outs >= 0),
  fullscreen_required boolean not null default true,
  block_paste boolean not null default true,
  run_only_terminal boolean not null default true,
  auto_submit boolean not null default true,
  show_timer boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists exam_templates_professor_idx on public.exam_templates (professor_id, name);
alter table public.exam_templates enable row level security;
drop policy if exists "exam_templates_own" on public.exam_templates;
create policy "exam_templates_own" on public.exam_templates for all to authenticated
  using (professor_id = auth.uid()) with check (professor_id = auth.uid());
revoke all on public.exam_templates from anon;
grant all on public.exam_templates to authenticated, service_role;

create or replace function public.apply_exam_policy_to_class(
  target_class uuid,
  policy_allowed_tab_outs integer,
  policy_fullscreen boolean,
  policy_block_paste boolean,
  policy_run_only boolean
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare updated integer;
begin
  if auth.uid() is null then raise exception 'Sign in to update exam policy.'; end if;
  if not public.is_professor_of_class(target_class) then raise exception 'You do not teach this class.'; end if;
  update public.assignments
  set allowed_tab_outs = greatest(0, least(10, coalesce(policy_allowed_tab_outs, 1))),
      fullscreen_required = coalesce(policy_fullscreen, true),
      block_paste = coalesce(policy_block_paste, true),
      run_only_terminal = coalesce(policy_run_only, true)
  where class_id = target_class and kind = 'seatwork';
  get diagnostics updated = row_count;
  return updated;
end;
$$;
revoke all on function public.apply_exam_policy_to_class(uuid, integer, boolean, boolean, boolean) from public, anon;
grant execute on function public.apply_exam_policy_to_class(uuid, integer, boolean, boolean, boolean) to authenticated, service_role;

-- Class-wide exam overview ---------------------------------------------------
create or replace function public.fetch_class_exam_overview(target_class uuid)
returns table (
  assignment_id uuid, title text, sessions bigint, active bigint, submitted bigint,
  auto_submitted bigint, interruptions bigint, blocked_pastes bigint, overrides bigint
)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to read exam analytics.'; end if;
  if not public.is_professor_of_class(target_class) then raise exception 'You do not teach this class.'; end if;
  return query
    select a.id, a.title,
      count(s.id),
      count(s.id) filter (where s.status = 'active'),
      count(s.id) filter (where s.status = 'submitted'),
      count(s.id) filter (where s.status = 'auto_submitted'),
      coalesce(sum(s.interruption_count), 0),
      coalesce(sum(s.blocked_paste_count), 0),
      (select count(*) from public.assessment_overrides o join public.assessment_sessions os on os.id = o.session_id where os.assignment_id = a.id)
    from public.assignments a
    left join public.assessment_sessions s on s.assignment_id = a.id
    where a.class_id = target_class and a.timing_mode <> 'none'
    group by a.id, a.title
    order by a.created_at asc;
end;
$$;
revoke all on function public.fetch_class_exam_overview(uuid) from public, anon;
grant execute on function public.fetch_class_exam_overview(uuid) to authenticated, service_role;
