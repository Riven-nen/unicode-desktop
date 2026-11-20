-- 20261114091500_lifecycle_and_bulk_roster.sql
--
-- Professor lifecycle: archive classes/assignments, publish drafts, due dates,
-- and a bulk roster insert that reports a result per email.
--
-- Students see published, non-archived assignments in non-archived classes.

alter table public.classes
  add column if not exists archived_at timestamptz;

alter table public.assignments
  add column if not exists archived_at timestamptz;

alter table public.assignments
  add column if not exists published boolean not null default true;

alter table public.assignments
  add column if not exists due_at timestamptz;

create index if not exists assignments_published_idx
  on public.assignments (class_id, published, created_at);

-- Students should not discover archived classes at all.
alter policy "classes_select_enrolled_or_professor" on public.classes
  using (
    professor_id = auth.uid()
    or (archived_at is null and public.is_enrolled_in_class(id))
  );

-- Drafts and archived assignments are professor-only.
alter policy "assignments_select_class_members" on public.assignments
  using (
    public.is_professor_of_class(class_id)
    or (
      published
      and archived_at is null
      and public.is_enrolled_in_class(class_id)
    )
  );

-- Bulk roster import. The result is one row per distinct email so the UI can
-- show exactly what was added, skipped, or unknown.
create or replace function public.add_students_to_class(
  target_class uuid,
  student_emails text[]
)
returns table(student_email text, result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text;
  student_profile uuid;
begin
  if not public.is_professor_of_class(target_class) then
    raise exception 'You do not teach this class.';
  end if;

  for requested in
    select distinct lower(trim(value))
    from unnest(student_emails) as value
    where length(trim(value)) > 0
  loop
    select profiles.id
      into student_profile
      from public.profiles
      where lower(profiles.email) = requested
      limit 1;

    if student_profile is null then
      student_email := requested;
      result := 'not_found';
      return next;
    elsif exists (
      select 1
      from public.enrollments
      where enrollments.class_id = target_class
        and enrollments.student_id = student_profile
    ) then
      student_email := requested;
      result := 'already_enrolled';
      return next;
    else
      insert into public.enrollments (class_id, student_id)
      values (target_class, student_profile);
      student_email := requested;
      result := 'added';
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function public.add_students_to_class(uuid, text[]) from public, anon;
grant execute on function public.add_students_to_class(uuid, text[])
  to authenticated, service_role;
