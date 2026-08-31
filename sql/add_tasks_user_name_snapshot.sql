-- Salva il nome del dipendente dentro le attivita,
-- cosi lo storico resta leggibile anche se l'utente viene archiviato.

alter table if exists public.tasks
  add column if not exists user_name_snapshot text;

update public.tasks t
set user_name_snapshot = coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), t.user_name_snapshot)
from public.profiles p
where p.id = t.user_id
  and (
    t.user_name_snapshot is null
    or trim(t.user_name_snapshot) = ''
    or trim(t.user_name_snapshot) = t.user_id::text
  );
