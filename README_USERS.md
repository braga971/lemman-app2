# Patch UI (layout classico a tab) + gestione Utenti

## Cosa c'è
- `src/views/Amministrazione.jsx` → layout **a TAB** (Commesse, Posizioni, Attività, Rapportini, **Utenti**).
- Tab **Utenti** con due pulsanti:
  - **Crea utente** (email, password, full_name, ruolo dipendente/manager)
  - **Elimina utente** (per ID o email)
  Le azioni chiamano le Edge Functions `create-user` e `delete-user`.

## Edge Functions (Supabase)
Cartella `supabase/functions/` con due funzioni pronte:
- `create-user/index.ts`
- `delete-user/index.ts`

### Variabili richieste (secrets)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (⚠️ **mai** nel client, solo come secret della Function)

### Deploy
Nel progetto Supabase:
```
supabase functions deploy create-user
supabase functions deploy delete-user
```
Entrambe le funzioni richiedono il JWT dell'utente e accettano solo utenti con ruolo `manager`.

### Invoke dal client
Le chiamate sono già incluse in `SectionUtenti`:
```js
await supabase.functions.invoke('create-user', { body: { email, password, full_name, role } })
await supabase.functions.invoke('delete-user', { body: { user_id, email } })
```

## Note layout
- Ho **ripristinato** un layout più pulito: tutto sotto **Amministrazione** ma con **tab** (come impostazione “classica”), tabelle semplici, edit inline, pulsanti chiari.
- Nessuna modifica alle tue viste esterne: questa patch è **non invasiva** sul resto dell'app.
