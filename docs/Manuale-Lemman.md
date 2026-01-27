# Manuale d'Uso — Lemman App

Questo manuale spiega come usare Lemman App sia per il Dipendente sia per il Manager. Contiene i flussi principali (Attività e Rapportini), cosa aspettarsi dalle foto, e dove trovare le funzioni di amministrazione.

---

Nota su schermate e immagini
- In questo manuale sono previsti riquadri con schermate aggiornate dell'app. Inserisci i file PNG/JPG indicati nel percorso `docs/images/` con i nomi suggeriti sotto. Il PDF includerà automaticamente le immagini.
- Consiglio: cattura a 1366×768 o 1440×900, zoom 100%. Evita dati sensibili reali.

## 1) Accesso e Navigazione

- **Login**: accedi con le tue credenziali. Se non ricordi la password, usa la funzione di reset.
- **Barra Navigazione**: in alto trovi le sezioni principali:
  - Home, Attività, Rapportini, Bacheca, Turni Settimanali.
  - Se sei Manager: anche Amministrazione, Utenti, Dashboard, Report.

Schermata
![Login](images/login.png)
![Navbar](images/navbar.png)

---

## 2) Dipendente — Attività

- **Dove**: Tab “Attività”.
- **Vedere le Attività**: la tabella mostra le attività assegnate al tuo utente (per data, titolo, stato e foto).
- **Aprire Foto Attività**:
  - Se c’è una foto, premi “apri” per visualizzarla.
  - Dopo l’apertura, la foto viene eliminata automaticamente.
  - Se non la apri, la foto viene eliminata automaticamente il giorno successivo.
- **Completare un’Attività**:
  - Usa il pulsante “Completa”/“Segna da fare” per cambiare lo stato.
  - Lo stato verrà mostrato come “fatta” o “da completare”.

Note:
- Non è presente il pulsante “Elimina foto” per il dipendente: la foto si elimina in automatico.

Schermate
![Attività – Elenco dipendente](images/attivita-dipendente-lista.png)
![Attività – Foto disponibile (apri)](images/attivita-dipendente-foto-apri.png)

---

## 3) Dipendente — Rapportini

- **Dove**: Tab “Rapportini”.
- **Inserire un Rapportino**:
  1. Compila Data, Ore, Commessa, Posizione, Cantiere e Descrizione.
  2. (Opzionale) Carica una **foto**: viene salvata nel rapportino e sarà visibile al Manager.
  3. Conferma con “Salva/Inserisci”.
- **Validazione**: se mancano campi obbligatori, l’app lo segnala.

---

## 4) Manager — Home (Riepilogo Attività)

- **Dove**: Tab “Home”, sezione “Attività per cantiere”.
- **Data**: scegli la data da analizzare.
- **Legenda Stato**:
  - “completato” = attività concluse.
  - “da completare” = attività ancora aperte.

Schermata
![Home Manager – Riepilogo attività per cantiere](images/home-manager-riepilogo.png)

---

## 5) Manager — Assegnare Attività (con Foto)

- **Dove**: Tab “Amministrazione”, sezione “Assegna Attività”.
- **Seleziona**: Data e Cantiere.
- **Aggiungi/Modifica Riga**:
  1. Seleziona il **Dipendente**.
  2. Inserisci la **Descrizione attività**.
  3. (Opzionale) Carica una **Foto**:
     - Se Dipendente, Descrizione e Cantiere sono compilati, l’upload parte **in automatico** al cambio file.
     - La foto diventa subito disponibile al dipendente nella sua sezione “Attività”.
  4. Il link “apri” accanto al campo file ti consente di verificare la foto già caricata su quella riga.
- **Assegna tutte**: pulsante per salvare in blocco eventuali righe non ancora salvate automaticamente.

Note sulle Foto Attività:
- Il Dipendente, cliccando “apri”, vede e poi la foto viene eliminata automaticamente.
- Se non viene aperta, la foto scade e si elimina automaticamente il giorno successivo.

---

## 6) Manager — Rapportini (revisione)

- **Dove**: Tab “Rapportini”, sezione “Ultimi Rapportini”.
- **Cosa vedi**: elenco degli ultimi rapportini inseriti dai dipendenti (Data, Dipendente, Commessa, Posizione, Foto, Ore, Descrizione, Stato).
- **Aprire Foto Rapportino**:
  - Se presente, premi “apri” per visualizzare la foto allegata dal dipendente.
- **Azioni Manager**:
  - Approva / Rifiuta.
  - Modifica campi (data, ore, descrizione, commessa, posizione).
  - Elimina rapportino.

Schermata
![Rapportini – Ultimi rapportini (manager)](images/rapportini-manager-ultimi.png)

---

## 7) Bacheca

- **Dove**: Tab “Bacheca”.
- **Cosa vedi**: comunicazioni interne (titolo, messaggio, data).
- **Manager**: può aggiungere/modificare contenuti (se abilitato).

Schermata
![Bacheca](images/bacheca.png)

---

## 8) Turni Settimanali

- **Dove**: Tab “Turni Settimanali”.
- **Cosa vedi**: pianificazione per sito/cantiere con turni (1°, 2°, 3°, Giornaliero).
- **Manager**: può gestire pianificazioni e assegnazioni (sezione “Amministrazione”).

Schermata
![Turni settimanali](images/turni-settimanali.png)

---

## 9) Utenti (solo Manager)

- **Dove**: Tab “Utenti”.
- **Azioni**: creare, modificare o archiviare profili; reimpostare password; gestire ruoli.

Schermata
![Utenti](images/utenti.png)

---

## 10) Consigli Pratici

- Foto Attività:
  - Manager: il link “apri” accanto al file conferma che la foto è caricata.
  - Dipendente: “apri” elimina automaticamente la foto dopo la visione.
  - Se la foto non si apre, aggiorna la pagina e riprova.
- Rapportini con Foto:
  - Il Manager può sempre aprire la foto inserita dal dipendente.
- Stato Attività (Home Manager): “completato”/“da completare”.

Schermate aggiuntive (opzionali)
- Dashboard: ![Dashboard](images/dashboard.png)
- Report: ![Report](images/report.png)

---

## 11) Risoluzione Problemi

- Non vedo la foto in Attività (Dipendente):
  - Assicurati che Manager, Descrizione e Cantiere fossero compilati prima di caricare la foto.
Schermata
![Rapportini – Nuovo rapportino](images/rapportini-dipendente-nuovo.png)
  - Aggiorna la pagina; le foto scadono automaticamente il giorno successivo.
- “apri” non apre la foto (popup bloccato):
  - Prova a sbloccare i popup per il sito; l’app apre subito la scheda e poi carica la foto.
Schermate
![Amministrazione – Assegna attività](images/attivita-manager-assegna.png)
![Amministrazione – Foto caricata con link apri](images/attivita-manager-foto-apri.png)
- Rapportino con foto non visibile al Manager:
  - Verifica che il dipendente abbia allegato correttamente la foto in fase di inserimento.

---

## 12) Sicurezza & Privacy (sintesi)

- Le foto Attività sono temporanee e vengono eliminate automaticamente dopo la visualizzazione o il giorno successivo.
- Le foto dei Rapportini sono visibili al Manager per la revisione.
- Gli accessi e le azioni rispettano i ruoli (Dipendente/Manager).

---

## 13) Contatti e Supporto

- Per assistenza tecnica o chiarimenti sui flussi: contatta il referente IT o l’amministratore dell’app.
