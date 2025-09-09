Questo pacchetto contiene i file aggiornati per:
- Bacheca (manager: crea/modifica/rimuove)
- Turni settimanali
- Tasks (allega foto su bucket 'attivita-foto')
- Utenti (crea/elimina utenti via Edge Functions + cambio ruolo)
- Reports (filtri completi + riepilogo ore; export CSV)
- Dashboard (KPI base)

Importante:
1) Crea i bucket Storage: 'attivita-foto' (pubblico) e, se vuoi, 'rapportini-foto'.
2) Esegui lo script SQL: supabase_sql_patch_plus.sql
3) Assicurati di avere deployate le funzioni edge create-user/delete-user e settati i secrets.

Integra i componenti nelle tue route/tab esistenti.
