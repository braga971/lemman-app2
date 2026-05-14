-- Prevent deleting commesse that are already referenced by rapportini.
-- The app requires rapportini.commessa_id, so an ON DELETE SET NULL foreign key
-- fails with: null value in column "commessa_id" violates not-null constraint.
--
-- Run this once in Supabase SQL editor. It is safe to run more than once.

do $$
declare
  fk record;
begin
  for fk in
    select conname
    from pg_constraint
    where contype = 'f'
      and conrelid = 'public.rapportini'::regclass
      and confrelid = 'public.commesse'::regclass
      and conkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.rapportini'::regclass
            and attname = 'commessa_id'
        )
      ]
  loop
    execute format('alter table public.rapportini drop constraint %I', fk.conname);
  end loop;

  alter table public.rapportini
    add constraint rapportini_commessa_id_fkey
    foreign key (commessa_id)
    references public.commesse(id)
    on update cascade
    on delete restrict;
end
$$;
