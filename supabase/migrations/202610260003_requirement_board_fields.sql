-- Additional fields requested for the centralized requirements board.
alter table public.requirements
  add column if not exists change_description text not null default '',
  add column if not exists observations text not null default '',
  add column if not exists user_delivery_date date;

-- Keep existing requirements readable on the new board until their change description is edited.
update public.requirements
set change_description = coalesce(nullif(trim(change_description), ''), title)
where change_description is null or trim(change_description) = '';
