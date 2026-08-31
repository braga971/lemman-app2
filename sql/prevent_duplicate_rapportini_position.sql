-- Impedisce a un dipendente di avere piu rapportini nello stesso giorno
-- sulla stessa posizione.
--
-- Se esistono gia doppioni storici:
-- - tiene il rapportino piu recente
-- - non somma le ore, per non violare il limite della tabella
-- - salva una copia dei doppioni eliminati in rapportini_duplicate_position_backup
-- - cancella le righe duplicate

create table if not exists public.rapportini_duplicate_position_backup
as
select
  r.*,
  now() as backup_created_at
from public.rapportini r
where false;

insert into public.rapportini_duplicate_position_backup
select
  r.*,
  now() as backup_created_at
from public.rapportini r
join (
  select
    user_id,
    data,
    posizione_id,
    (array_agg(id order by created_at desc nulls last, id))[1] as keep_id
  from public.rapportini
  where user_id is not null
    and data is not null
    and posizione_id is not null
  group by user_id, data, posizione_id
  having count(*) > 1
) d on r.user_id = d.user_id
  and r.data = d.data
  and r.posizione_id = d.posizione_id
  and r.id <> d.keep_id
where not exists (
  select 1
  from public.rapportini_duplicate_position_backup b
  where b.id = r.id
);

do $$
begin
  with duplicated_groups as (
    select
      user_id,
      data,
      posizione_id,
      (array_agg(id order by created_at desc nulls last, id))[1] as keep_id
    from public.rapportini
    where user_id is not null
      and data is not null
      and posizione_id is not null
    group by user_id, data, posizione_id
    having count(*) > 1
  )
  delete from public.rapportini r
  using duplicated_groups d
  where r.user_id = d.user_id
    and r.data = d.data
    and r.posizione_id = d.posizione_id
    and r.id <> d.keep_id;
end $$;

create unique index if not exists rapportini_one_position_per_day_uidx
on public.rapportini (user_id, data, posizione_id)
where user_id is not null
  and data is not null
  and posizione_id is not null;
