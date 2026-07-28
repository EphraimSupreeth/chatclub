-- Secure staff governance and time-limited classroom enrollment.
--
-- Bootstrap the first super admin after applying this migration:
-- insert into private.platform_staff (user_id, role, granted_by)
-- select id, 'super_admin', id
-- from auth.users
-- where lower(email) = lower('OWNER_EMAIL_HERE');

create table private.platform_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'moderator')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);

create table private.platform_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'moderator_granted',
    'moderator_revoked',
    'classroom_moderator_assigned',
    'classroom_moderator_removed'
  )),
  target_user_id uuid references auth.users(id) on delete set null,
  classroom_id uuid references public.classrooms(id) on delete set null,
  created_at timestamptz not null default now()
);

create table private.classroom_invites (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  code_hash text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses between 1 and 500),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index classroom_invites_one_active_idx
  on private.classroom_invites (classroom_id)
  where revoked_at is null;
create index classroom_invites_expiry_idx
  on private.classroom_invites (expires_at)
  where revoked_at is null;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.platform_staff
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function private.is_platform_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.platform_staff
    where user_id = auth.uid() and role in ('super_admin', 'moderator')
  );
$$;

-- Classroom authority requires both an assignment and current platform staff
-- approval. This replaces the earlier membership-only helper used by RLS.
create or replace function private.is_classroom_moderator(
  target_classroom_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classroom_members membership
    join private.platform_staff staff on staff.user_id = membership.user_id
    where membership.classroom_id = target_classroom_id
      and membership.user_id = auth.uid()
      and membership.role = 'moderator'
      and staff.role in ('super_admin', 'moderator')
  );
$$;

create or replace function public.get_platform_access()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role from private.platform_staff where user_id = auth.uid()),
    'student'
  );
$$;

create or replace function public.list_platform_moderators()
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  granted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_super_admin() then
    raise exception 'Super-admin permission required';
  end if;

  return query
  select
    staff.user_id,
    profile.display_name,
    account.email::text,
    staff.role,
    staff.granted_at
  from private.platform_staff staff
  join auth.users account on account.id = staff.user_id
  join public.profiles profile on profile.id = staff.user_id
  order by
    case when staff.role = 'super_admin' then 0 else 1 end,
    profile.display_name;
end;
$$;

create or replace function public.grant_platform_moderator(target_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null or not private.is_super_admin() then
    raise exception 'Super-admin permission required';
  end if;
  if target_email is null or char_length(btrim(target_email)) > 320 then
    raise exception 'Enter a valid account email';
  end if;

  select id into target_id
  from auth.users
  where lower(email) = lower(btrim(target_email))
    and email_confirmed_at is not null;

  if target_id is null then
    raise exception 'No confirmed ChatClub account matches that email';
  end if;

  insert into private.platform_staff (user_id, role, granted_by)
  values (target_id, 'moderator', auth.uid())
  on conflict (user_id) do update
  set
    role = case
      when private.platform_staff.role = 'super_admin' then 'super_admin'
      else 'moderator'
    end,
    granted_by = case
      when private.platform_staff.role = 'super_admin'
      then private.platform_staff.granted_by
      else auth.uid()
    end,
    granted_at = case
      when private.platform_staff.role = 'super_admin'
      then private.platform_staff.granted_at
      else now()
    end;

  insert into private.platform_audit_events (actor_id, action, target_user_id)
  values (auth.uid(), 'moderator_granted', target_id);
  return target_id;
end;
$$;

create or replace function public.revoke_platform_moderator(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_super_admin() then
    raise exception 'Super-admin permission required';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'You cannot revoke your own super-admin access';
  end if;
  if exists (
    select 1 from private.platform_staff
    where user_id = target_user_id and role = 'super_admin'
  ) then
    raise exception 'Super-admin access must be changed through the recovery procedure';
  end if;

  if exists (
    select 1
    from public.classroom_members target_membership
    where target_membership.user_id = target_user_id
      and target_membership.role = 'moderator'
      and not exists (
        select 1
        from public.classroom_members replacement
        where replacement.classroom_id = target_membership.classroom_id
          and replacement.role = 'moderator'
          and replacement.user_id <> target_user_id
      )
  ) then
    raise exception 'Assign another moderator to each classroom before revoking this account';
  end if;

  update public.classroom_members
  set role = 'student'
  where user_id = target_user_id and role = 'moderator';
  delete from private.platform_staff
  where user_id = target_user_id and role = 'moderator';

  insert into private.platform_audit_events (actor_id, action, target_user_id)
  values (auth.uid(), 'moderator_revoked', target_user_id);
end;
$$;

create or replace function public.set_classroom_moderator(
  target_classroom_id uuid,
  target_user_id uuid,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_super_admin() then
    raise exception 'Super-admin permission required';
  end if;
  if not exists (
    select 1 from private.platform_staff
    where user_id = target_user_id and role in ('super_admin', 'moderator')
  ) then
    raise exception 'Only approved platform staff can moderate a classroom';
  end if;

  if enabled then
    insert into public.classroom_members (classroom_id, user_id, role)
    values (target_classroom_id, target_user_id, 'moderator')
    on conflict (classroom_id, user_id) do update set role = 'moderator';
  else
    update public.classroom_members
    set role = 'student'
    where classroom_id = target_classroom_id
      and user_id = target_user_id
      and role = 'moderator';
    if not exists (
      select 1 from public.classroom_members
      where classroom_id = target_classroom_id and role = 'moderator'
    ) then
      raise exception 'A classroom must retain at least one moderator';
    end if;
  end if;

  insert into private.platform_audit_events (
    actor_id, action, target_user_id, classroom_id
  )
  values (
    auth.uid(),
    case when enabled
      then 'classroom_moderator_assigned'
      else 'classroom_moderator_removed'
    end,
    target_user_id,
    target_classroom_id
  );
end;
$$;

create or replace function private.issue_classroom_invite(
  target_classroom_id uuid,
  lifetime_hours integer,
  allowed_uses integer
)
returns table (invite_code text, expires_at timestamptz, max_uses integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_code text;
  expiration timestamptz;
begin
  if lifetime_hours not between 1 and 720 then
    raise exception 'Invitation lifetime must be between 1 hour and 30 days';
  end if;
  if allowed_uses not between 1 and 500 then
    raise exception 'Invitation use limit must be between 1 and 500';
  end if;

  generated_code := upper(encode(extensions.gen_random_bytes(16), 'hex'));
  expiration := now() + make_interval(hours => lifetime_hours);

  update private.classroom_invites
  set revoked_at = now()
  where classroom_id = target_classroom_id and revoked_at is null;

  insert into private.classroom_invites (
    classroom_id, code_hash, created_by, expires_at, max_uses
  )
  values (
    target_classroom_id,
    extensions.crypt(generated_code, extensions.gen_salt('bf')),
    auth.uid(),
    expiration,
    allowed_uses
  );

  update public.classrooms
  set invite_code_hash = extensions.crypt(
    upper(encode(extensions.gen_random_bytes(16), 'hex')),
    extensions.gen_salt('bf')
  )
  where id = target_classroom_id;

  return query select generated_code, expiration, allowed_uses;
end;
$$;

create or replace function public.create_classroom(
  classroom_name text,
  classroom_school_name text
)
returns table (classroom_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_classroom_id uuid;
  new_invite record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_platform_moderator() then
    raise exception 'An approved moderator account is required to create a classroom';
  end if;

  insert into public.classrooms (name, school_name, invite_code_hash, created_by)
  values (
    btrim(classroom_name),
    btrim(classroom_school_name),
    extensions.crypt(
      upper(encode(extensions.gen_random_bytes(16), 'hex')),
      extensions.gen_salt('bf')
    ),
    auth.uid()
  )
  returning id into new_classroom_id;

  insert into public.classroom_members (classroom_id, user_id, role)
  values (new_classroom_id, auth.uid(), 'moderator');

  select * into new_invite
  from private.issue_classroom_invite(new_classroom_id, 168, 40);

  return query select new_classroom_id, new_invite.invite_code;
end;
$$;

create or replace function public.create_classroom_invite(
  target_classroom_id uuid,
  lifetime_hours integer default 168,
  allowed_uses integer default 40
)
returns table (invite_code text, expires_at timestamptz, max_uses integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_classroom_moderator(target_classroom_id) then
    raise exception 'Classroom moderator permission required';
  end if;
  if not private.is_platform_moderator() then
    raise exception 'Your platform moderator access is no longer active';
  end if;

  return query
  select * from private.issue_classroom_invite(
    target_classroom_id, lifetime_hours, allowed_uses
  );

  insert into public.audit_events (classroom_id, actor_id, action, metadata)
  values (
    target_classroom_id,
    auth.uid(),
    'invite_rotated',
    jsonb_build_object(
      'expires_in_hours', lifetime_hours,
      'max_uses', allowed_uses
    )
  );
end;
$$;

create or replace function public.get_classroom_invite_status(
  target_classroom_id uuid
)
returns table (
  expires_at timestamptz,
  max_uses integer,
  use_count integer,
  revoked boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not private.is_classroom_moderator(target_classroom_id) then
    raise exception 'Classroom moderator permission required';
  end if;

  return query
  select
    invite.expires_at,
    invite.max_uses,
    invite.use_count,
    invite.revoked_at is not null,
    invite.created_at
  from private.classroom_invites invite
  where invite.classroom_id = target_classroom_id
  order by invite.created_at desc
  limit 1;
end;
$$;

create or replace function public.revoke_classroom_invite(
  target_classroom_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not private.is_classroom_moderator(target_classroom_id) then
    raise exception 'Classroom moderator permission required';
  end if;
  update private.classroom_invites
  set revoked_at = now()
  where classroom_id = target_classroom_id and revoked_at is null;
  insert into public.audit_events (classroom_id, actor_id, action, metadata)
  values (
    target_classroom_id, auth.uid(), 'invite_rotated',
    '{"state":"revoked"}'::jsonb
  );
end;
$$;

create or replace function public.rotate_classroom_invite(
  target_classroom_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_invite record;
begin
  select * into new_invite
  from public.create_classroom_invite(target_classroom_id, 168, 40);
  return new_invite.invite_code;
end;
$$;

create or replace function public.join_classroom(class_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_invite private.classroom_invites%rowtype;
  recent_attempts integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if class_code is null or char_length(btrim(class_code)) <> 32 then
    raise exception 'Invalid or expired class code';
  end if;

  delete from private.classroom_join_attempts
  where attempted_at < now() - interval '1 day';
  select count(*) into recent_attempts
  from private.classroom_join_attempts
  where user_id = auth.uid()
    and attempted_at > now() - interval '15 minutes';
  if recent_attempts >= 5 then
    raise exception 'Too many invitation attempts. Please wait 15 minutes.';
  end if;
  insert into private.classroom_join_attempts (user_id) values (auth.uid());

  select invite.* into matched_invite
  from private.classroom_invites invite
  where invite.revoked_at is null
    and invite.expires_at > now()
    and invite.use_count < invite.max_uses
    and invite.code_hash = extensions.crypt(
      upper(btrim(class_code)), invite.code_hash
    )
  order by invite.created_at desc
  limit 1
  for update;

  if matched_invite.id is null then
    raise exception 'Invalid or expired class code';
  end if;

  insert into public.classroom_members (classroom_id, user_id, role)
  values (matched_invite.classroom_id, auth.uid(), 'student')
  on conflict do nothing;

  if found then
    update private.classroom_invites
    set use_count = use_count + 1
    where id = matched_invite.id;
  end if;

  delete from private.classroom_join_attempts where user_id = auth.uid();
  return matched_invite.classroom_id;
end;
$$;

create or replace function public.remove_classroom_member(
  target_classroom_id uuid,
  target_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role public.classroom_role;
  new_invite record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_classroom_moderator(target_classroom_id) then
    raise exception 'Classroom moderator permission required';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Moderators cannot remove themselves';
  end if;

  select role into target_role
  from public.classroom_members
  where classroom_id = target_classroom_id and user_id = target_user_id;
  if target_role is null then raise exception 'Member not found'; end if;
  if target_role = 'moderator' and not private.is_super_admin() then
    raise exception 'Only a super-admin can remove another moderator';
  end if;

  delete from public.classroom_members
  where classroom_id = target_classroom_id and user_id = target_user_id;

  insert into public.audit_events (
    classroom_id, actor_id, action, target_user_id
  )
  values (
    target_classroom_id, auth.uid(), 'member_removed', target_user_id
  );

  select * into new_invite
  from private.issue_classroom_invite(target_classroom_id, 168, 40);
  insert into public.audit_events (classroom_id, actor_id, action, metadata)
  values (
    target_classroom_id, auth.uid(), 'invite_rotated',
    '{"reason":"member_removed"}'::jsonb
  );
  return new_invite.invite_code;
end;
$$;

revoke all on table private.platform_staff
  from public, anon, authenticated;
revoke all on table private.platform_audit_events
  from public, anon, authenticated;
revoke all on table private.classroom_invites
  from public, anon, authenticated;

revoke all on function private.is_super_admin()
  from public, anon, authenticated;
revoke all on function private.is_platform_moderator()
  from public, anon, authenticated;
revoke all on function private.is_classroom_moderator(uuid)
  from public, anon, authenticated;
revoke all on function private.issue_classroom_invite(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.is_platform_moderator() to authenticated;
grant execute on function private.is_classroom_moderator(uuid) to authenticated;

revoke all on function public.get_platform_access() from public, anon;
revoke all on function public.list_platform_moderators() from public, anon;
revoke all on function public.grant_platform_moderator(text) from public, anon;
revoke all on function public.revoke_platform_moderator(uuid) from public, anon;
revoke all on function public.set_classroom_moderator(uuid, uuid, boolean)
  from public, anon;
revoke all on function public.create_classroom_invite(uuid, integer, integer)
  from public, anon;
revoke all on function public.get_classroom_invite_status(uuid)
  from public, anon;
revoke all on function public.revoke_classroom_invite(uuid)
  from public, anon;

grant execute on function public.get_platform_access() to authenticated;
grant execute on function public.list_platform_moderators() to authenticated;
grant execute on function public.grant_platform_moderator(text) to authenticated;
grant execute on function public.revoke_platform_moderator(uuid) to authenticated;
grant execute on function public.set_classroom_moderator(uuid, uuid, boolean)
  to authenticated;
grant execute on function public.create_classroom_invite(uuid, integer, integer)
  to authenticated;
grant execute on function public.get_classroom_invite_status(uuid)
  to authenticated;
grant execute on function public.revoke_classroom_invite(uuid)
  to authenticated;
