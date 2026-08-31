-- RAMS attendance integration.
-- Run this in the Supabase SQL editor before starting the RAMS sync script.

alter table if exists public.profiles
  add column if not exists rams_uid integer,
  add column if not exists rams_din bigint,
  add column if not exists rams_pin text;

create unique index if not exists profiles_rams_din_unique_idx
  on public.profiles (rams_din)
  where rams_din is not null;

create index if not exists profiles_rams_pin_idx
  on public.profiles (rams_pin)
  where rams_pin is not null;

create table if not exists public.rams_departments (
  dept_id text primary key,
  parent_id text,
  dept_name text not null,
  remark text,
  synced_at timestamptz not null default now()
);

create table if not exists public.rams_users (
  uid integer primary key,
  din bigint not null unique,
  pin text not null unique,
  user_name text,
  sex text,
  dept_id text references public.rams_departments(dept_id),
  att_id text,
  rule_id text,
  weekend_id text,
  create_date timestamptz,
  last_updated_date timestamptz,
  comment text,
  synced_at timestamptz not null default now()
);

create table if not exists public.rams_attendance_logs (
  id bigint,
  dn integer,
  din bigint not null,
  clock_at timestamptz not null,
  verify_mode integer,
  action integer,
  att_type_id text,
  collect_date timestamptz,
  job_code integer,
  anti_passback boolean,
  last_updated_uid integer,
  last_updated_date timestamptz,
  remark text,
  synced_at timestamptz not null default now(),
  primary key (din, clock_at)
);

create table if not exists public.rams_attendance_rules (
  id boolean primary key default true,
  standard_start time not null default '06:00',
  standard_end time not null default '18:00',
  early_in_grace_minutes integer not null default 30,
  late_out_grace_minutes integer not null default 30,
  break_minutes integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint rams_attendance_rules_single_row check (id = true)
);

insert into public.rams_attendance_rules (
  id,
  standard_start,
  standard_end,
  early_in_grace_minutes,
  late_out_grace_minutes,
  break_minutes
) values (
  true,
  '06:00',
  '18:00',
  30,
  30,
  0
) on conflict (id) do nothing;

create index if not exists rams_attendance_logs_clock_at_idx
  on public.rams_attendance_logs(clock_at);

create index if not exists rams_attendance_logs_din_idx
  on public.rams_attendance_logs(din);

alter table public.rams_departments enable row level security;
alter table public.rams_users enable row level security;
alter table public.rams_attendance_logs enable row level security;
alter table public.rams_attendance_rules enable row level security;

drop policy if exists "rams_departments_manager_select" on public.rams_departments;
drop policy if exists "rams_users_manager_select" on public.rams_users;
drop policy if exists "rams_attendance_manager_select" on public.rams_attendance_logs;
drop policy if exists "rams_users_read_own" on public.rams_users;
drop policy if exists "rams_attendance_read_own" on public.rams_attendance_logs;
drop policy if exists "rams_departments_read_authenticated" on public.rams_departments;
drop policy if exists "rams_rules_manager_select" on public.rams_attendance_rules;
drop policy if exists "rams_rules_manager_update" on public.rams_attendance_rules;

create policy "rams_departments_read_authenticated"
on public.rams_departments for select
using (auth.role() = 'authenticated');

create policy "rams_departments_manager_select"
on public.rams_departments for select
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

create policy "rams_users_manager_select"
on public.rams_users for select
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

create policy "rams_users_read_own"
on public.rams_users for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.rams_din = rams_users.din
        or (
          p.rams_din is null
          and p.matricola is not null
          and rams_users.pin ~ '^[0-9]+$'
          and p.matricola = rams_users.pin::integer
        )
      )
  )
);

create policy "rams_attendance_manager_select"
on public.rams_attendance_logs for select
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

create policy "rams_attendance_read_own"
on public.rams_attendance_logs for select
using (
  exists (
    select 1
    from public.profiles p
    left join public.rams_users u on u.din = rams_attendance_logs.din
    where p.id = auth.uid()
      and (
        p.rams_din = rams_attendance_logs.din
        or (
          p.rams_din is null
          and p.matricola is not null
          and u.pin ~ '^[0-9]+$'
          and p.matricola = u.pin::integer
        )
      )
  )
);

create policy "rams_rules_manager_select"
on public.rams_attendance_rules for select
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

create policy "rams_rules_manager_update"
on public.rams_attendance_rules for update
using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager')
with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), (auth.jwt() ->> 'role'), '') = 'manager');

create or replace view public.rams_attendance_with_profiles
with (security_invoker = true)
as
select
  a.clock_at,
  a.din,
  a.dn,
  a.verify_mode,
  a.action,
  a.att_type_id,
  a.collect_date,
  a.remark,
  u.uid as rams_uid,
  u.pin as rams_pin,
  u.user_name as rams_user_name,
  u.dept_id,
  d.dept_name,
  p.id as profile_id,
  p.full_name as profile_name,
  p.email as profile_email,
  p.matricola
from public.rams_attendance_logs a
left join public.rams_users u on u.din = a.din
left join public.rams_departments d on d.dept_id = u.dept_id
left join public.profiles p
  on p.rams_din = a.din
  or (
    p.rams_din is null
    and p.matricola is not null
    and u.pin ~ '^[0-9]+$'
    and p.matricola = u.pin::integer
  );

create or replace view public.rams_work_days
with (security_invoker = true)
as
with raw_days as (
  select
    p.id as profile_id,
    p.full_name as profile_name,
    p.email as profile_email,
    p.matricola,
    a.din,
    u.uid as rams_uid,
    u.pin as rams_pin,
    u.user_name as rams_user_name,
    (a.clock_at at time zone 'Europe/Rome')::date as work_date,
    min(a.clock_at) as first_clock_at,
    max(a.clock_at) as last_clock_at,
    count(*) as punch_count
  from public.rams_attendance_logs a
  left join public.rams_users u on u.din = a.din
  left join public.profiles p
    on p.rams_din = a.din
    or (
      p.rams_din is null
      and p.matricola is not null
      and u.pin ~ '^[0-9]+$'
      and p.matricola = u.pin::integer
    )
  group by p.id, p.full_name, p.email, p.matricola, a.din, u.uid, u.pin, u.user_name, (a.clock_at at time zone 'Europe/Rome')::date
),
normalized as (
  select
    r.*,
    rules.standard_start,
    rules.standard_end,
    rules.early_in_grace_minutes,
    rules.late_out_grace_minutes,
    rules.break_minutes,
    case
      when r.first_clock_at >= ((r.work_date + rules.standard_start) at time zone 'Europe/Rome') - make_interval(mins => rules.early_in_grace_minutes)
       and r.first_clock_at <= ((r.work_date + rules.standard_start) at time zone 'Europe/Rome')
      then ((r.work_date + rules.standard_start) at time zone 'Europe/Rome')
      else r.first_clock_at
    end as normalized_start_at,
    case
      when r.last_clock_at >= ((r.work_date + rules.standard_end) at time zone 'Europe/Rome')
       and r.last_clock_at <= ((r.work_date + rules.standard_end) at time zone 'Europe/Rome') + make_interval(mins => rules.late_out_grace_minutes)
      then ((r.work_date + rules.standard_end) at time zone 'Europe/Rome')
      else r.last_clock_at
    end as normalized_end_at
  from raw_days r
  cross join public.rams_attendance_rules rules
)
select
  n.*,
  greatest(
    0,
    round(
      (
        extract(epoch from (n.normalized_end_at - n.normalized_start_at)) / 3600.0
        - (n.break_minutes / 60.0)
      )::numeric,
      2
    )
  ) as worked_hours,
  case
    when n.profile_id is null then 'profilo_non_collegato'
    when n.punch_count < 2 then 'timbratura_incompleta'
    when n.normalized_end_at <= n.normalized_start_at then 'orari_da_verificare'
    else 'ok'
  end as status
from normalized n;

grant select on public.rams_departments to authenticated;
grant select on public.rams_users to authenticated;
grant select on public.rams_attendance_logs to authenticated;
grant select on public.rams_attendance_with_profiles to authenticated;
grant select on public.rams_attendance_rules to authenticated;
grant select on public.rams_work_days to authenticated;

grant all on public.rams_departments to service_role;
grant all on public.rams_users to service_role;
grant all on public.rams_attendance_logs to service_role;
grant all on public.rams_attendance_rules to service_role;

comment on table public.rams_attendance_logs is
  'Raw attendance logs imported from RAMS Access database. Primary key is DIN + clock_at.';

comment on column public.profiles.rams_din is
  'RAMS DIN/enroll identifier used to link a Lemman profile to imported attendance logs.';
