
# Lemman UI — Patch (settimane/attività foto temporanee/commesse-cantiere)
**Data:** 2025-08-26

## Cosa include
- `Amministrazione.jsx`
  - Commesse con **codice, cantiere, descrizione** e flag *cantiere_binded*.
  - Posizioni di commessa: **aggiungi / modifica / rimuovi**.
  - Nuovi "Turni settimanali": pianificazione testuale per cantiere e settimana.
  - Attività: assegna task con **foto temporanea** (bucket `tasks-temp`) e durata (default 14 gg) + pulsante **Pulisci foto scadute**.
- `Rapportini.jsx`: quando selezioni una **commessa**, il **cantiere si compila da solo** (se `cantiere_binded=true`).
  Rimosse le viste legacy dei turni giornalieri.
- `Home.jsx`: **attività divise** in **ieri / oggi / domani** con stato e link foto.
- `Attivita.jsx`: tab personale con **toggle** fatto/da fare e anteprima foto.
- `MIGRATIONS.sql`: alter tabelle + buckets + policy RLS minime.

## Come applicare
1. **Backup** del tuo progetto.
2. Sostituisci i file in `src/views/` con i file di questa patch.
3. Esegui `MIGRATIONS.sql` su Supabase (SQL editor).
4. In **Storage** crea (se non già presenti) due bucket **pubblici**:
   - `tasks-temp` (per foto temporanee dei task)
   - `rapportini-foto` (per foto dei rapportini)
5. Verifica le **policy** in `MIGRATIONS.sql` rispetto al tuo modello (ruolo `manager` in `profiles.role`).
6. Ricompila/riavvia Vite.

## Note operative
- Le foto dei task si caricano in `tasks-temp` in un path `{userId}/{YYYY-mm-dd}/{uuid}.{ext}`.
- Ogni attività può avere `photo_expires_at`. Il bottone *Pulisci foto scadute* rimuove dal bucket e azzera i campi.
- Se preferisci l'eliminazione **automatica**, crea un **cron** (Edge Function + Scheduled Trigger) che:
  - seleziona `tasks` con `photo_expires_at < now()`,
  - chiama `storage.remove` e pulisce i campi.
La pianificazione avviene per settimana (domenica→sabato) e slot predefiniti.
- Nel rapportino il campo **Cantiere** è **bloccato** quando la commessa ha `cantiere_binded=true`; altrimenti è editabile.

## Campi aggiunti (riassunto)
- `commesse.cantiere`, `commesse.cantiere_binded`
- `tasks.stato`, `tasks.photo_url`, `tasks.photo_path`, `tasks.photo_expires_at`
Nuove tabelle suggerite: `cantieri`, `turni_piano` (vedi `sql/turni_settimanali_schema.sql`).
- `rapportini.cantiere`, `rapportini.photo_url`

## TODO facoltativi
Aggancia **Realtime** su `tasks`, `commesse`, `posizioni`, `rapportini`.
- Validazioni extra e permessi granulari (es. delete posizioni solo se non referenziate).
- UI: badge colore su stato task; filtri per settimana.
