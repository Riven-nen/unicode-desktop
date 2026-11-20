-- 20261120150000_professor_invites.sql
--
-- Admin-generated professor invitation codes. Admins choose a lifespan and a
-- usage limit. A signed-in student redeems a code and is promoted to
-- professor through a guarded RPC.
--
-- Writes go through SECURITY DEFINER functions; the table itself is read-only
-- for admins and invisible to everyone else.

create table if not exists public.professor_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  note text check (note is null or char_length(note) <= 120),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses between 1 and 1000),
  uses integer not null default 0 check (uses >= 0),
  revoked_at timestamptz,
  last_used_at timestamptz,
  last_used_by uuid references public.profiles (id) on delete set null
);

create index if not exists professor_invites_code_idx
  on public.professor_invites (code);

create index if not exists professor_invites_expiry_idx
  on public.professor_invites (expires_at);

alter table public.professor_invites enable row level security;

create policy "professor_invites_select_admin"
  on public.professor_invites
  for select to authenticated
  using (public.is_admin());

revoke all on public.professor_invites from anon, authenticated;
grant select on public.professor_invites to authenticated;
grant all on public.professor_invites to service_role;

-- The invitation RPC sets a transaction-local flag so the profile role guard
-- accepts the promotion without opening role changes to ordinary users.
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    and auth.uid() is not null
    and not public.is_admin()
    and coalesce(current_setting('app.professor_invite', true), '') <> 'on' then
    raise exception 'Changing profiles.role is not allowed';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_profile_role_change() from public, anon, authenticated;

create or replace function public.admin_create_professor_invite(
  lifespan_hours integer,
  allowed_uses integer,
  invite_note text default null
)
returns table (id uuid, code text, expires_at timestamptz, max_uses integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an admin can create professor invites.';
  end if;
  if lifespan_hours is null or lifespan_hours < 1 or lifespan_hours > 8760 then
    raise exception 'Choose a lifespan between 1 hour and 365 days.';
  end if;
  if allowed_uses is null or allowed_uses < 1 or allowed_uses > 1000 then
    raise exception 'Choose between 1 and 1000 uses.';
  end if;

  loop
    generated_code :=
      'PROF-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) ||
      '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    exit when not exists (
      select 1
        from public.professor_invites
       where professor_invites.code = generated_code
    );
  end loop;

  return query
    insert into public.professor_invites (
      code,
      note,
      created_by,
      expires_at,
      max_uses
    )
    values (
      generated_code,
      nullif(trim(coalesce(invite_note, '')), ''),
      auth.uid(),
      now() + make_interval(hours => lifespan_hours),
      allowed_uses
    )
    returning
      professor_invites.id,
      professor_invites.code,
      professor_invites.expires_at,
      professor_invites.max_uses;
end;
$$;

revoke all on function public.admin_create_professor_invite(integer, integer, text)
  from public, anon;
grant execute on function public.admin_create_professor_invite(integer, integer, text)
  to authenticated, service_role;

create or replace function public.admin_revoke_professor_invite(target_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an admin can revoke professor invites.';
  end if;

  update public.professor_invites
     set revoked_at = coalesce(revoked_at, now())
   where id = target_invite;

  if not found then
    raise exception 'Invite not found.';
  end if;
end;
$$;

revoke all on function public.admin_revoke_professor_invite(uuid) from public, anon;
grant execute on function public.admin_revoke_professor_invite(uuid)
  to authenticated, service_role;

create or replace function public.redeem_professor_invite(invite_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  target_invite public.professor_invites%rowtype;
begin
  if actor is null then
    raise exception 'Sign in to redeem a professor invite.';
  end if;
  if invite_code is null or length(trim(invite_code)) = 0 then
    raise exception 'Enter your professor invite code.';
  end if;

  select role into actor_role from public.profiles where id = actor;
  if actor_role is null then
    raise exception 'Profile not found.';
  end if;
  if actor_role <> 'student' then
    raise exception 'Only student accounts can redeem a professor invite.';
  end if;

  select *
    into target_invite
    from public.professor_invites
   where code = upper(trim(invite_code))
     for update;

  if not found then
    raise exception 'That professor invite code is not valid.';
  end if;
  if target_invite.revoked_at is not null then
    raise exception 'That professor invite has been revoked.';
  end if;
  if target_invite.expires_at <= now() then
    raise exception 'That professor invite has expired.';
  end if;
  if target_invite.uses >= target_invite.max_uses then
    raise exception 'That professor invite has reached its usage limit.';
  end if;

  update public.professor_invites
     set uses = uses + 1,
         last_used_at = now(),
         last_used_by = actor
   where id = target_invite.id;

  perform set_config('app.professor_invite', 'on', true);
  update public.profiles set role = 'professor' where id = actor;
  perform set_config('app.professor_invite', 'off', true);
end;
$$;

revoke all on function public.redeem_professor_invite(text) from public, anon;
grant execute on function public.redeem_professor_invite(text)
  to authenticated, service_role;
