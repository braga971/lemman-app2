
LEMMan UI - Modifiche 26/08/2025

Cosa è stato fatto
- Amministrazione:
  • Commesse ora hanno: codice, cantiere, descrizione (+ flag cantiere_binded).
  • Posizioni di commessa: aggiungi / modifica inline / rimuovi.
  • Turni settimanali: pianificazione per cantiere e settimana con slot predefiniti.
  • Attività: assegnazione con upload foto temporanea (bucket 'attivita-foto-temp'), con scadenza automatica (TTL 14 giorni) e pulizia best-effort all'apertura della pagina.

- Rapportini:
  • Selezionando la commessa, il campo Cantiere si compila automaticamente e rimane in sola lettura.
  • Posizioni filtrate in base alla commessa.

- Home:
  • Attività divise per Ieri/Oggi/Domani con possibilità di spuntare completato.

- Turni: rimosso flusso legacy, sostituito da pianificazione settimanale.
  • Vista raggruppata per settimana con range (lun → dom).

Setup Supabase
1) Variabili .env:
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...

2) Esegui lo script SQL:
   file: lemman-ui-wired/sql/20250826_changes.sql

3) Crea i bucket Storage (Public: YES):
   - rapportini-foto
   - attivita-foto-temp

Note
- La pulizia delle foto temporanee è eseguita “best-effort” lato client all'apertura di Amministrazione (elimina i file più vecchi di 14 giorni). Se desideri una pulizia certa, crea una Edge Function/cron.
- RLS: vedi lo script SQL per le policy suggerite. I manager sono determinati da profiles.role='manager'.
