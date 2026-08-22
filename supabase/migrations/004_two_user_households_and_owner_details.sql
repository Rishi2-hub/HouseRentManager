-- 004_two_user_households_and_owner_details.sql
-- Corrected version: avoids PostgreSQL CURRENT_ROLE keyword.
-- Matched to:
--   001_initial.sql
--   002_shared_households.sql
--   003_nepali_billing_and_deposit.sql

begin;

-- =========================================================
-- 1. Generate unique numeric 6-digit household share codes
-- =========================================================

create or replace function public.generate_household_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  loop
    generated_code :=
      lpad((floor(random() * 1000000))::int::text, 6, '0');

    exit when not exists (
      select 1
      from public.households
      where invite_code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

alter table public.households
  alter column invite_code
  set default public.generate_household_invite_code();

update public.households
set invite_code = public.generate_household_invite_code()
where invite_code is null
   or invite_code !~ '^[0-9]{6}$';

-- invite_code is already UNIQUE in 002_shared_households.sql.
-- No second unique constraint is needed.

-- =========================================================
-- 2. Database-enforced maximum: 2 users per household
-- =========================================================

create or replace function public.enforce_household_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_total integer;
begin
  perform pg_advisory_xact_lock(
    hashtext(new.household_id::text)
  );

  if tg_op = 'INSERT' then
    select count(*)
    into member_total
    from public.household_members
    where household_id = new.household_id;
  else
    select count(*)
    into member_total
    from public.household_members
    where household_id = new.household_id
      and user_id <> old.user_id;
  end if;

  if member_total >= 2 then
    raise exception
      'This household already has the maximum of 2 members';
  end if;

  return new;
end;
$$;

drop trigger if exists household_member_limit
on public.household_members;

create trigger household_member_limit
before insert or update of household_id
on public.household_members
for each row
execute function public.enforce_household_member_limit();

-- =========================================================
-- 3. Household information for Settings
--
-- IMPORTANT:
-- PostgreSQL has CURRENT_ROLE as a SQL keyword/special value.
-- Therefore this function returns user_role instead of current_role.
-- =========================================================

drop function if exists public.my_household();

create function public.my_household()
returns table (
  household_id uuid,
  household_name text,
  invite_code text,
  member_count bigint,
  user_role text,
  owner_id uuid,
  owner_name text,
  owner_email text,
  members jsonb
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    h.id as household_id,
    h.name as household_name,
    h.invite_code,
    count(hm_all.user_id)::bigint as member_count,
    hm_me.role::text as user_role,
    h.created_by as owner_id,
    coalesce(
      owner_user.raw_user_meta_data ->> 'full_name',
      owner_user.email,
      'Household Owner'
    ) as owner_name,
    owner_user.email::text as owner_email,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', member_user.id,
          'full_name',
            coalesce(
              member_user.raw_user_meta_data ->> 'full_name',
              member_user.email,
              'Household member'
            ),
          'email', member_user.email,
          'role', hm_all.role
        )
        order by
          case
            when hm_all.user_id = h.created_by then 0
            else 1
          end,
          hm_all.joined_at
      ) filter (where member_user.id is not null),
      '[]'::jsonb
    ) as members
  from public.households h
  join public.household_members hm_me
    on hm_me.household_id = h.id
   and hm_me.user_id = auth.uid()
  left join public.household_members hm_all
    on hm_all.household_id = h.id
  left join auth.users member_user
    on member_user.id = hm_all.user_id
  left join auth.users owner_user
    on owner_user.id = h.created_by
  group by
    h.id,
    h.name,
    h.invite_code,
    h.created_by,
    hm_me.role,
    owner_user.raw_user_meta_data,
    owner_user.email;
$$;

-- =========================================================
-- 4. Join a household using its 6-digit code
-- =========================================================

drop function if exists public.join_household(text);

create function public.join_household(share_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  current_id uuid;
  member_total integer;
  current_member_total integer;
  has_data boolean;
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  if trim(coalesce(share_code, '')) !~ '^[0-9]{6}$' then
    raise exception 'Enter a valid 6-digit household code';
  end if;

  select id
  into target_id
  from public.households
  where invite_code = trim(share_code)
  for update;

  if target_id is null then
    raise exception 'Invalid household code';
  end if;

  -- Already in this household: nothing to do.
  if exists (
    select 1
    from public.household_members
    where household_id = target_id
      and user_id = auth.uid()
  ) then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(target_id::text)
  );

  select count(*)
  into member_total
  from public.household_members
  where household_id = target_id;

  if member_total >= 2 then
    raise exception
      'This household already has the maximum of 2 members';
  end if;

  select household_id
  into current_id
  from public.household_members
  where user_id = auth.uid()
  limit 1;

  if current_id is not null
     and current_id <> target_id then

    select count(*)
    into current_member_total
    from public.household_members
    where household_id = current_id;

    select
      exists(
        select 1
        from public.floors
        where household_id = current_id
      )
      or exists(
        select 1
        from public.rooms
        where household_id = current_id
      )
      or exists(
        select 1
        from public.tenants
        where household_id = current_id
      )
      or exists(
        select 1
        from public.documents
        where household_id = current_id
      )
      or exists(
        select 1
        from public.bills
        where household_id = current_id
      )
    into has_data;

    if current_member_total > 1 or has_data then
      raise exception
        'This account already has household data and cannot switch households';
    end if;

    delete from public.household_members
    where household_id = current_id
      and user_id = auth.uid();

    delete from public.households
    where id = current_id
      and created_by = auth.uid()
      and not exists (
        select 1
        from public.household_members
        where household_id = current_id
      );
  end if;

  insert into public.household_members (
    household_id,
    user_id,
    role
  )
  values (
    target_id,
    auth.uid(),
    'member'
  );
end;
$$;

-- =========================================================
-- 5. Function permissions
-- =========================================================

revoke execute
on function public.my_household()
from public;

revoke execute
on function public.join_household(text)
from public;

grant execute
on function public.my_household()
to authenticated;

grant execute
on function public.join_household(text)
to authenticated;

commit;