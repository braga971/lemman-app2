-- Add optional cantiere to tasks for grouping/printing
alter table if exists public.tasks add column if not exists cantiere text;

