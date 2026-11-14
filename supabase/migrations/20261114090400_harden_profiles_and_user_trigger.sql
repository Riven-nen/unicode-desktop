-- 20261114090400_harden_profiles_and_user_trigger.sql
--
-- Closes the profile privilege-escalation hole and keeps the auth trigger safe
-- to re-run. No DROP/DELETE/TRUNCATE statements.
--
-- Why column privileges instead of a WITH CHECK:
--   A policy WITH CHECK only sees the NEW row, so it cannot compare against
--   the existing role. Row-level security also cannot restrict individual
--   columns. The reliable fix is to remove table-level UPDATE and grant
--   UPDATE only on the mutable columns. RLS still limits rows to the owner.
--
-- The guard trigger is defense in depth: even if a future grant restores
-- table-level UPDATE, a signed-in user still cannot change `role`.

revoke update on table public.profiles from anon, authenticated;
grant update (email, display_name) on table public.profiles to authenticated;

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() is null for service-role/admin connections and for the SQL
  -- editor, which is the only path that may promote a professor.
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'Changing profiles.role is not allowed';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'prevent_profile_role_change'
      and tgrelid = 'public.profiles'::regclass
  ) then
    create trigger prevent_profile_role_change
      before update on public.profiles
      for each row execute function public.prevent_profile_role_change();
  end if;
end $$;

revoke execute on function public.prevent_profile_role_change() from public, anon, authenticated;

-- Keep the signup trigger function; existing behavior is unchanged
-- (display_name from metadata, falling back to email).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Ensure the trigger exists without dropping it when it already does.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
