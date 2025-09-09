
-- 🔧 Schema updates for requested features (run in Supabase SQL editor)

-- 1) COMMESSE: add cantiere + descrizione + auto-bind flag
alter table if exists public.commesse
  add column if not exists cantiere text,
  add column if not exists descrizione text,
  add column if not exists cantiere_binded boolean not null default true;

-- 2) POSIZIONI: already exists -> no change

-- 3) TURNI: ensure fields exist
alter table if exists public.turni
  add column if not exists commessa_id uuid references public.commesse(id) on delete set null,
  add column if not exists orario text,
  add column if not exists sede text,
  add column if not exists turno text;

-- 4) TASKS: photo + expiry + optional commessa
alter table if exists public.tasks
  add column if not exists commessa_id uuid references public.commesse(id) on delete set null,
  add column if not exists photo_url text,
  add column if not exists expires_at date;

-- 5) RAPPORTINI: cantiere memo (auto-filled from commessa)
alter table if exists public.rapportini
  add column if not exists cantiere text,
  add column if not exists photo_url text;

-- 6) Storage buckets:
-- Create two buckets in Storage UI:
--   - rapportini-foto (Public: YES)
--   - attivita-foto-temp (Public: YES)

-- 7) RLS policies (adjust if already present)
-- profiles table should already have role text with 'user'|'manager'

-- Tasks: users can read their own; managers can read all; managers can insert for anyone; users can update stato of own task
alter table public.tasks enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='read_own_or_manager') then
    create policy "read_own_or_manager" on public.tasks for select
      using ( auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='insert_manager') then
    create policy "insert_manager" on public.tasks for insert
      with check ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='update_own_or_manager') then
    create policy "update_own_or_manager" on public.tasks for update
      using ( auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') )
      with check ( auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') );
  end if;
end $$;

-- Turni: users can read their own; managers can read all; managers insert
alter table public.turni enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='turni' and policyname='read_turni_own_or_manager') then
    create policy "read_turni_own_or_manager" on public.turni for select
      using ( auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='turni' and policyname='insert_turni_manager') then
    create policy "insert_turni_manager" on public.turni for insert
      with check ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') );
  end if;
end $$;

-- Rapportini: user can insert/select own; manager can read all
alter table public.rapportini enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='rapportini' and policyname='select_rapportini') then
    create policy "select_rapportini" on public.rapportini for select
      using ( auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='rapportini' and policyname='insert_rapportini_self') then
    create policy "insert_rapportini_self" on public.rapportini for insert
      with check ( auth.uid() = user_id );
  end if;
end $$;

-- Commesse/posizioni: managers only
alter table public.commesse enable row level security;
alter table public.posizioni enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commesse' and policyname='select_commesse_any') then
    create policy "select_commesse_any" on public.commesse for select using ( true );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commesse' and policyname='modify_commesse_manager') then
    create policy "modify_commesse_manager" on public.commesse for all
      using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') )
      with check ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='posizioni' and policyname='select_posizioni_any') then
    create policy "select_posizioni_any" on public.posizioni for select using ( true );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='posizioni' and policyname='modify_posizioni_manager') then
    create policy "modify_posizioni_manager" on public.posizioni for all
      using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') )
      with check ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager') );
  end if;
end $$;
