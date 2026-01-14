# Lemman App (Supabase)

## Setup
- Install: `npm i`
- Env: copia `.env.example` in `.env` e compila `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Supabase: esegui in SQL editor lo script unico `sql/2026-01_full_manager_setup.sql`.
- Realtime: abilita su `commesse`, `posizioni`, `tasks`, `bacheca`, `rapportini`.
- Avvio: `npm run dev`

## Ruoli
- Manager: vede Amministrazione/Dashboard/Report, CRUD globale, assegna attività.
- User: vede e gestisce solo i propri dati; bacheca in lettura.
<<<<<<< HEAD

### Promuovi a manager + refresh JWT
Esegui in Supabase:

```
update public.profiles set role='manager' where email ilike 'tua-email@dominio';
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', p.role, 'full_name', coalesce(p.full_name,''))
from public.profiles p
where p.id = u.id;
```

Poi fai logout/login nell’app per rigenerare il token con `role=manager`.

## Sezioni dell’app
- Home: task utente, bacheca, riepiloghi manager (ieri/oggi/domani).
- Attività: task personali (toggle done/todo). I manager assegnano attività per cantiere.
- Rapportini: invio con foto; storico settimanale.
- Amministrazione: commesse, posizioni, approvazione rapportini.
- Bacheca: manager pubblica/elimina; utenti leggono.

## Edge Functions (gestione utenti)
- Funzioni: `create-user` e `delete-user` in `supabase/functions/`.
- Secrets richiesti: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (mai nel client).
- Deploy (CLI Supabase):
```
supabase functions deploy create-user
supabase functions deploy delete-user
```
Le funzioni richiedono un `Authorization: Bearer <access_token>` di un utente con ruolo `manager` (vedi sezione Ruoli). Assicurati di impostare i secrets nel progetto Supabase:
```
supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
```

## SQL unico (one-shot)
- Percorso: `sql/2026-01_full_manager_setup.sql`
- Cosa fa: tabelle necessarie, RLS/policy basate su JWT (niente ricorsione su `profiles`), buckets Storage, sync e backfill dei metadata `auth.users`.
=======

### Promuovi a manager + refresh JWT
Esegui in Supabase:

```
update public.profiles set role='manager' where email ilike 'tua-email@dominio';
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', p.role, 'full_name', coalesce(p.full_name,''))
from public.profiles p
where p.id = u.id;
```

Poi fai logout/login nell’app per rigenerare il token con `role=manager`.

## Sezioni dell’app
- Home: task utente, bacheca, riepiloghi manager (ieri/oggi/domani).
- Attività: task personali (toggle done/todo). I manager assegnano attività per cantiere.
- Rapportini: invio con foto; storico settimanale.
- Amministrazione: commesse, posizioni, approvazione rapportini.
- Bacheca: manager pubblica/elimina; utenti leggono.

## Edge Functions (gestione utenti)
- Funzioni: `create-user` e `delete-user` in `functions/`.
- Secrets richiesti: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (mai nel client).
- Deploy (CLI Supabase):
```
supabase functions deploy create-user --no-verify-jwt
supabase functions deploy delete-user --no-verify-jwt
```

## SQL unico (one-shot)
- Percorso: `sql/2026-01_full_manager_setup.sql`
- Cosa fa: tabelle necessarie, RLS/policy basate su JWT (niente ricorsione su `profiles`), buckets Storage, sync e backfill dei metadata `auth.users`.

>>>>>>> c9c761788eb79852406ce48b4635d6635e17707d
