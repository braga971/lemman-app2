-- Keep CANTIERI as single source of truth
-- Safe, idempotent-ish migration for Supabase

-- 1) Unique index on lower(name)
create unique index if not exists cantieri_name_uniq on public.cantieri(lower(name));

-- 2) Backfill from commesse.cantiere distinct
insert into public.cantieri(name)
select distinct trim(c.cantiere)
from public.commesse c
where c.cantiere is not null
  and trim(c.cantiere) <> ''
  and lower(trim(c.cantiere)) not in (select lower(name) from public.cantieri);

-- 3) Normalize spaces
update public.cantieri
set name = trim(name)
where name is not null;

-- 4) RLS policies: enable and allow read to authenticated, write to admins/managers
alter table public.cantieri enable row level security;

drop policy if exists cantieri_select on public.cantieri;
create policy cantieri_select on public.cantieri
  for select to authenticated
  using (true);

drop policy if exists cantieri_write on public.cantieri;
create policy cantieri_write on public.cantieri
  for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','manager')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','manager')
  ));

-- 5) Trigger to keep cantieri in sync from commesse
create or replace function public.sync_cantieri_from_commesse()
returns trigger language plpgsql as $$
begin
  if new.cantiere is not null and trim(new.cantiere) <> '' then
    insert into public.cantieri(name)
    select trim(new.cantiere)
    where not exists (
      select 1 from public.cantieri c where lower(c.name) = lower(trim(new.cantiere))
    );
  end if;
  return new;
end$$;

drop trigger if exists trg_sync_cantieri on public.commesse;
create trigger trg_sync_cantieri
  after insert or update of cantiere on public.commesse
  for each row execute function public.sync_cantieri_from_commesse();

-- 6) Optional: grant select to anon if public listing is required (usually not)
-- grant select on table public.cantieri to anon;

