-- Documentos (Word/PDF) adjuntos a una estimación.
-- El archivo vive en S3 (url = 's3://requerimientos/<empresa>/<código>_<id>_<archivo>');
-- la Edge Function requirement-files firma la carga, la descarga y el borrado.
-- Al eliminar la estimación se eliminan sus filas; la app borra antes los objetos de S3.

create table if not exists public.estimation_documents (
  id text primary key,
  estimation_id text not null references public.estimations(id) on delete cascade,
  name text,
  type text,
  url text,
  created_at timestamptz not null default now()
);

create index if not exists estimation_documents_estimation_id_idx
  on public.estimation_documents (estimation_id);

alter table public.estimation_documents enable row level security;

-- Misma puerta que estimations: is_dev() incluye dev y pm.
drop policy if exists estimation_documents_dev_all on public.estimation_documents;
create policy estimation_documents_dev_all
on public.estimation_documents
for all
to authenticated
using ((select public.is_dev()))
with check ((select public.is_dev()));

revoke all on table public.estimation_documents from anon, public;
grant select, insert, update, delete on table public.estimation_documents to authenticated;
