-- Extended requirement board (PM-only columns) enabled per company, plus contact roles.

-- 1. Per-company flag.
alter table public.companies
  add column if not exists extended_board boolean not null default false;

update public.companies
set extended_board = true
where lower(trim(name)) = 'd1';

-- 2. Contacts: optional email and a role ('pm' or null).
alter table public.company_contacts
  add column if not exists role text;

alter table public.company_contacts
  alter column email drop not null;

update public.company_contacts
set email = null
where email is not null and trim(email) = '';

do $$
declare
  rec record;
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_contacts_role_check'
      and conrelid = 'public.company_contacts'::regclass
  ) then
    alter table public.company_contacts
      add constraint company_contacts_role_check check (role is null or role = 'pm');
  end if;

  -- Drop any existing unique constraint that covers email: uniqueness is re-created below ignoring empty emails.
  for rec in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.company_contacts'::regclass
      and c.contype = 'u'
      and a.attname = 'email'
  loop
    execute format('alter table public.company_contacts drop constraint %I', rec.conname);
  end loop;

  for rec in
    select i.indexname
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'company_contacts'
      and i.indexdef ilike 'create unique index%'
      and i.indexdef ilike '%email%'
      and i.indexname <> 'company_contacts_company_email_unique'
  loop
    execute format('drop index if exists public.%I', rec.indexname);
  end loop;
end;
$$;

create unique index if not exists company_contacts_company_email_unique
  on public.company_contacts (company_id, lower(email))
  where email is not null and email <> '';

-- 3. Requirement fields shown on the extended board.
alter table public.requirements
  add column if not exists client_pm_contact_id text references public.company_contacts (id) on delete set null,
  add column if not exists request_date date,
  add column if not exists estimate_delivery_date date,
  add column if not exists estimate_approval_date date,
  add column if not exists development_start_date date,
  add column if not exists user_testing_delivery_date date,
  add column if not exists invoiced boolean not null default false,
  add column if not exists invoiced_month date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'requirements_invoiced_month_check'
      and conrelid = 'public.requirements'::regclass
  ) then
    alter table public.requirements
      add constraint requirements_invoiced_month_check
      check (invoiced or invoiced_month is null);
  end if;
end;
$$;

create index if not exists requirements_client_pm_contact_idx
  on public.requirements (client_pm_contact_id);

-- 4. PMs pick and create "PM Entrega" contacts. Mirror the existing dev rule on company_contacts
--    (role + membership in profile_companies) for the pm role. The pm role lives in profiles.role_id
--    (profiles.role only allows 'dev' or 'client').
drop policy if exists company_contacts_pm on public.company_contacts;
create policy company_contacts_pm on public.company_contacts to authenticated
using (
  exists (select 1 from public.profiles pr where pr.id = auth.uid() and coalesce(pr.role_id, pr.role) = 'pm')
  and exists (select 1 from public.profile_companies pc where pc.company_id = company_contacts.company_id and pc.profile_id = auth.uid())
)
with check (
  exists (select 1 from public.profiles pr where pr.id = auth.uid() and coalesce(pr.role_id, pr.role) = 'pm')
  and exists (select 1 from public.profile_companies pc where pc.company_id = company_contacts.company_id and pc.profile_id = auth.uid())
);
