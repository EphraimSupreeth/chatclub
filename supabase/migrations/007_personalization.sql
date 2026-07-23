-- Phase 3: lightweight profile personalization without image uploads.

alter table public.profiles
  add column avatar_tone text not null default 'blue'
  check (avatar_tone in ('blue', 'peach', 'mint', 'violet'));

create table private.profile_update_log (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create or replace function private.limit_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_update timestamptz;
begin
  if new.id <> old.id or new.id <> auth.uid() then
    raise exception 'You can only update your own profile';
  end if;
  if new.created_at <> old.created_at then raise exception 'Profile creation date cannot change'; end if;
  new.avatar_initials := public.make_initials(new.display_name);

  if new.display_name is not distinct from old.display_name
    and new.avatar_tone is not distinct from old.avatar_tone then
    return new;
  end if;

  select updated_at into previous_update
  from private.profile_update_log
  where user_id = new.id;

  if previous_update is not null
    and previous_update > now() - interval '10 minutes' then
    raise exception 'Please wait 10 minutes before changing your profile again';
  end if;

  insert into private.profile_update_log (user_id, updated_at)
  values (new.id, now())
  on conflict (user_id) do update set updated_at = excluded.updated_at;
  return new;
end;
$$;

create trigger limit_profile_changes
  before update on public.profiles
  for each row
  execute function private.limit_profile_changes();

revoke all on table private.profile_update_log from public, anon, authenticated;
revoke all on function private.limit_profile_changes() from public, anon, authenticated;
