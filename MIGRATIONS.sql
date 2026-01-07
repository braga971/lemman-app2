
/* ---------- COMMESSE ---------- */
alter table if exists public.commesse add column if not exists cantiere text;
alter table if exists public.commesse add column if not exists cantiere_binded boolean default true;

/* ---------- POSIZIONI ---------- */
/* no changes required */

/* ---------- TASKS / ATTIVITA ---------- */
alter table if exists public.tasks add column if not exists stato text default 'todo';
alter table if exists public.tasks add column if not exists photo_url text;
alter table if exists public.tasks add column if not exists photo_path text;
alter table if exists public.tasks add column if not exists photo_expires_at timestamptz;

/* ---------- TURNI ---------- */
alter table if exists public.turni add column if not exists week text;
alter table if exists public.turni add column if not exists range_from date;
alter table if exists public.turni add column if not exists range_to date;

/* ---------- RAPPORITINI ---------- */
alter table if exists public.rapportini add column if not exists cantiere text;
alter table if exists public.rapportini add column if not exists photo_url text;

/* ---------- STORAGE BUCKETS (optional via SQL; you can also create from dashboard) ---------- */
insert into storage.buckets (id, name, public)
values ('tasks-temp','tasks-temp', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('rapportini-foto','rapportini-foto', true)
on conflict (id) do nothing;

/* Policies - adjust to your security model */
/* TASKS: managers can insert for anyone; users can read their tasks and update stato; cleanup only manager */
-- Enable RLS if not already
alter table public.tasks enable row level security;

create policy if not exists "tasks_select_own" on public.tasks
for select using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

create policy if not exists "tasks_insert_manager" on public.tasks
for insert with check (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

create policy if not exists "tasks_update_own_stato" on public.tasks
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "tasks_update_manager" on public.tasks
for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

create policy if not exists "tasks_delete_manager" on public.tasks
for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

/* TURNI: user can read own; manager can insert */
alter table public.turni enable row level security;
create policy if not exists "turni_select_own" on public.turni
for select using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));
create policy if not exists "turni_insert_manager" on public.turni
for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));
create policy if not exists "turni_update_delete_manager" on public.turni
for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

/* COMMESSE/POSIZIONI: readable by all authenticated; write only manager */
alter table public.commesse enable row level security;
alter table public.posizioni enable row level security;

create policy if not exists "commesse_read" on public.commesse for select using (auth.role() = 'authenticated');
create policy if not exists "posizioni_read" on public.posizioni for select using (auth.role() = 'authenticated');

create policy if not exists "commesse_write_manager" on public.commesse for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

create policy if not exists "posizioni_write_manager" on public.posizioni for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

/* RAPPORITINI: user can insert/select own */
alter table public.rapportini enable row level security;
create policy if not exists "rapportini_select_own" on public.rapportini
for select using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));
create policy if not exists "rapportini_insert_own" on public.rapportini
for insert with check (auth.uid() = user_id);
/* ---------- PROFILES ROLE CHECK ---------- */
alter table if exists public.profiles
  add constraint if not exists profiles_role_check
  check (role in ('manager','user','archived'));
