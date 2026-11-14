-- 20261114090700_add_student_rpc.sql
--
-- Professors can read profiles only for students already in their classes
-- (profiles_select_own_or_class_professor), so the client cannot look up an
-- unenrolled student by email to create the enrollment. This security-definer
-- RPC performs the lookup and enrollment after verifying class ownership.

create or replace function public.add_student_to_class(target_class uuid, student_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_id uuid;
  normalized_email text := lower(trim(student_email));
begin
  if not public.is_professor_of_class(target_class) then
    raise exception 'You do not teach this class.';
  end if;

  select id into resolved_id
  from public.profiles
  where lower(email) = normalized_email
  limit 1;

  if resolved_id is null then
    raise exception 'No account found for %.', normalized_email;
  end if;

  insert into public.enrollments (class_id, student_id)
  values (target_class, resolved_id)
  on conflict (class_id, student_id) do nothing;

  return resolved_id;
end;
$$;

revoke all on function public.add_student_to_class(uuid, text) from public, anon;
grant execute on function public.add_student_to_class(uuid, text) to authenticated, service_role;
