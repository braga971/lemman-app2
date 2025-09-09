# LEMMAN UI wired (layout clone + Supabase)

## Setup
1) `npm i`
2) `cp .env.example .env` e compila `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3) Esegui in Supabase lo script `supabase_sql_patch_ui.sql` per aggiungere colonne usate dalla UI (se mancano).
4) Crea bucket **public** `rapportini-foto` in Storage (per upload foto rapportini).
5) Abilita Realtime su: commesse, posizioni, tasks, bacheca, rapportini.
6) Avvia: `npm run dev`

Ruoli:
- `profiles.role='manager'` → vede tab Amministrazione/Dashboard/Report e può fare CRUD globale.
- `profiles.role='user'` → vede solo proprie attività; può inviare rapportini; bacheca in lettura.

## Dove collegato al DB
- Home: tasks (tuoi), bacheca (tutti).
- Amministrazione: crea commesse/posizioni, approva/rifiuta rapportini.
- Rapportini: invio con **upload foto** su bucket `rapportini-foto`, storico settimana corrente.
- Attività: segna done/todo.
- Bacheca: manager può postare/eliminare; utenti leggono.
