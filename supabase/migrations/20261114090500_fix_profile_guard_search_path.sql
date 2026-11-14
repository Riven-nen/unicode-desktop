-- 20261114090500_fix_profile_guard_search_path.sql
--
-- Pin the search_path on the profile role guard and reduce anon access to the
-- pre-existing is_professor() helper. Both are security-advisor follow-ups to
-- the Step 1 migrations.

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'Changing profiles.role is not allowed';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_profile_role_change() from public, anon, authenticated;

-- Policies only ever evaluate this for the authenticated role; keep anon out.
revoke execute on function public.is_professor() from public, anon;
grant execute on function public.is_professor() to authenticated, service_role;
