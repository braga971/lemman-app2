-- RLS policies extracted from 2026-01_full_manager_setup.sql
-- Scope: ONLY row level security enables and policy definitions
-- Note: Manager check uses JWT claim user_metadata.role or top-level role
--   coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'

-- ================= RLS ENABLE =================
alter table if exists public.profiles enable row level security;
alter table if exists public.tasks enable row level security;
alter table if exists public.rapportini enable row level security;
alter table if exists public.commesse enable row level security;
alter table if exists public.posizioni enable row level security;
alter table if exists public.bacheca enable row level security;
alter table if exists public.cantieri enable row level security;
alter table if exists public.shift_schedules enable row level security;

-- storage.objects is enabled by default on Supabase; uncomment if needed
-- alter table if exists storage.objects enable row level security;

-- ================= PROFILES =================
-- Drop all existing profiles policies to avoid recursion
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='profiles'
  loop
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;
end
$$;

create policy "profiles_read_own"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles_manager_select"
on public.profiles for select
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

create policy "profiles_manager_update"
on public.profiles for update
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager')
with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

create policy "profiles_insert_service"
on public.profiles for insert to service_role
with check (true);

-- ================= TASKS =================
drop policy if exists "tasks read own or manager" on public.tasks;
drop policy if exists "tasks insert manager" on public.tasks;
drop policy if exists "tasks update manager" on public.tasks;
drop policy if exists "tasks delete manager" on public.tasks;
drop policy if exists "tasks_update_own_stato" on public.tasks;
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_manager" on public.tasks;

create policy "tasks read own or manager"
on public.tasks for select
using (
  auth.uid() = user_id
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);

create policy "tasks insert manager"
on public.tasks for insert
with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

create policy "tasks_update_own_stato"
on public.tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "tasks update manager"
on public.tasks for update
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

create policy "tasks delete manager"
on public.tasks for delete
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

-- ================= RAPPORTINI =================
drop policy if exists "rapportini read own or manager" on public.rapportini;
drop policy if exists "rapportini insert own" on public.rapportini;
drop policy if exists "rapportini update manager" on public.rapportini;
drop policy if exists "rapportini delete manager" on public.rapportini;

create policy "rapportini read own or manager"
on public.rapportini for select
using (
  auth.uid() = user_id
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);

create policy "rapportini insert own"
on public.rapportini for insert
with check (auth.uid() = user_id);

create policy "rapportini update manager"
on public.rapportini for update
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

create policy "rapportini delete manager"
on public.rapportini for delete
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

-- ================= COMMESSE =================
drop policy if exists "commesse read" on public.commesse;
drop policy if exists "commesse write" on public.commesse;
drop policy if exists "commesse update" on public.commesse;
drop policy if exists "commesse delete" on public.commesse;
create policy "commesse read" on public.commesse for select using (auth.role() = 'authenticated');
create policy "commesse write" on public.commesse for insert with check (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);
create policy "commesse update" on public.commesse for update using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);
create policy "commesse delete" on public.commesse for delete using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);

-- ================= POSIZIONI =================
drop policy if exists "posizioni read" on public.posizioni;
drop policy if exists "posizioni write" on public.posizioni;
drop policy if exists "posizioni update" on public.posizioni;
drop policy if exists "posizioni delete" on public.posizioni;
create policy "posizioni read" on public.posizioni for select using (auth.role() = 'authenticated');
create policy "posizioni write" on public.posizioni for insert with check (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);
create policy "posizioni update" on public.posizioni for update using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);
create policy "posizioni delete" on public.posizioni for delete using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);

-- ================= CANTIERI =================
drop policy if exists "cantieri read" on public.cantieri;
drop policy if exists "cantieri write" on public.cantieri;
drop policy if exists "cantieri update" on public.cantieri;
drop policy if exists "cantieri delete" on public.cantieri;
create policy "cantieri read" on public.cantieri for select using (auth.role() = 'authenticated');
create policy "cantieri write" on public.cantieri for insert with check (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);
create policy "cantieri update" on public.cantieri for update using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);
create policy "cantieri delete" on public.cantieri for delete using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);

-- ================= SHIFT_SCHEDULES =================
drop policy if exists "shift_schedules read" on public.shift_schedules;
drop policy if exists "shift_schedules write" on public.shift_schedules;
drop policy if exists "shift_schedules update" on public.shift_schedules;
drop policy if exists "shift_schedules delete" on public.shift_schedules;
create policy "shift_schedules read" on public.shift_schedules for select using (auth.role() = 'authenticated');
create policy "shift_schedules write" on public.shift_schedules for insert with check (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);
create policy "shift_schedules update" on public.shift_schedules for update using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);
create policy "shift_schedules delete" on public.shift_schedules for delete using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);

-- ================= BACHECA =================
drop policy if exists "bacheca_select_authenticated" on public.bacheca;
drop policy if exists "bacheca_write_manager" on public.bacheca;
create policy "bacheca_select_authenticated" on public.bacheca for select using (auth.role() = 'authenticated');
create policy "bacheca_write_manager" on public.bacheca for all
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager')
with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

-- ================= STORAGE (storage.objects) =================
-- Buckets are not created here; only RLS policies
drop policy if exists "rapportini-foto-insert-auth" on storage.objects;
create policy "rapportini-foto-insert-auth"
on storage.objects for insert to authenticated
with check (bucket_id = 'rapportini-foto');

drop policy if exists "tasks-temp-insert-manager" on storage.objects;
drop policy if exists "tasks-temp-delete-manager" on storage.objects;
create policy "tasks-temp-insert-manager"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tasks-temp'
  and coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);

create policy "tasks-temp-delete-manager"
on storage.objects for delete to authenticated
using (
  bucket_id = 'tasks-temp'
  and coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager'
);

-- Full control for service role (Edge functions)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='service_role_manage_storage'
  ) then
    create policy "service_role_manage_storage" on storage.objects
      for all to service_role using (true) with check (true);
  end if;
end $$;

