do $$
declare
  policy_names constant text[] := array[
    'project_credentials_write_dev',
    'company_servers_dev',
    'deployables_dev',
    'deployment_instructions_dev',
    'company_contacts_dev',
    'project_deployables_dev',
    'deployable_instructions_dev',
    'company_contacts_pm'
  ];
  policy_name text;
  rec record;
  new_qual text;
  new_check text;
  alter_sql text;
begin
  foreach policy_name in array policy_names
  loop
    if not exists (
      select 1 from pg_policies pol
      where pol.schemaname = 'public' and pol.policyname = policy_name
    ) then
      raise exception 'policy not found: %', policy_name;
    end if;
  end loop;

  for rec in
    select pol.schemaname as schema_name,
           pol.tablename as table_name,
           pol.policyname as policy_name,
           pol.qual as qual,
           pol.with_check as with_check
    from pg_policies pol
    where pol.schemaname = 'public'
      and pol.policyname = any (policy_names)
    order by pol.tablename, pol.policyname
  loop
    new_qual := rec.qual;
    new_check := rec.with_check;

    new_qual := regexp_replace(new_qual, '\m([a-z_][a-z0-9_]*)\.role\M', '\1.role_id', 'g');
    new_qual := regexp_replace(new_qual, 'COALESCE\(([a-z_][a-z0-9_]*\.role_id), \1\)', '\1', 'g');
    new_qual := regexp_replace(
      new_qual,
      '(\m[a-z_][a-z0-9_]*\.role_id\)?(::text)?) = ''dev''::text',
      '\1 = ANY (ARRAY[''dev''::text, ''pm''::text])',
      'g'
    );

    new_check := regexp_replace(new_check, '\m([a-z_][a-z0-9_]*)\.role\M', '\1.role_id', 'g');
    new_check := regexp_replace(new_check, 'COALESCE\(([a-z_][a-z0-9_]*\.role_id), \1\)', '\1', 'g');
    new_check := regexp_replace(
      new_check,
      '(\m[a-z_][a-z0-9_]*\.role_id\)?(::text)?) = ''dev''::text',
      '\1 = ANY (ARRAY[''dev''::text, ''pm''::text])',
      'g'
    );

    if coalesce(new_qual, '') ~ '\mrole\M' then
      raise exception 'role left in qual of %.% (%): %',
        rec.schema_name, rec.table_name, rec.policy_name, rec.qual;
    end if;
    if coalesce(new_check, '') ~ '\mrole\M' then
      raise exception 'role left in with_check of %.% (%): %',
        rec.schema_name, rec.table_name, rec.policy_name, rec.with_check;
    end if;

    if new_qual is not distinct from rec.qual and new_check is not distinct from rec.with_check then
      continue;
    end if;

    alter_sql := format('alter policy %I on %I.%I', rec.policy_name, rec.schema_name, rec.table_name);
    if new_qual is not null then
      alter_sql := alter_sql || ' using (' || new_qual || ')';
    end if;
    if new_check is not null then
      alter_sql := alter_sql || ' with check (' || new_check || ')';
    end if;
    execute alter_sql;

    raise notice 'policy %.% (%)', rec.schema_name, rec.table_name, rec.policy_name;
    raise notice '  qual before: %', rec.qual;
    raise notice '  qual after: %', new_qual;
    raise notice '  with_check before: %', rec.with_check;
    raise notice '  with_check after: %', new_check;
  end loop;
end;
$$;
