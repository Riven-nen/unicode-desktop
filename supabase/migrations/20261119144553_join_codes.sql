-- 20261119144553_join_codes.sql
--
-- Class join codes let students enroll themselves without the professor
-- looking up their account first. Codes are short, uppercase, unique, and can
-- be rotated by the owning professor.

create or replace function public.generate_join_code()
returns text
language sql
volatile
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

alter table public.classes add column if not exists join_code text;

update public.classes
set join_code = public.generate_join_code()
where join_code is null;

alter table public.classes alter column join_code set default public.generate_join_code();
alter table public.classes alter column join_code set not null;

create unique index if not exists classes_join_code_idx on public.classes (join_code);

grant execute on function public.generate_join_code() to authenticated, service_role;

create or replace function public.join_class_by_code(target_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_student uuid := auth.uid();
  target_class uuid;
  normalized text := upper(trim(coalesce(target_code, '')));
begin
  if current_student is null then
    raise exception 'Sign in to join a class.';
  end if;
  if length(normalized) = 0 then
    raise exception 'Enter a class join code.';
  end if;

  select id
    into target_class
    from public.classes
    where join_code = normalized
      and archived_at is null;

  if target_class is null then
    raise exception 'That join code is not valid for an active class.';
  end if;

  insert into public.enrollments (class_id, student_id)
  values (target_class, current_student)
  on conflict (class_id, student_id) do nothing;

  return target_class;
end;
$$;

revoke all on function public.join_class_by_code(text) from public, anon;
grant execute on function public.join_class_by_code(text) to authenticated;

create or replace function public.rotate_class_join_code(target_class uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to rotate a join code.';
  end if;
  if not public.is_professor_of_class(target_class) then
    raise exception 'You do not teach this class.';
  end if;

  -- Retry the (very unlikely) unique-code collision.
  for attempt in 1..5 loop
    begin
      update public.classes
      set join_code = public.generate_join_code()
      where id = target_class
      returning join_code into new_code;
      return new_code;
    exception when unique_violation then
      -- try again
    end;
  end loop;

  raise exception 'Could not generate a join code. Try again.';
end;
$$;

revoke all on function public.rotate_class_join_code(uuid) from public, anon;
grant execute on function public.rotate_class_join_code(uuid) to authenticated;
