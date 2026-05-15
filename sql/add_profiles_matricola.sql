-- Adds an employee number used to order workers by hiring/order in reports.
alter table if exists public.profiles
  add column if not exists matricola integer;

create index if not exists profiles_matricola_idx
  on public.profiles (matricola);
