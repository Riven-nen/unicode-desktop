-- 20261120120000_scheduling_and_grade_release.sql
--
-- 1. Assignment scheduling: `publish_at` gates when students can see a
--    published assignment. A null value means "immediately".
-- 2. Grade release: professors save marks privately and release them later.
-- 3. A student-facing read model (`student_submissions`) masks unreleased
--    grades so the dashboard never shows a mark before it is released.

-- Assignment scheduling ------------------------------------------------------

alter table public.assignments
  add column if not exists publish_at timestamptz;

create index if not exists assignments_publish_at_idx
  on public.assignments (class_id, publish_at);

alter policy "assignments_select_class_members" on public.assignments
  using (
    public.is_professor_of_class(class_id)
    or (
      published
      and archived_at is null
      and (publish_at is null or publish_at <= now())
      and public.is_enrolled_in_class(class_id)
    )
  );

-- Grade release --------------------------------------------------------------

alter table public.submissions
  add column if not exists grade_released boolean not null default false,
  add column if not exists grade_released_at timestamptz;

-- Preserve the existing behaviour for grades that were already entered before
-- this migration: they become visible immediately.
update public.submissions
   set grade_released = true,
       grade_released_at = coalesce(grade_released_at, graded_at, now())
 where grade is not null
   and grade_released = false;

-- Student-facing read model. `security_invoker` keeps the caller's RLS in
-- force, and the WHERE clause keeps the view scoped to the signed-in student.
create or replace view public.student_submissions
with (security_invoker = true)
as
select
  s.id,
  s.assignment_id,
  s.student_id,
  s.submitted_at,
  s.status,
  case when s.grade_released then s.grade else null end as grade,
  case when s.grade_released then s.grade_released_at else null end as grade_released_at,
  (
    select count(*)::integer
      from public.comments c
     where c.submission_id = s.id
  ) as comment_count
from public.submissions s
where s.student_id = auth.uid();

grant select on public.student_submissions to authenticated, service_role;

-- Release one submission's grade, or hide it again.
create or replace function public.set_submission_grade_release(
  target_submission uuid,
  released boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_assignment uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to release grades.';
  end if;

  select assignment_id
    into target_assignment
    from public.submissions
   where id = target_submission;

  if target_assignment is null then
    raise exception 'Submission not found.';
  end if;

  if not public.is_professor_of_class(public.class_of_assignment(target_assignment)) then
    raise exception 'Only the class professor can release grades.';
  end if;

  update public.submissions
     set grade_released = released,
         grade_released_at = case
           when not released then null
           when grade_released then grade_released_at
           else now()
         end
   where id = target_submission
     and grade is not null;

  if not found then
    raise exception 'Save a grade before releasing it.';
  end if;
end;
$$;

revoke all on function public.set_submission_grade_release(uuid, boolean) from public, anon;
grant execute on function public.set_submission_grade_release(uuid, boolean)
  to authenticated, service_role;

-- Release every newly saved grade in an assignment and report how many moved.
create or replace function public.release_assignment_grades(target_assignment uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to release grades.';
  end if;

  if not public.is_professor_of_class(public.class_of_assignment(target_assignment)) then
    raise exception 'Only the class professor can release grades.';
  end if;

  update public.submissions
     set grade_released = true,
         grade_released_at = now()
   where assignment_id = target_assignment
     and grade is not null
     and not grade_released;

  get diagnostics released_count = row_count;
  return released_count;
end;
$$;

revoke all on function public.release_assignment_grades(uuid) from public, anon;
grant execute on function public.release_assignment_grades(uuid)
  to authenticated, service_role;
