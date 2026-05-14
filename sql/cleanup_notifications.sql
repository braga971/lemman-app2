-- Cleanup script per errori: relation "public.notifications" does not exist
-- Usare in Supabase SQL Editor o psql con utente con permessi adeguati.
--
-- L'app non usa piu notifiche. Se nel database sono rimasti trigger legacy
-- su rapportini/tasks/shift_schedules che chiamano funzioni notification,
-- gli update possono fallire anche se il codice React non tocca notifications.

-- 1) Rimuove i trigger custom su rapportini.
--    L'approvazione rapportini aggiorna public.rapportini; se un vecchio trigger
--    prova a scrivere in public.notifications, l'update fallisce.
do $$
declare r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'rapportini'
      and t.tgisinternal = false
  loop
    execute format('drop trigger %I on public.rapportini', r.tgname);
  end loop;
end $$;

-- 2) (Hotfix temporaneo) Crea tabella stub notifications per non rompere trigger residui
--    Sezione da usare SOLO se non è possibile rimuovere i trigger subito.
-- create table if not exists public.notifications (
--   id bigserial primary key,
--   user_id uuid,
--   title text,
--   body text,
--   meta jsonb,
--   created_at timestamptz default now()
-- );
