alter table public.requirements
  add column if not exists production_date date,
  add column if not exists estimated_hours numeric(8, 2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'requirements_estimated_hours_nonnegative'
      and conrelid = 'public.requirements'::regclass
  ) then
    alter table public.requirements
      add constraint requirements_estimated_hours_nonnegative
      check (estimated_hours is null or estimated_hours >= 0);
  end if;
end;
$$;
