-- Milestone 4: authorize private Realtime channels used for direct presence,
-- typing indicators, message refresh hints, and one-to-one WebRTC signaling.
--
-- Channel topics have this exact form:
-- direct:<classroom uuid>:<lower user uuid>:<higher user uuid>

create or replace function private.can_access_direct_realtime_topic(
  target_topic text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  topic_classroom_id uuid;
  first_user_id uuid;
  second_user_id uuid;
begin
  if auth.uid() is null
    or split_part(target_topic, ':', 1) <> 'direct'
    or array_length(string_to_array(target_topic, ':'), 1) <> 4 then
    return false;
  end if;

  begin
    topic_classroom_id := split_part(target_topic, ':', 2)::uuid;
    first_user_id := split_part(target_topic, ':', 3)::uuid;
    second_user_id := split_part(target_topic, ':', 4)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if first_user_id::text >= second_user_id::text
    or auth.uid() not in (first_user_id, second_user_id) then
    return false;
  end if;

  return exists (
    select 1
    from public.classroom_members first_member
    join public.classroom_members second_member
      on second_member.classroom_id = first_member.classroom_id
    where first_member.classroom_id = topic_classroom_id
      and first_member.user_id = first_user_id
      and second_member.user_id = second_user_id
  )
  and not exists (
    select 1
    from public.member_blocks blocked
    where blocked.classroom_id = topic_classroom_id
      and (
        (blocked.user_id = first_user_id and blocked.blocked_user_id = second_user_id)
        or
        (blocked.user_id = second_user_id and blocked.blocked_user_id = first_user_id)
      )
  );
end;
$$;

revoke all on function private.can_access_direct_realtime_topic(text)
  from public, anon, authenticated;
grant execute on function private.can_access_direct_realtime_topic(text)
  to authenticated;

create policy "direct participants can receive realtime events"
  on realtime.messages
  for select
  to authenticated
  using (private.can_access_direct_realtime_topic(realtime.topic()));

create policy "direct participants can send realtime events"
  on realtime.messages
  for insert
  to authenticated
  with check (private.can_access_direct_realtime_topic(realtime.topic()));
