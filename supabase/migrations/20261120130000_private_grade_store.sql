-- 20261120130000_private_grade_store.sql
--
-- Grade release needs database-level enforcement: a student who calls the
-- Supabase API directly must not be able to read an unreleased mark.
--
-- Private marks live in `submission_grades`, which only the class professor
-- can read. `submissions.grade` is the published copy and stays NULL until the
-- professor releases the mark.

create table if not exists public.submission_grades (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  grade numeric not null check (grade >= 0 and grade <= 100),
  graded_at timestamptz,
  graded_by uuid references public.profiles (id) on delete set null
);

alter table public.submission_grades enable row level security;

create policy "submission_grades_select_class_professor"
  on public.submission_grades
  for select to authenticated
  using (public.is_professor_of_submission(submission_id));

create policy "submission_grades_insert_class_professor"
  on public.submission_grades
  for insert to authenticated
  with check (public.is_professor_of_submission(submission_id));

create policy "submission_grades_update_class_professor"
  on public.submission_grades
  for update to authenticated
  using (public.is_professor_of_submission(submission_id))
  with check (public.is_professor_of_submission(submission_id));

create policy "submission_grades_delete_class_professor"
  on public.submission_grades
  for delete to authenticated
  using (public.is_professor_of_submission(submission_id));

grant select, insert, update, delete on public.submission_grades to authenticated;
grant all on public.submission_grades to service_role;

-- Move existing marks into the private store. Already-released grades stay on
-- submissions so students keep seeing them; unreleased grades are removed from
-- the public row.
insert into public.submission_grades (submission_id, grade, graded_at, graded_by)
select id, grade, graded_at, graded_by
  from public.submissions
 where grade is not null
on conflict (submission_id) do nothing;

update public.submissions
   set grade = null
 where grade is not null
   and not grade_released;

-- Save a mark privately and hide any previously released value.
create or replace function public.save_submission_grade(
  target_submission uuid,
  target_grade numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target_assignment uuid;
begin
  if actor is null then
    raise exception 'Sign in to save a grade.';
  end if;
  if target_grade is null or target_grade < 0 or target_grade > 100 then
    raise exception 'Enter a grade between 0 and 100.';
  end if;

  select assignment_id
    into target_assignment
    from public.submissions
   where id = target_submission;

  if target_assignment is null then
    raise exception 'Submission not found.';
  end if;

  if not public.is_professor_of_class(public.class_of_assignment(target_assignment)) then
    raise exception 'Only the class professor can grade this submission.';
  end if;

  insert into public.submission_grades (submission_id, grade, graded_at, graded_by)
  values (target_submission, target_grade, now(), actor)
  on conflict (submission_id) do update
    set grade = excluded.grade,
        graded_at = excluded.graded_at,
        graded_by = excluded.graded_by;

  update public.submissions
     set grade = null,
         grade_released = false,
         grade_released_at = null,
         graded_at = now(),
         graded_by = actor
   where id = target_submission;
end;
$$;

revoke all on function public.save_submission_grade(uuid, numeric) from public, anon;
grant execute on function public.save_submission_grade(uuid, numeric)
  to authenticated, service_role;

-- Release (or hide) one submission's grade from the private store.
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
  private_grade numeric;
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

  if released then
    select grade
      into private_grade
      from public.submission_grades
     where submission_id = target_submission;

    if not found then
      raise exception 'Save a grade before releasing it.';
    end if;

    update public.submissions
       set grade = private_grade,
           grade_released = true,
           grade_released_at = case
             when grade_released then grade_released_at
             else now()
           end
     where id = target_submission;
  else
    update public.submissions
       set grade = null,
           grade_released = false,
           grade_released_at = null
     where id = target_submission;
  end if;
end;
$$;

revoke all on function public.set_submission_grade_release(uuid, boolean) from public, anon;
grant execute on function public.set_submission_grade_release(uuid, boolean)
  to authenticated, service_role;

-- Release every saved grade in an assignment and report how many moved.
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

  update public.submissions s
     set grade = g.grade,
         grade_released = true,
         grade_released_at = now()
    from public.submission_grades g
   where g.submission_id = s.id
     and s.assignment_id = target_assignment
     and not s.grade_released;

  get diagnostics released_count = row_count;
  return released_count;
end;
$$;

revoke all on function public.release_assignment_grades(uuid) from public, anon;
grant execute on function public.release_assignment_grades(uuid)
  to authenticated, service_role;
