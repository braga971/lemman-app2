-- Fix manager permissions when the role is stored in public.profiles
-- instead of inside the Supabase Auth JWT metadata.
--
-- Run this once in Supabase SQL Editor.

create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'manager'
  );
$$;

grant execute on function public.is_manager() to authenticated;

-- PROFILES
drop policy if exists "profiles_manager_select" on public.profiles;
drop policy if exists "profiles_manager_update" on public.profiles;

create policy "profiles_manager_select"
on public.profiles for select
using (public.is_manager());

create policy "profiles_manager_update"
on public.profiles for update
using (public.is_manager())
with check (public.is_manager());

-- TASKS
drop policy if exists "tasks read own or manager" on public.tasks;
drop policy if exists "tasks insert manager" on public.tasks;
drop policy if exists "tasks update manager" on public.tasks;
drop policy if exists "tasks delete manager" on public.tasks;

create policy "tasks read own or manager"
on public.tasks for select
using (auth.uid() = user_id or public.is_manager());

create policy "tasks insert manager"
on public.tasks for insert
with check (public.is_manager());

create policy "tasks update manager"
on public.tasks for update
using (public.is_manager())
with check (public.is_manager());

create policy "tasks delete manager"
on public.tasks for delete
using (public.is_manager());

-- RAPPORTINI
drop policy if exists "rapportini read own or manager" on public.rapportini;
drop policy if exists "rapportini update manager" on public.rapportini;
drop policy if exists "rapportini delete manager" on public.rapportini;

create policy "rapportini read own or manager"
on public.rapportini for select
using (auth.uid() = user_id or public.is_manager());

create policy "rapportini update manager"
on public.rapportini for update
using (public.is_manager())
with check (public.is_manager());

create policy "rapportini delete manager"
on public.rapportini for delete
using (public.is_manager());

-- COMMESSE
drop policy if exists "commesse write" on public.commesse;
drop policy if exists "commesse update" on public.commesse;
drop policy if exists "commesse delete" on public.commesse;

create policy "commesse write"
on public.commesse for insert
with check (public.is_manager());

create policy "commesse update"
on public.commesse for update
using (public.is_manager())
with check (public.is_manager());

create policy "commesse delete"
on public.commesse for delete
using (public.is_manager());

-- POSIZIONI
drop policy if exists "posizioni write" on public.posizioni;
drop policy if exists "posizioni update" on public.posizioni;
drop policy if exists "posizioni delete" on public.posizioni;

create policy "posizioni write"
on public.posizioni for insert
with check (public.is_manager());

create policy "posizioni update"
on public.posizioni for update
using (public.is_manager())
with check (public.is_manager());

create policy "posizioni delete"
on public.posizioni for delete
using (public.is_manager());

-- CANTIERI
drop policy if exists "cantieri write" on public.cantieri;
drop policy if exists "cantieri update" on public.cantieri;
drop policy if exists "cantieri delete" on public.cantieri;

create policy "cantieri write"
on public.cantieri for insert
with check (public.is_manager());

create policy "cantieri update"
on public.cantieri for update
using (public.is_manager())
with check (public.is_manager());

create policy "cantieri delete"
on public.cantieri for delete
using (public.is_manager());

-- TURNI
drop policy if exists "shift_schedules write" on public.shift_schedules;
drop policy if exists "shift_schedules update" on public.shift_schedules;
drop policy if exists "shift_schedules delete" on public.shift_schedules;

create policy "shift_schedules write"
on public.shift_schedules for insert
with check (public.is_manager());

create policy "shift_schedules update"
on public.shift_schedules for update
using (public.is_manager())
with check (public.is_manager());

create policy "shift_schedules delete"
on public.shift_schedules for delete
using (public.is_manager());

-- BACHECA
drop policy if exists "bacheca_write_manager" on public.bacheca;

create policy "bacheca_write_manager"
on public.bacheca for all
using (public.is_manager())
with check (public.is_manager());
