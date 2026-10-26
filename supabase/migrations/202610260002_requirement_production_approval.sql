-- Explicit production approval tracking for the centralized requirement board.
alter table public.requirements
  add column if not exists production_approval_status text not null default 'pending',
  add column if not exists production_approved_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'requirements_production_approval_status_check'
      and conrelid = 'public.requirements'::regclass
  ) then
    alter table public.requirements
      add constraint requirements_production_approval_status_check
      check (production_approval_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;
