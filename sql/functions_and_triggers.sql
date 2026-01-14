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
