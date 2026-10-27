-- Store a human-readable name for each application profile.
alter table public.profiles
  add column if not exists display_name text;

-- Reuse names already present in Supabase Auth metadata when available.
update public.profiles as profile
set display_name = coalesce(
  nullif(trim(auth_user.raw_user_meta_data->>'full_name'), ''),
  nullif(trim(auth_user.raw_user_meta_data->>'name'), ''),
  nullif(trim(concat_ws(' ',
    nullif(auth_user.raw_user_meta_data->>'first_name', ''),
    nullif(auth_user.raw_user_meta_data->>'last_name', '')
  )), '')
)
from auth.users as auth_user
where auth_user.id = profile.id
  and nullif(trim(profile.display_name), '') is null
  and (
    nullif(trim(auth_user.raw_user_meta_data->>'full_name'), '') is not null
    or nullif(trim(auth_user.raw_user_meta_data->>'name'), '') is not null
    or nullif(trim(auth_user.raw_user_meta_data->>'first_name'), '') is not null
    or nullif(trim(auth_user.raw_user_meta_data->>'last_name'), '') is not null
  );

comment on column public.profiles.display_name is
  'Human-readable name shown when assigning a requirement owner.';
