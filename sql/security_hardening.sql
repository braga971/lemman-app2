-- Security hardening for Supabase RLS and Storage

-- PROFILES: enable RLS and restrict access
alter table if exists public.profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_read_own_or_manager'
  ) then
    create policy "profiles_read_own_or_manager" on public.profiles
      for select using (
        auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_self'
  ) then
    create policy "profiles_update_self" on public.profiles
      for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_manager'
  ) then
    create policy "profiles_update_manager" on public.profiles
      for update using (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
      ) with check (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
      );
  end if;
end $$;

-- STORAGE: per-bucket policies examples. Adjust buckets as needed.
-- If buckets contain sensitive data, prefer signed URLs (no public read).

-- Example: rapportini-foto
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='rapportini_user_upload_own_prefix'
  ) then
    create policy "rapportini_user_upload_own_prefix" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'rapportini-foto' and (split_part(name,'/',1))::uuid = auth.uid()
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='rapportini_user_manage_own_files'
  ) then
    create policy "rapportini_user_manage_own_files" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'rapportini-foto' and (split_part(name,'/',1))::uuid = auth.uid()
      );
  end if;
end $$;

-- Keep a service role policy for admin automation
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='service_role_manage_storage'
  ) then
    create policy "service_role_manage_storage" on storage.objects
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- CANTIERI and TURNI_PIANO: restrict writes to managers only
alter table if exists public.cantieri enable row level security;
alter table if exists public.turni_piano enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='cantieri' and policyname='cantieri_select_authenticated'
  ) then
    create policy "cantieri_select_authenticated" on public.cantieri for select using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='cantieri' and policyname='cantieri_write_manager'
  ) then
    create policy "cantieri_write_manager" on public.cantieri for all
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='manager'))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='manager'));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='turni_piano' and policyname='turni_piano_select_authenticated'
  ) then
    create policy "turni_piano_select_authenticated" on public.turni_piano for select using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='turni_piano' and policyname='turni_piano_write_manager'
  ) then
    create policy "turni_piano_write_manager" on public.turni_piano for all
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='manager'))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='manager'));
  end if;
end $$;

