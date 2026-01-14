-- Fix: Admin user creation fails with "permission denied for table profiles"
-- Rationale: During /admin/users (Dashboard) Supabase uses an internal DB role (e.g. supabase_admin)
-- which may run a trigger that inserts/updates public.profiles. Ensure privileges + RLS allow it.

-- 1) Grant schema/table privileges (GRANT controls; RLS still enforced separately)
do $$ begin
  perform 1;
  begin
    execute 'grant usage on schema public to supabase_admin';
    execute 'grant select, insert, update on table public.profiles to supabase_admin';
  exception when undefined_object then null; -- role may vary by project tier
  end;
  begin
    execute 'grant usage on schema public to supabase_auth_admin';
    execute 'grant select, insert, update on table public.profiles to supabase_auth_admin';
  exception when undefined_object then null;
  end;
end $$;

-- 2) RLS policies for the admin role(s) used by Dashboard flows
-- Note: 'to <role>' matches the current DB role executing the trigger/statement.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_admin_select'
  ) then
    create policy "profiles_admin_select" on public.profiles for select to supabase_admin using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_admin_insert'
  ) then
    create policy "profiles_admin_insert" on public.profiles for insert to supabase_admin with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_admin_update'
  ) then
    create policy "profiles_admin_update" on public.profiles for update to supabase_admin using (true) with check (true);
  end if;
exception when insufficient_privilege then
  -- fallback: ignore if current user cannot create policies (apply with a privileged connection)
  null;
end $$;

-- Optional: support alternate role name on some stacks
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_auth_admin_insert'
  ) then
    create policy "profiles_auth_admin_insert" on public.profiles for insert to supabase_auth_admin with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_auth_admin_update'
  ) then
    create policy "profiles_auth_admin_update" on public.profiles for update to supabase_auth_admin using (true) with check (true);
  end if;
exception when undefined_object then null;
end $$;

-- 3) (Optional) Inspect triggers on auth.users if error persists
-- select n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid)
-- from pg_trigger t
-- join pg_class c on t.tgrelid=c.oid
-- join pg_namespace n on n.oid=c.relnamespace
-- where n.nspname='auth' and c.relname in ('users','identities') and not t.tgisinternal;

