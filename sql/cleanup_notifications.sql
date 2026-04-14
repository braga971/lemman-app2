-- Cleanup script per errori: relation "public.notifications" does not exist
-- Usare in Supabase SQL Editor o psql con utente con permessi adeguati.

-- 1) Opzione consigliata: rimuove qualsiasi trigger custom su shift_schedules
--    (spesso responsabile dell'inserimento in notifications)
do $$
declare r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'shift_schedules'
      and t.tgisinternal = false
  loop
    execute format('drop trigger %I on public.shift_schedules', r.tgname);
  end loop;
end $$;

-- 2) (Facoltativo) Elimina funzioni che contengono "notification" nel nome
--    NOTA: usare con attenzione; commentato di default
-- do $$
-- declare f record;
-- begin
--   for f in select n.nspname, p.proname from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname='public' and p.proname ilike '%notification%'
--   loop
--     execute format('drop function if exists %I.%I() cascade', f.nspname, f.proname);
--   end loop;
-- end $$;

-- 3) (Hotfix temporaneo) Crea tabella stub notifications per non rompere trigger residui
--    Sezione da usare SOLO se non è possibile rimuovere i trigger subito.
-- create table if not exists public.notifications (
--   id bigserial primary key,
--   user_id uuid,
--   title text,
--   body text,
--   meta jsonb,
--   created_at timestamptz default now()
-- );

