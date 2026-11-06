create or replace function public.is_dev()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role_id in ('dev', 'pm')
  );
$$;

do $$
declare
  rec record;
begin
  for rec in
    select p.proname as item_name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosrc ~* 'profiles'
      and p.prosrc ~* '\mrole\M'
  loop
    raise warning 'function reads profiles.role: public.%', rec.item_name;
  end loop;

  for rec in
    select pol.schemaname as schema_name, pol.tablename as table_name, pol.policyname as policy_name
    from pg_policies pol
    where (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~* 'profiles'
      and (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~* '\mrole\M'
  loop
    raise warning 'policy reads profiles.role: %.% -> %', rec.schema_name, rec.table_name, rec.policy_name;
  end loop;
end;
$$;
