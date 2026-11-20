-- 20261119153203_admin_role.sql
--
-- Adds a third profile role for the separate admin web console. Admins can
-- read user/class metadata (never submissions or code) and change roles
-- through a guarded RPC. All other profile permissions stay unchanged.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['student'::text, 'professor'::text, 'admin'::text]));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create policy "profiles_select_admin" on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy "classes_select_admin" on public.classes
  for select to authenticated
  using (public.is_admin());

create policy "enrollments_select_admin" on public.enrollments
  for select to authenticated
  using (public.is_admin());

create policy "assignments_select_admin" on public.assignments
  for select to authenticated
  using (public.is_admin());

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    and auth.uid() is not null
    and not public.is_admin() then
    raise exception 'Changing profiles.role is not allowed';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_profile_role_change() from public, anon, authenticated;

create or replace function public.admin_set_role(target_profile uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
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

  select role into current_role from public.profiles where id = target_profile;
  if current_role is null then
    raise exception 'User not found.';
  end if;
  if current_role = new_role then
    return;
  end if;

  if current_role = 'professor' and new_role <> 'professor' then
    select count(*) into class_count from public.classes where professor_id = target_profile;
    if class_count > 0 then
      raise exception 'Reassign or delete their classes before demoting this professor.';
    end if;
  end if;

  if current_role = 'admin' and new_role <> 'admin' then
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
