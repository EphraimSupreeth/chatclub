-- Milestone 3: safety enforcement, moderation operations, and audit trails.

create table public.member_blocks (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (classroom_id, user_id, blocked_user_id),
  check (user_id <> blocked_user_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in (
    'report_created',
    'report_reviewed',
    'member_removed',
    'invite_rotated'
  )),
  target_user_id uuid references public.profiles(id) on delete set null,
  target_report_id uuid references public.reports(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index member_blocks_lookup_idx
  on public.member_blocks (classroom_id, blocked_user_id, user_id);
create index audit_events_classroom_created_idx
  on public.audit_events (classroom_id, created_at desc);
create index messages_sender_created_idx
  on public.messages (sender_id, created_at desc);

create table private.classroom_join_attempts (
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);

create index classroom_join_attempts_user_time_idx
  on private.classroom_join_attempts (user_id, attempted_at desc);

alter table public.member_blocks enable row level security;
alter table public.audit_events enable row level security;

create policy "users can read their own blocks"
  on public.member_blocks for select to authenticated
  using (user_id = auth.uid());

create policy "users can create their own blocks"
  on public.member_blocks for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.is_classroom_member(classroom_id)
    and exists (
      select 1 from public.classroom_members blocked_member
      where blocked_member.classroom_id = member_blocks.classroom_id
        and blocked_member.user_id = member_blocks.blocked_user_id
    )
  );

create policy "users can remove their own blocks"
  on public.member_blocks for delete to authenticated
  using (user_id = auth.uid());

create policy "moderators can read classroom audit events"
  on public.audit_events for select to authenticated
  using (private.is_classroom_moderator(classroom_id));

drop policy "members can send authorized messages" on public.messages;
create policy "members can send authorized messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and private.is_classroom_member(classroom_id)
    and (
      recipient_id is null
      or (
        exists (
          select 1 from public.classroom_members recipient
          where recipient.classroom_id = messages.classroom_id
            and recipient.user_id = messages.recipient_id
        )
        and not exists (
          select 1 from public.member_blocks blocked
          where blocked.classroom_id = messages.classroom_id
            and (
              (blocked.user_id = auth.uid() and blocked.blocked_user_id = messages.recipient_id)
              or
              (blocked.user_id = messages.recipient_id and blocked.blocked_user_id = auth.uid())
            )
        )
      )
    )
  );

create or replace function private.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  minute_count integer;
  hour_count integer;
begin
  select count(*) into minute_count
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if minute_count >= 20 then
    raise exception using
      errcode = 'P0001',
      message = 'Message limit reached. Please wait a minute before sending again.';
  end if;

  select count(*) into hour_count
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 hour';

  if hour_count >= 300 then
    raise exception using
      errcode = 'P0001',
      message = 'Hourly message limit reached. Please try again later.';
  end if;

  return new;
end;
$$;

create trigger enforce_message_rate_limit
  before insert on public.messages
  for each row execute function private.enforce_message_rate_limit();

create or replace function private.audit_new_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    classroom_id,
    actor_id,
    action,
    target_report_id
  )
  values (
    new.classroom_id,
    new.reporter_id,
    'report_created',
    new.id
  );
  return new;
end;
$$;

create trigger audit_report_created
  after insert on public.reports
  for each row execute function private.audit_new_report();

create or replace function public.join_classroom(class_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_classroom_id uuid;
  recent_attempts integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  delete from private.classroom_join_attempts
  where attempted_at < now() - interval '1 day';

  select count(*) into recent_attempts
  from private.classroom_join_attempts
  where user_id = auth.uid()
    and attempted_at > now() - interval '15 minutes';

  if recent_attempts >= 5 then
    raise exception 'Too many invitation attempts. Please wait 15 minutes.';
  end if;

  insert into private.classroom_join_attempts (user_id)
  values (auth.uid());

  select id into matched_classroom_id
  from public.classrooms
  where invite_code_hash = extensions.crypt(upper(btrim(class_code)), invite_code_hash)
  limit 1;

  if matched_classroom_id is null then raise exception 'Invalid class code'; end if;

  insert into public.classroom_members (classroom_id, user_id)
  values (matched_classroom_id, auth.uid())
  on conflict do nothing;

  delete from private.classroom_join_attempts where user_id = auth.uid();
  return matched_classroom_id;
end;
$$;

create or replace function public.resolve_report(
  target_report_id uuid,
  resolution public.report_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_classroom_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if resolution not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'Invalid report resolution';
  end if;

  select classroom_id into target_classroom_id
  from public.reports
  where id = target_report_id;

  if target_classroom_id is null
    or not private.is_classroom_moderator(target_classroom_id) then
    raise exception 'Moderator permission required';
  end if;

  update public.reports
  set
    status = resolution,
    reviewed_by = auth.uid(),
    resolved_at = case
      when resolution in ('resolved', 'dismissed') then now()
      else null
    end
  where id = target_report_id;

  insert into public.audit_events (
    classroom_id,
    actor_id,
    action,
    target_report_id,
    metadata
  )
  values (
    target_classroom_id,
    auth.uid(),
    'report_reviewed',
    target_report_id,
    jsonb_build_object('resolution', resolution)
  );
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
  moderator_count integer;
  generated_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_classroom_moderator(target_classroom_id) then
    raise exception 'Moderator permission required';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Moderators cannot remove themselves';
  end if;

  select role into target_role
  from public.classroom_members
  where classroom_id = target_classroom_id and user_id = target_user_id;

  if target_role is null then raise exception 'Member not found'; end if;
  if target_role = 'moderator' then
    select count(*) into moderator_count
    from public.classroom_members
    where classroom_id = target_classroom_id and role = 'moderator';
    if moderator_count <= 1 then raise exception 'Cannot remove the only moderator'; end if;
  end if;

  delete from public.classroom_members
  where classroom_id = target_classroom_id and user_id = target_user_id;

  generated_code := upper(
    substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12)
  );

  update public.classrooms
  set invite_code_hash = extensions.crypt(
    generated_code,
    extensions.gen_salt('bf')
  )
  where id = target_classroom_id;

  insert into public.audit_events (
    classroom_id,
    actor_id,
    action,
    target_user_id
  )
  values (
    target_classroom_id,
    auth.uid(),
    'member_removed',
    target_user_id
  );

  insert into public.audit_events (classroom_id, actor_id, action)
  values (target_classroom_id, auth.uid(), 'invite_rotated');

  return generated_code;
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
  generated_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_classroom_moderator(target_classroom_id) then
    raise exception 'Moderator permission required';
  end if;

  generated_code := upper(
    substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12)
  );

  update public.classrooms
  set invite_code_hash = extensions.crypt(
    generated_code,
    extensions.gen_salt('bf')
  )
  where id = target_classroom_id;

  insert into public.audit_events (classroom_id, actor_id, action)
  values (target_classroom_id, auth.uid(), 'invite_rotated');

  return generated_code;
end;
$$;

create or replace function private.purge_expired_chatclub_data()
returns table (messages_removed bigint, audit_events_removed bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_messages bigint;
  removed_audits bigint;
begin
  delete from public.messages
  where created_at < now() - interval '180 days';
  get diagnostics removed_messages = row_count;

  delete from public.audit_events
  where created_at < now() - interval '365 days';
  get diagnostics removed_audits = row_count;

  return query select removed_messages, removed_audits;
end;
$$;

revoke all on function private.enforce_message_rate_limit() from public, anon, authenticated;
revoke all on function private.audit_new_report() from public, anon, authenticated;
revoke all on function private.purge_expired_chatclub_data() from public, anon, authenticated;
revoke all on table private.classroom_join_attempts from public, anon, authenticated;

revoke all on function public.resolve_report(uuid, public.report_status) from public, anon;
revoke all on function public.remove_classroom_member(uuid, uuid) from public, anon;
revoke all on function public.rotate_classroom_invite(uuid) from public, anon;
grant execute on function public.resolve_report(uuid, public.report_status) to authenticated;
grant execute on function public.remove_classroom_member(uuid, uuid) to authenticated;
grant execute on function public.rotate_classroom_invite(uuid) to authenticated;
