-- 20261122110000_fix_finalize_snapshot_file_key.sql
--
-- Tracker snapshots use the workspace-relative key (`CS101/test.py`), but
-- finalize_assessment_session looked only for the bare assignment file name
-- (`test.py`). Timed submissions therefore arrived with their final snapshot
-- but without the earlier autosnapshot history that review and ICS use.
--
-- Attach both the bare key and the class-prefixed key, and label the synthetic
-- final snapshot with the same class-prefixed key.

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
  target_folder text;
  target_key text;
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
  select code into target_folder from public.classes where id = assignment_row.class_id;
  select * into draft_row from public.assessment_drafts where session_id = target_session;

  content := coalesce(submitted_content, draft_row.content, assignment_row.starter_code, '');
  if length(content) > 500000 then
    content := left(content, 500000);
  end if;
  target_file := coalesce(nullif(assignment_row.file_name, ''), 'seatwork.txt');
  target_key := case
    when target_folder is not null and target_folder <> '' then target_folder || '/' || target_file
    else target_file
  end;

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

  -- Attach the tracker's class-prefixed snapshots and any legacy bare-name
  -- snapshots for the same file.
  update public.code_snapshots
  set submission_id = new_submission
  where user_id = session_row.student_id
    and submission_id is null
    and (file_name = target_key or file_name = target_file);

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
    target_key,
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
