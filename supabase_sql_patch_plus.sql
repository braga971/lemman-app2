-- Patch per nuove colonne e Storage policy

-- Bacheca: titolo
alter table public.bacheca add column if not exists title text;

-- Turni: sede, orario
alter table public.turni add column if not exists sede text;
alter table public.turni add column if not exists orario text;

-- Tasks: stato, photo_url
alter table public.tasks add column if not exists stato text default 'todo';
alter table public.tasks add column if not exists photo_url text;

-- Rapportini: photo_url (se vuoi allegati dai dipendenti)
alter table public.rapportini add column if not exists photo_url text;

-- Storage buckets (creali da dashboard): 'rapportini-foto', 'attivita-foto'
-- Policy di esempio (lettura pubblica, scrittura autenticati)
-- Nota: le policy storage vanno nel namespace 'storage' e nelle tabelle 'objects' filtrando per bucket_id

-- Consenti lettura pubblica sugli oggetti dei bucket
create policy if not exists "Public read rapportini-foto" on storage.objects
for select using ( bucket_id = 'rapportini-foto' );

create policy if not exists "Public read attivita-foto" on storage.objects
for select using ( bucket_id = 'attivita-foto' );

-- Consenti inserimento agli autenticati
create policy if not exists "Authenticated upload rapportini-foto" on storage.objects
for insert to authenticated with check ( bucket_id = 'rapportini-foto' );

create policy if not exists "Authenticated upload attivita-foto" on storage.objects
for insert to authenticated with check ( bucket_id = 'attivita-foto' );

-- Consenti delete al manager via service_role (o crea una funzione sicura)
create policy if not exists "Service role manage storage" on storage.objects
for all to service_role using ( true ) with check ( true );
