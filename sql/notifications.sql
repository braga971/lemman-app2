-- Notifications table and RLS policies
-- Creates table if missing and configures policies so that
-- users can read and delete their own notifications.

-- Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Indexes
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
-- Speed up JSONB contains checks for dedup scopes
create index if not exists idx_notifications_payload on public.notifications using gin (payload);

-- Enable RLS
alter table public.notifications enable row level security;

-- Drop existing policies (idempotent)
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='notifications'
  loop
    execute format('drop policy %I on public.notifications', r.policyname);
  end loop;
end
$$;

-- Policy: select own
create policy "notifications_select_own"
on public.notifications for select to authenticated
using (auth.uid() = user_id);

-- Policy: delete own
create policy "notifications_delete_own"
on public.notifications for delete to authenticated
using (auth.uid() = user_id);

-- Policy: insert by server (service_role) or manager
create policy "notifications_insert_service"
on public.notifications for insert to service_role
with check (true);

create policy "notifications_insert_manager"
on public.notifications for insert to authenticated
with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

-- Optional: allow managers to purge notifications
create policy "notifications_delete_manager"
on public.notifications for delete to authenticated
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');
