-- 20261114091200_submit_assignment_file_check.sql
--
-- submit_assignment accepted any workspace file for an assignment the
-- student was enrolled in. Assignments now name their file, so reject a
-- submission whose basename does not match that file. Assignments created
-- before file_name existed (null) keep working.

create or replace function public.submit_assignment(
  target_assignment uuid,
  target_file text,
  fallback_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_student uuid := auth.uid();
  target_class uuid;
  assignment_language text;
  assignment_file_name text;
  submitted_file_name text;
  new_submission uuid;
  final_snapshot uuid;
begin
  if current_student is null then
    raise exception 'Sign in to submit an assignment.';
  end if;
  if target_file is null or length(trim(target_file)) = 0 then
    raise exception 'The assignment file is missing.';
  end if;
  if length(coalesce(fallback_content, '')) > 500000 then
    raise exception 'This file is too large to submit.';
  end if;

  select class_id, language, file_name
    into target_class, assignment_language, assignment_file_name
    from public.assignments
    where id = target_assignment;

  if target_class is null then
    raise exception 'Assignment not found.';
  end if;

  if not exists (
    select 1
    from public.enrollments
    where class_id = target_class
      and enrollments.student_id = current_student
  ) then
    raise exception 'You are not enrolled in this class.';
  end if;

  if assignment_file_name is not null and length(trim(assignment_file_name)) > 0 then
    submitted_file_name := regexp_replace(target_file, '^.*[/\\]', '');
    if lower(submitted_file_name) <> lower(trim(assignment_file_name)) then
      raise exception 'Submit the assignment file "%".', assignment_file_name;
    end if;
  end if;

  insert into public.submissions (assignment_id, student_id, status)
  values (target_assignment, current_student, 'submitted')
  returning id into new_submission;

  update public.code_snapshots
  set submission_id = new_submission
  where user_id = current_student
    and file_name = target_file
    and submission_id is null;

  select id
    into final_snapshot
    from public.code_snapshots
    where submission_id = new_submission
    order by created_at desc
    limit 1;

  if final_snapshot is null then
    insert into public.code_snapshots (
      id, user_id, submission_id, file_name, content, snapshot_type,
      version, char_count, line_count, language, created_at
    )
    values (
      gen_random_uuid(), current_student, new_submission, target_file,
      coalesce(fallback_content, ''), 'manual', 0,
      length(coalesce(fallback_content, '')),
      1 + (
        length(coalesce(fallback_content, '')) -
        length(replace(coalesce(fallback_content, ''), chr(10), ''))
      ),
      assignment_language, now()
    )
    returning id into final_snapshot;

    update public.code_snapshots
    set submission_id = new_submission
    where id = final_snapshot;
  end if;

  perform set_config('app.submit_assignment', 'on', true);
  update public.submissions
  set final_snapshot_id = final_snapshot
  where id = new_submission;
  perform set_config('app.submit_assignment', 'off', true);

  return new_submission;
end;
$$;

revoke all on function public.submit_assignment(uuid, text, text) from public, anon;
grant execute on function public.submit_assignment(uuid, text, text) to authenticated, service_role;
