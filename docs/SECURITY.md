## Sicurezza e Deploy

1) Buckets Storage
- Crea `rapportini-foto` e `tasks-temp` (inizialmente puoi lasciarli pubblici per non rompere nulla).
- Applica `sql/migration_secure_2026_01.sql` (aggiunge `photo_path`, policy prefisso utente e service role). Quando pronto, imposta i bucket su privati.

2) Edge Functions
- Deploya le funzioni in `supabase/functions/`: `create-user`, `delete-user`, `get-signed-url`, `delete-activity-photo`.
- Imposta secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

3) RLS tabelle
- Applica `sql/migration_secure_2026_01.sql` per: fix insert `rapportini`, select manager su `profiles`, cleanup policy duplicate/permissive.

4) Frontend
- La UI salva `photo_path` e richiede URL firmati via funzione `get-signed-url` per mostrare le foto.
  Le foto vecchie con `photo_url` continueranno a funzionare finché il bucket sarà pubblico.
