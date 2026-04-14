-- Scope: ONLY DB functions and triggers required by the app

-- =============== BACKFILL AUTH METADATA ===============
-- Popola raw_user_meta_data in auth.users con role/full_name da public.profiles
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
       'role', p.role,
       'full_name', coalesce(p.full_name, '')
     )
from public.profiles p
where p.id = u.id;

-- =============== AUTH METADATA SYNC FUNCTION ===============
create or replace function public.sync_auth_metadata_from_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users u
  set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new.role, 'full_name', coalesce(new.full_name, ''))
  where u.id = new.id;
  return new;
end
$$;

-- =============== TRIGGER BINDINGS ===============
drop trigger if exists profiles_sync_auth_metadata on public.profiles;
create trigger profiles_sync_auth_metadata
after insert or update of role, full_name on public.profiles
for each row execute function public.sync_auth_metadata_from_profiles();

-- =============== CLEANUP LEGACY NOTIFICATION TRIGGERS ===============
-- In alcune istanze potrebbe esistere ancora un trigger lato DB che scrive su
-- public.notifications quando si inserisce/aggiorna public.shift_schedules.
-- Poiché l'app ha rimosso le notifiche, evitiamo errori come
-- "relation public.notifications does not exist" eliminando eventuali trigger
-- custom residui su shift_schedules.
do $$
declare r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'shift_schedules'
      and t.tgisinternal = false
  loop
    execute format('drop trigger %I on public.shift_schedules', r.tgname);
  end loop;
end $$;
