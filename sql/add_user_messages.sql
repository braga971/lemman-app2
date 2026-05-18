-- Messaggi mirati ai dipendenti, visibili in Home fino alla scadenza.

create table if not exists public.user_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'manager'
  );
$$;

alter table public.user_messages enable row level security;
grant select, insert, update, delete on table public.user_messages to authenticated;

drop policy if exists "user_messages_select_own_or_manager" on public.user_messages;
drop policy if exists "user_messages_insert_manager" on public.user_messages;
drop policy if exists "user_messages_update_manager" on public.user_messages;
drop policy if exists "user_messages_delete_manager" on public.user_messages;

create policy "user_messages_select_own_or_manager"
on public.user_messages for select
to authenticated
using (user_id = auth.uid() or public.is_manager());

create policy "user_messages_insert_manager"
on public.user_messages for insert
to authenticated
with check (public.is_manager());

create policy "user_messages_update_manager"
on public.user_messages for update
to authenticated
using (public.is_manager())
with check (public.is_manager());

create policy "user_messages_delete_manager"
on public.user_messages for delete
to authenticated
using (public.is_manager());
