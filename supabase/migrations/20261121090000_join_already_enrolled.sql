-- 20261121090000_join_already_enrolled.sql
--
-- Re-joining a class with the same join code used to return the class id
-- silently. Students need a clear message that they are already enrolled.

create or replace function public.join_class_by_code(target_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_student uuid := auth.uid();
  target_class uuid;
  target_class_code text;
  target_class_name text;
  normalized text := upper(trim(coalesce(target_code, '')));
begin
  if current_student is null then
    raise exception 'Sign in to join a class.';
  end if;
  if length(normalized) = 0 then
    raise exception 'Enter a class join code.';
  end if;

  select id, code, name
    into target_class, target_class_code, target_class_name
    from public.classes
   where join_code = normalized
     and archived_at is null;

  if target_class is null then
    raise exception 'That join code is not valid for an active class.';
  end if;

  insert into public.enrollments (class_id, student_id)
  values (target_class, current_student)
  on conflict (class_id, student_id) do nothing;

  if not found then
    raise exception 'You are already enrolled in %.',
      coalesce(nullif(trim(target_class_name), ''), target_class_code);
  end if;

  return target_class;
end;
$$;

revoke all on function public.join_class_by_code(text) from public, anon;
grant execute on function public.join_class_by_code(text) to authenticated;
