-- 20261114090200_professor_helpers.sql
--
-- SECURITY DEFINER helpers used by RLS. They bypass row-level security on the
-- tables they read, which avoids recursion between classes/enrollments/
-- assignments/submissions policies. Signed-in users need EXECUTE for policies
-- to evaluate; anonymous users do not, so EXECUTE is revoked from anon/public.

create or replace function public.is_professor_of_class(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.classes
    where classes.id = target and classes.professor_id = auth.uid()
  );
$$;

create or replace function public.is_enrolled_in_class(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments
    where enrollments.class_id = target and enrollments.student_id = auth.uid()
  );
$$;

create or replace function public.class_of_assignment(target uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select class_id from public.assignments where assignments.id = target;
$$;

create or replace function public.owns_submission(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.submissions
    where submissions.id = target and submissions.student_id = auth.uid()
  );
$$;

create or replace function public.is_professor_of_submission(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.submissions
    where submissions.id = target
      and public.is_professor_of_class(public.class_of_assignment(submissions.assignment_id))
  );
$$;

create or replace function public.is_professor_of_snapshot(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.code_snapshots
    where code_snapshots.id = target
      and public.is_professor_of_submission(code_snapshots.submission_id)
  );
$$;

create or replace function public.is_professor_of_student(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments
    join public.classes on classes.id = enrollments.class_id
    where enrollments.student_id = target and classes.professor_id = auth.uid()
  );
$$;

-- The legacy helper name is kept (enrollments_legacy still references it) but
-- now resolves against `classes`. This is the final step of option (b).
create or replace function public.is_course_professor(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.classes
    where classes.id = target and classes.professor_id = auth.uid()
  );
$$;

-- Execute privileges ---------------------------------------------------------
revoke execute on function public.is_professor_of_class(uuid) from public, anon;
revoke execute on function public.is_enrolled_in_class(uuid) from public, anon;
revoke execute on function public.class_of_assignment(uuid) from public, anon;
revoke execute on function public.owns_submission(uuid) from public, anon;
revoke execute on function public.is_professor_of_submission(uuid) from public, anon;
revoke execute on function public.is_professor_of_snapshot(uuid) from public, anon;
revoke execute on function public.is_professor_of_student(uuid) from public, anon;
revoke execute on function public.is_course_professor(uuid) from public, anon;

grant execute on function public.is_professor_of_class(uuid) to authenticated, service_role;
grant execute on function public.is_enrolled_in_class(uuid) to authenticated, service_role;
grant execute on function public.class_of_assignment(uuid) to authenticated, service_role;
grant execute on function public.owns_submission(uuid) to authenticated, service_role;
grant execute on function public.is_professor_of_submission(uuid) to authenticated, service_role;
grant execute on function public.is_professor_of_snapshot(uuid) to authenticated, service_role;
grant execute on function public.is_professor_of_student(uuid) to authenticated, service_role;
grant execute on function public.is_course_professor(uuid) to authenticated, service_role;
