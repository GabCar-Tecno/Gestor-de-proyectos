-- Private file storage for requirement specifications, estimates, and supporting documents.
-- Object paths start with the requirement id; the requirements table's existing RLS
-- policies determine which authenticated users can access each object's parent.

insert into storage.buckets (id, name, public, file_size_limit)
values ('requirement-documents', 'requirement-documents', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists requirement_documents_storage_read on storage.objects;
create policy requirement_documents_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'requirement-documents'
  and exists (
    select 1 from public.requirements r
    where r.id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists requirement_documents_storage_insert on storage.objects;
create policy requirement_documents_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'requirement-documents'
  and exists (
    select 1 from public.requirements r
    where r.id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists requirement_documents_storage_delete on storage.objects;
create policy requirement_documents_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'requirement-documents'
  and exists (
    select 1 from public.requirements r
    where r.id::text = (storage.foldername(name))[1]
  )
);
