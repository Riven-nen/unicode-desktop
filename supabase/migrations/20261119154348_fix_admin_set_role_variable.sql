-- 20261119154348_fix_admin_set_role_variable.sql
--
-- `current_role` is a reserved SQL keyword, so the original admin_set_role
-- compared the database role name instead of the target profile's role and
-- skipped the professor-with-classes guard. Rename the variable.

create or replace function public.admin_set_role(target_profile uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_current_role text;
  class_count integer;
  admin_count integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an admin can change roles.';
  end if;
  if target_profile = auth.uid() then
    raise exception 'You cannot change your own role.';
  end if;
  if new_role not in ('student', 'professor', 'admin') then
    raise exception 'Unknown role.';
  end if;

  select role into target_current_role from public.profiles where id = target_profile;
  if target_current_role is null then
    raise exception 'User not found.';
  end if;
  if target_current_role = new_role then
    return;
  end if;

  if target_current_role = 'professor' and new_role <> 'professor' then
    select count(*) into class_count from public.classes where professor_id = target_profile;
    if class_count > 0 then
      raise exception 'Reassign or delete their classes before demoting this professor.';
    end if;
  end if;

  if target_current_role = 'admin' and new_role <> 'admin' then
    select count(*) into admin_count from public.profiles where role = 'admin';
    if admin_count <= 1 then
      raise exception 'At least one admin must remain.';
    end if;
  end if;

  update public.profiles set role = new_role where id = target_profile;
end;
$$;

revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
