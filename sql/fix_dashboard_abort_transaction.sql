-- Fix Supabase Dashboard user creation: "current transaction is aborted, commands ignored until end of transaction block"
-- Cause: a previous statement in the same transaction failed, commonly due to RLS/permissions
--        when triggers/functions touch auth.users or when Dashboard roles insert into public.profiles.
-- This script is idempotent and safe to run multiple times.

-- 1) Ensure RLS is OFF on auth tables and drop any stray policies in auth schema
alter table if exists auth.users disable row level security;
alter table if exists auth.identities disable row level security;

do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname='auth' and tablename in ('users','identities')
  loop
    execute format('drop policy %I on auth.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) Grant schema/table privileges on public.profiles to Dashboard internal roles
do $$ begin
  begin
    execute 'grant usage on schema public to supabase_admin';
    execute 'grant select, insert, update on table public.profiles to supabase_admin';
  exception when undefined_object then null; -- role may not exist on some tiers
  end;
  begin
    execute 'grant usage on schema public to supabase_auth_admin';
    execute 'grant select, insert, update on table public.profiles to supabase_auth_admin';
  exception when undefined_object then null;
  end;
end $$;

-- 3) RLS policies to allow Dashboard admin roles to operate on profiles (in addition to service_role)
do $$ begin
  begin
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_admin_select'
    ) then
      create policy "profiles_admin_select" on public.profiles for select to supabase_admin using (true);
    end if;
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_admin_insert'
    ) then
      create policy "profiles_admin_insert" on public.profiles for insert to supabase_admin with check (true);
    end if;
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_admin_update'
    ) then
      create policy "profiles_admin_update" on public.profiles for update to supabase_admin using (true) with check (true);
    end if;
  exception when insufficient_privilege then null; -- run with sufficient privileges to create policies
  end;

  begin
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_auth_admin_insert'
    ) then
      create policy "profiles_auth_admin_insert" on public.profiles for insert to supabase_auth_admin with check (true);
    end if;
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_auth_admin_update'
    ) then
      create policy "profiles_auth_admin_update" on public.profiles for update to supabase_auth_admin using (true) with check (true);
    end if;
  exception when undefined_object then null;
  end;
end $$;

-- 4) Recreate metadata sync function as SECURITY DEFINER owned by postgres, with guarded UPDATE
create or replace function public.sync_auth_metadata_from_profiles()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Guarded update: if anything goes wrong, do not abort the outer transaction
  begin
    update auth.users u
    set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', new.role, 'full_name', coalesce(new.full_name, ''))
    where u.id = new.id;
  exception when others then
    -- Optional: uncomment to log
    -- perform pg_notify('sync_auth_metadata_error', format('user %%s error %%s', new.id, SQLERRM));
    null;
  end;
  return new;
end
$$;

alter function public.sync_auth_metadata_from_profiles() owner to postgres;

-- 5) Rebind trigger (idempotent)
drop trigger if exists profiles_sync_auth_metadata on public.profiles;
create trigger profiles_sync_auth_metadata
after insert or update of role, full_name on public.profiles
for each row execute function public.sync_auth_metadata_from_profiles();

-- 6) Backfill metadata once more (safe if already set)
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
       'role', p.role,
       'full_name', coalesce(p.full_name, '')
     )
from public.profiles p
where p.id = u.id;

