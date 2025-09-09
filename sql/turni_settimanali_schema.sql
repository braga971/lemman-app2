-- Schema for new weekly shift planning (Turni Settimanali)
-- This does not drop old tables; it defines new ones used by the new UI.

create table if not exists public.cantieri (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamp with time zone default now()
);

create table if not exists public.turni_piano (
  id uuid primary key default gen_random_uuid(),
  cantiere_id uuid not null references public.cantieri(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  slot_key text not null,
  content text,
  created_at timestamp with time zone default now(),
  unique(cantiere_id, week_start, slot_key)
);

-- Optional RLS templates (enable and allow authenticated users; tighten as needed)
alter table public.cantieri enable row level security;
alter table public.turni_piano enable row level security;

do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='cantieri' and policyname='allow_all_authenticated_cantieri') then
    create policy "allow_all_authenticated_cantieri" on public.cantieri for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='turni_piano' and policyname='allow_all_authenticated_turni_piano') then
    create policy "allow_all_authenticated_turni_piano" on public.turni_piano for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

