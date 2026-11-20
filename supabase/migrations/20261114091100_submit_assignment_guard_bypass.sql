-- 20261114091100_submit_assignment_guard_bypass.sql
--
-- submit_assignment must set submissions.final_snapshot_id after creating the
-- fallback snapshot, but guard_submission_grade_update correctly blocks
-- non-grade updates from authenticated users. Use a transaction-local GUC
-- that only this SECURITY DEFINER function sets, and allow the guard to pass
-- when it is active.

create or replace function public.guard_submission_grade_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
    and coalesce(current_setting('app.submit_assignment', true), '') <> 'on'
  then
    if new.assignment_id is distinct from old.assignment_id
      or new.student_id is distinct from old.student_id
      or new.final_snapshot_id is distinct from old.final_snapshot_id
      or new.status is distinct from old.status
      or new.submitted_at is distinct from old.submitted_at then
      raise exception 'Only grade, graded_at and graded_by may be updated';
    end if;
  end if;
  return new;
end;
$$;

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

  select class_id, language
    into target_class, assignment_language
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
        length(replace(coalesce(fallback_content, ''), E'\n', ''))
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
