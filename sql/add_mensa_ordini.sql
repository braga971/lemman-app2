-- Sezione Mensa
-- Ogni dipendente puo salvare una sola scelta per giorno.
-- L'ordine puo contenere piu voci: primo, secondo, contorno, pizza, panino, insalatona.

create table if not exists public.mensa_ordini (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  servizio text not null default 'pranzo' check (servizio in ('pranzo','cena')),
  cantiere text not null default '',
  scelta text not null,
  items jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  extra_items jsonb not null default '[]'::jsonb,
  extra_message text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, data)
);

-- Aggiorna installazioni dove la tabella era gia stata creata con la prima versione.
alter table public.mensa_ordini
  add column if not exists servizio text not null default 'pranzo',
  add column if not exists cantiere text not null default '',
  add column if not exists items jsonb not null default '{}'::jsonb,
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists extra_items jsonb not null default '[]'::jsonb,
  add column if not exists extra_message text;

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.mensa_ordini'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%scelta%'
  loop
    execute format('alter table public.mensa_ordini drop constraint %I', r.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mensa_ordini'::regclass
      and conname = 'mensa_ordini_servizio_check'
  ) then
    alter table public.mensa_ordini
      add constraint mensa_ordini_servizio_check
      check (servizio in ('pranzo','cena'));
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mensa_ordini_set_updated_at on public.mensa_ordini;
create trigger mensa_ordini_set_updated_at
before update on public.mensa_ordini
for each row execute function public.set_updated_at();

create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'manager'
  );
$$;

create or replace function public.is_mensa_user()
returns boolean
language sql
stable
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'mensa@lemman.it'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() ->> 'role', '') = 'mensa';
$$;

alter table public.mensa_ordini enable row level security;
grant select, insert, update, delete on table public.mensa_ordini to authenticated;

drop policy if exists "mensa_select_own_or_manager" on public.mensa_ordini;
drop policy if exists "mensa_insert_own" on public.mensa_ordini;
drop policy if exists "mensa_update_own_or_manager" on public.mensa_ordini;
drop policy if exists "mensa_delete_own_or_manager" on public.mensa_ordini;

create policy "mensa_select_own_or_manager"
on public.mensa_ordini for select
to authenticated
using (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_manager() or public.is_mensa_user())
);

create policy "mensa_insert_own"
on public.mensa_ordini for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
);

create policy "mensa_update_own_or_manager"
on public.mensa_ordini for update
to authenticated
using (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_manager())
)
with check (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_manager())
);

create policy "mensa_delete_own_or_manager"
on public.mensa_ordini for delete
to authenticated
using (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_manager())
);

drop policy if exists "profiles_mensa_select" on public.profiles;
create policy "profiles_mensa_select"
on public.profiles for select
using (public.is_mensa_user());

-- Mantiene visibili gli utenti ai manager anche dopo l'aggiunta del ruolo Mensa.
drop policy if exists "profiles_manager_select" on public.profiles;
drop policy if exists "profiles_manager_update" on public.profiles;

create policy "profiles_manager_select"
on public.profiles for select
using (public.is_manager());

create policy "profiles_manager_update"
on public.profiles for update
using (public.is_manager())
with check (public.is_manager());
