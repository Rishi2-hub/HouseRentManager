alter table public.tenants
  add column if not exists advance_deposit numeric not null default 0;

alter table public.bills
  add column if not exists previous_electricity_unit numeric not null default 0,
  add column if not exists current_electricity_unit numeric not null default 0,
  add column if not exists electricity_rate numeric not null default 0;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='tenants_advance_deposit_non_negative') then
    alter table public.tenants add constraint tenants_advance_deposit_non_negative check (advance_deposit >= 0) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='bills_electricity_readings_valid') then
    alter table public.bills add constraint bills_electricity_readings_valid check (
      previous_electricity_unit >= 0
      and current_electricity_unit >= previous_electricity_unit
      and electricity_rate >= 0
    ) not valid;
  end if;
end $$;
