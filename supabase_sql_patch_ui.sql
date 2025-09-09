-- Patch per allineare schema con UI collegata
alter table public.rapportini add column if not exists photo_url text;
alter table public.tasks add column if not exists stato text default 'todo';
alter table public.turni add column if not exists orario text;
alter table public.turni add column if not exists sede text;
alter table public.bacheca add column if not exists title text;
-- Bucket per foto rapportini (crealo da Storage se non esiste, public)
-- In Supabase Dashboard: Storage -> New bucket -> name: rapportini-foto (public: ON)
