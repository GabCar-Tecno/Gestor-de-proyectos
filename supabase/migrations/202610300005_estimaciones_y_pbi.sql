-- Modelo definitivo de estimaciones y PBI.
-- La estimación tiene un solo número propio (estimations.code). No es un PBI del requerimiento.
-- Una solicitud es un requerimiento: tiene una o más PBI y una de ellas es la principal.
-- Cada PBI puede tener varias tareas. El número principal también queda en requirements.code.
-- Optimista, pesimista y la estimación estadística salen de las vistas, con la matemática del Excel.

do $$
declare
  project_id_type text;
  requirement_id_type text;
begin
  select c.data_type
    into project_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'projects'
    and c.column_name = 'id';

  select c.data_type
    into requirement_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'requirements'
    and c.column_name = 'id';

  if project_id_type is null then
    raise exception 'No existe public.projects.id';
  end if;
  if requirement_id_type is null then
    raise exception 'No existe public.requirements.id';
  end if;
  if project_id_type not in ('text', 'character varying') then
    raise exception 'public.projects.id es %. Esta migración espera text, igual que los ids del gestor.', project_id_type;
  end if;
  if requirement_id_type not in ('text', 'character varying') then
    raise exception 'public.requirements.id es %. Esta migración espera text, igual que los ids del gestor.', requirement_id_type;
  end if;
end;
$$;

create table if not exists public.estimation_complexities (
  id text primary key,
  label text not null,
  optimistic_weight numeric(8, 2) not null,
  most_probable_weight numeric(8, 2) not null,
  pessimistic_weight numeric(8, 2) not null,
  sort_order integer not null,
  constraint estimation_complexities_weights_check check (
    optimistic_weight >= 0
    and most_probable_weight >= 0
    and pessimistic_weight >= 0
    and (optimistic_weight + most_probable_weight + pessimistic_weight) > 0
  )
);

create table if not exists public.estimation_activity_types (
  id text primary key,
  label text not null,
  sort_order integer not null
);

create table if not exists public.estimations (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  requirement_id text references public.requirements (id) on delete set null,
  code text not null default '',
  status text not null default 'creada',
  format_version text not null default '4.0',
  estimated_on date not null default current_date,
  client_name text not null default '',
  initiative_name text not null default '',
  requester_name text not null default '',
  pm_name text not null default '',
  version_label text not null default 'V1',
  complexity_id text not null references public.estimation_complexities (id),
  rounding_decimals integer not null default 1,
  deviation_alert_ratio numeric(8, 4) not null default 0.3000,
  daily_hours numeric(4, 2) not null default 8,
  dedication numeric(5, 4) not null default 0.6250,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimations_status_check check (status in ('creada', 'enviada', 'aprobada')),
  constraint estimations_rounding_decimals_check check (rounding_decimals between 0 and 4),
  constraint estimations_deviation_alert_ratio_check check (deviation_alert_ratio >= 0),
  constraint estimations_daily_hours_check check (daily_hours > 0),
  constraint estimations_dedication_check check (dedication > 0 and dedication <= 1)
);

create table if not exists public.estimation_lines (
  id text primary key,
  estimation_id text not null references public.estimations (id) on delete cascade,
  sort_order integer not null,
  line_kind text not null,
  activity_type_id text references public.estimation_activity_types (id),
  concept text not null default '',
  developer_hours numeric(8, 2),
  constraint estimation_lines_kind_check check (line_kind in ('section', 'activity')),
  constraint estimation_lines_hours_check check (developer_hours is null or developer_hours >= 0),
  constraint estimation_lines_shape_check check (
    (
      line_kind = 'section'
      and activity_type_id is null
      and developer_hours is null
    )
    or (
      line_kind = 'activity'
      and activity_type_id is not null
    )
  ),
  constraint estimation_lines_estimation_sort_key unique (estimation_id, sort_order)
);

create index if not exists estimations_project_id_idx
  on public.estimations (project_id);

create index if not exists estimations_requirement_id_idx
  on public.estimations (requirement_id);

create index if not exists estimations_complexity_id_idx
  on public.estimations (complexity_id);

create index if not exists estimations_created_by_idx
  on public.estimations (created_by);

create index if not exists estimation_lines_estimation_id_idx
  on public.estimation_lines (estimation_id);

create index if not exists estimation_lines_activity_type_id_idx
  on public.estimation_lines (activity_type_id);

comment on table public.estimations is
  'Cabecera de una estimación de una app. Su número es propio y no es un PBI del requerimiento.';

comment on column public.estimations.code is
  'Número propio de la estimación. Independiente de los PBI del requerimiento.';

comment on column public.estimations.status is
  'creada al guardar, enviada cuando se manda, aprobada cuando se acepta la solicitud.';

comment on column public.estimations.dedication is
  'Fracción de la jornada. 0.625 equivale a 62.5 % y, con 8 h diarias, a 5 h dedicadas.';

comment on column public.estimations.deviation_alert_ratio is
  'Umbral de la columna Verif del Excel. Con el valor 0.3, una actividad marca alerta cuando (pesimista - más probable) / más probable es mayor que 0.3.';

comment on column public.estimation_lines.developer_hours is
  'Horas que escribe la persona. En el Excel es la columna Estimación Desarrollador. Optimista y pesimista se derivan de este valor.';

insert into public.estimation_complexities
  (id, label, optimistic_weight, most_probable_weight, pessimistic_weight, sort_order)
values
  ('baja', 'Baja', 4, 16, 4, 10),
  ('media', 'Media', 4, 12, 8, 20),
  ('media_alta', 'Media alta', 3, 10, 11, 30),
  ('alta', 'Alta', 1, 9, 14, 40),
  ('muy_alta', 'Muy alta', 1, 5, 18, 50),
  ('valor_optimista', 'Valor - Optimista', 1, 0, 0, 60),
  ('valor_mas_probable', 'Valor - Mas probable', 0, 1, 0, 70),
  ('valor_pesimista', 'Valor - Pesimista', 0, 0, 1, 80),
  ('estandar', 'Estandar', 1, 4, 1, 90),
  ('tradicional', 'Tradicional', 0, 6, 0, 100)
on conflict (id) do nothing;

insert into public.estimation_activity_types (id, label, sort_order)
values
  ('analisis', 'Análisis', 10),
  ('desarrollo', 'Desarrollo', 20),
  ('arquitectura', 'Arquitectura', 30),
  ('qa', 'QA', 40),
  ('manuales', 'Manuales', 50),
  ('gestion', 'Gestión de proyecto', 60)
on conflict (id) do nothing;

create or replace function public.estimations_requirement_same_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.requirement_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.requirements as requirement
    where requirement.id = new.requirement_id
      and requirement.project_id = new.project_id
  ) then
    raise exception 'El requerimiento no pertenece a esta app';
  end if;

  return new;
end;
$$;

drop trigger if exists estimations_requirement_same_project on public.estimations;

create trigger estimations_requirement_same_project
before insert or update of project_id, requirement_id
on public.estimations
for each row
execute function public.estimations_requirement_same_project();

create or replace function public.estimation_round_up(value numeric, decimals integer)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$
  select ceil(value * (10::numeric ^ decimals)) / (10::numeric ^ decimals);
$$;

comment on function public.estimation_round_up(numeric, integer) is
  'ROUNDUP del Excel para cantidades positivas: aleja el valor de cero a la cantidad de decimales pedida.';

create or replace view public.estimation_line_metrics
with (security_invoker = true) as
with scenarios as (
  select
    line.id as line_id,
    line.estimation_id,
    estimation.project_id,
    line.sort_order,
    line.line_kind,
    line.activity_type_id,
    activity_type.label as activity_type_label,
    line.concept,
    line.developer_hours,
    estimation.rounding_decimals,
    estimation.deviation_alert_ratio,
    complexity.optimistic_weight,
    complexity.most_probable_weight,
    complexity.pessimistic_weight,
    case
      when line.line_kind <> 'activity' or line.developer_hours is null then null
      when line.developer_hours = 0 then 0
      else line.developer_hours - 1
    end as optimistic_hours,
    case
      when line.line_kind <> 'activity' or line.developer_hours is null then null
      else line.developer_hours
    end as most_probable_hours,
    case
      when line.line_kind <> 'activity' or line.developer_hours is null then null
      else line.developer_hours + 1
    end as pessimistic_hours
  from public.estimation_lines as line
  join public.estimations as estimation
    on estimation.id = line.estimation_id
  join public.estimation_complexities as complexity
    on complexity.id = estimation.complexity_id
  left join public.estimation_activity_types as activity_type
    on activity_type.id = line.activity_type_id
),
scored as (
  select
    scenarios.*,
    case
      when scenarios.most_probable_hours is null then null
      else public.estimation_round_up(
        (
          scenarios.optimistic_weight * scenarios.optimistic_hours
          + scenarios.most_probable_weight * scenarios.most_probable_hours
          + scenarios.pessimistic_weight * scenarios.pessimistic_hours
        ) / (
          scenarios.optimistic_weight
          + scenarios.most_probable_weight
          + scenarios.pessimistic_weight
        ),
        scenarios.rounding_decimals
      ) + 1
    end as statistical_hours,
    case
      when scenarios.most_probable_hours is null then null
      else (scenarios.pessimistic_hours - scenarios.optimistic_hours) / 12
    end as stddev_hours
  from scenarios
)
select
  scored.*,
  case
    when scored.statistical_hours is null then null
    else scored.statistical_hours + scored.stddev_hours
  end as estimate_plus_stddev_hours,
  case
    when scored.statistical_hours is null then null
    else power(scored.statistical_hours + scored.stddev_hours, 2)
  end as sheet_variance,
  case
    when scored.most_probable_hours is null or scored.most_probable_hours = 0 then false
    else ((scored.pessimistic_hours - scored.most_probable_hours) / scored.most_probable_hours)
      > scored.deviation_alert_ratio
  end as needs_review
from scored;

comment on view public.estimation_line_metrics is
  'Horas derivadas de cada línea. La estimación estadística es ROUNDUP(promedio ponderado, decimales) + 1, igual que la columna O del formato.';

create or replace view public.estimation_summaries
with (security_invoker = true) as
select
  estimation.id as estimation_id,
  estimation.project_id,
  coalesce(sum(metric.developer_hours), 0) as developer_hours_total,
  coalesce(sum(metric.statistical_hours), 0) as statistical_hours_total,
  sqrt(coalesce(sum(metric.sheet_variance), 0)) as total_stddev_hours,
  count(*) filter (where metric.line_kind = 'activity') as activity_count,
  count(*) filter (where metric.needs_review) as review_count,
  estimation.daily_hours * estimation.dedication as dedicated_hours_per_day,
  coalesce(sum(metric.developer_hours), 0) / (estimation.daily_hours * estimation.dedication) as developer_delivery_days,
  coalesce(sum(metric.statistical_hours), 0) / (estimation.daily_hours * estimation.dedication) as statistical_delivery_days
from public.estimations as estimation
left join public.estimation_line_metrics as metric
  on metric.estimation_id = estimation.id
group by estimation.id;

comment on view public.estimation_summaries is
  'Totales de una estimación. Los días de entrega estadísticos son las horas estadísticas divididas entre las horas dedicadas por día.';

alter table public.estimation_complexities enable row level security;
alter table public.estimation_activity_types enable row level security;
alter table public.estimations enable row level security;
alter table public.estimation_lines enable row level security;

-- Misma puerta que el resto del gestor: is_dev() incluye dev y pm.
-- Un cliente de la empresa no lee ni escribe estimaciones.
drop policy if exists estimation_complexities_dev_read on public.estimation_complexities;
create policy estimation_complexities_dev_read
on public.estimation_complexities
for select
to authenticated
using ((select public.is_dev()));

drop policy if exists estimation_activity_types_dev_read on public.estimation_activity_types;
create policy estimation_activity_types_dev_read
on public.estimation_activity_types
for select
to authenticated
using ((select public.is_dev()));

drop policy if exists estimations_dev_all on public.estimations;
create policy estimations_dev_all
on public.estimations
for all
to authenticated
using ((select public.is_dev()))
with check ((select public.is_dev()));

drop policy if exists estimation_lines_dev_all on public.estimation_lines;
create policy estimation_lines_dev_all
on public.estimation_lines
for all
to authenticated
using ((select public.is_dev()))
with check ((select public.is_dev()));

revoke all on table public.estimation_complexities from anon, public;
revoke all on table public.estimation_activity_types from anon, public;
revoke all on table public.estimations from anon, public;
revoke all on table public.estimation_lines from anon, public;

grant select on table public.estimation_complexities to authenticated;
grant select on table public.estimation_activity_types to authenticated;
grant select, insert, update, delete on table public.estimations to authenticated;
grant select, insert, update, delete on table public.estimation_lines to authenticated;

revoke all on table public.estimation_line_metrics from anon, public;
revoke all on table public.estimation_summaries from anon, public;
grant select on table public.estimation_line_metrics to authenticated;
grant select on table public.estimation_summaries to authenticated;

revoke all on function public.estimation_round_up(numeric, integer) from public, anon;
grant execute on function public.estimation_round_up(numeric, integer) to authenticated;

revoke all on function public.estimations_requirement_same_project() from public, anon;
grant execute on function public.estimations_requirement_same_project() to authenticated;

alter table public.estimations
  add column if not exists status text not null default 'creada';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimations_status_check'
      and conrelid = 'public.estimations'::regclass
  ) then
    alter table public.estimations
      add constraint estimations_status_check
      check (status in ('creada', 'enviada', 'aprobada'));
  end if;
end;
$$;

update public.statuses
set is_lateral = false
where id = 'Estimacion';

create table if not exists public.requirement_codes (
  id text primary key,
  requirement_id text not null references public.requirements (id) on delete cascade,
  code text not null,
  is_principal boolean not null default false,
  sort_order integer not null,
  constraint requirement_codes_code_not_blank check (btrim(code) <> ''),
  constraint requirement_codes_sort_unique unique (requirement_id, sort_order)
);

alter table public.requirement_codes
  add column if not exists is_principal boolean not null default false;

create unique index if not exists requirement_codes_requirement_code_unique
  on public.requirement_codes (requirement_id, lower(btrim(code)));

insert into public.requirement_codes (id, requirement_id, code, is_principal, sort_order)
select 'rc-' || requirement.id, requirement.id, btrim(requirement.code), true, 1
from public.requirements as requirement
where btrim(coalesce(requirement.code, '')) <> ''
  and not exists (
    select 1
    from public.requirement_codes as existing
    where existing.requirement_id = requirement.id
  );

update public.requirement_codes as code_row
set is_principal = true
where code_row.sort_order = (
  select min(other.sort_order)
  from public.requirement_codes as other
  where other.requirement_id = code_row.requirement_id
)
and not exists (
  select 1
  from public.requirement_codes as principal
  where principal.requirement_id = code_row.requirement_id
    and principal.is_principal
);

create unique index if not exists requirement_codes_one_principal_idx
  on public.requirement_codes (requirement_id)
  where is_principal;

comment on table public.requirement_codes is
  'PBI de una solicitud. Puede haber varios y uno es el principal. El principal también queda en requirements.code.';

comment on column public.requirement_codes.is_principal is
  'PBI con el que Pilar organiza el requerimiento. Solo uno por solicitud.';

create or replace function public.requirement_codes_sync_primary()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  req_id text := coalesce(new.requirement_id, old.requirement_id);
  principal text;
begin
  select pbi.code
    into principal
  from public.requirement_codes as pbi
  where pbi.requirement_id = req_id
    and pbi.is_principal
  order by pbi.sort_order
  limit 1;

  update public.requirements
  set code = coalesce(principal, '')
  where id = req_id
    and code is distinct from coalesce(principal, '');

  return null;
end;
$$;

drop trigger if exists requirement_codes_sync_primary on public.requirement_codes;

create trigger requirement_codes_sync_primary
after insert or update or delete
on public.requirement_codes
for each row
execute function public.requirement_codes_sync_primary();

revoke all on function public.requirement_codes_sync_primary() from public, anon, authenticated;

create table if not exists public.requirement_pbi_tasks (
  id text primary key,
  requirement_code_id text not null references public.requirement_codes (id) on delete cascade,
  code text not null,
  title text not null default '',
  sort_order integer not null,
  constraint requirement_pbi_tasks_code_not_blank check (btrim(code) <> ''),
  constraint requirement_pbi_tasks_sort_unique unique (requirement_code_id, sort_order)
);

create unique index if not exists requirement_pbi_tasks_code_unique
  on public.requirement_pbi_tasks (requirement_code_id, lower(btrim(code)));

comment on table public.requirement_pbi_tasks is
  'Tareas de una PBI. Una PBI puede tener varias. El número de la tarea es propio de esa PBI.';

alter table public.requirement_codes enable row level security;
alter table public.requirement_pbi_tasks enable row level security;

drop policy if exists requirement_codes_select on public.requirement_codes;
create policy requirement_codes_select
on public.requirement_codes
for select
to authenticated
using (
  exists (
    select 1
    from public.requirements as requirement
    join public.projects as project on project.id = requirement.project_id
    where requirement.id = requirement_codes.requirement_id
      and public.can_access_company(project.company_id)
  )
);

drop policy if exists requirement_codes_write on public.requirement_codes;
create policy requirement_codes_write
on public.requirement_codes
for all
to authenticated
using ((select public.is_dev()))
with check ((select public.is_dev()));

drop policy if exists requirement_pbi_tasks_select on public.requirement_pbi_tasks;
create policy requirement_pbi_tasks_select
on public.requirement_pbi_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.requirement_codes as pbi
    join public.requirements as requirement on requirement.id = pbi.requirement_id
    join public.projects as project on project.id = requirement.project_id
    where pbi.id = requirement_pbi_tasks.requirement_code_id
      and public.can_access_company(project.company_id)
  )
);

drop policy if exists requirement_pbi_tasks_write on public.requirement_pbi_tasks;
create policy requirement_pbi_tasks_write
on public.requirement_pbi_tasks
for all
to authenticated
using ((select public.is_dev()))
with check ((select public.is_dev()));

revoke all on table public.requirement_codes from anon, public;
revoke all on table public.requirement_pbi_tasks from anon, public;
grant select, insert, update, delete on table public.requirement_codes to authenticated;
grant select, insert, update, delete on table public.requirement_pbi_tasks to authenticated;
