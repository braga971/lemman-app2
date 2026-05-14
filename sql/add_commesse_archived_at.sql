-- Adds soft-archive support for commesse.
-- Completed commesse stay available for historical rapportini,
-- but the app hides them from new operational selections.

alter table if exists public.commesse
  add column if not exists archived_at timestamptz;
