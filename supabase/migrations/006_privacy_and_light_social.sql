-- Phases 1 and 2: private account controls and lightweight social chat.

create table public.conversation_reads (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conversation_key text not null check (
    conversation_key = 'class-chat'
    or conversation_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  read_at timestamptz not null default now(),
  primary key (classroom_id, user_id, conversation_key)
);

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '👏')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table public.message_mentions (
  message_id uuid not null references public.messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, mentioned_user_id)
);

create index message_reactions_message_idx on public.message_reactions (message_id);
create index message_mentions_user_idx
  on public.message_mentions (mentioned_user_id, created_at desc);

alter table public.conversation_reads enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_mentions enable row level security;

create policy "members manage their own read state"
  on public.conversation_reads for all to authenticated
  using (
    user_id = auth.uid()
    and private.is_classroom_member(classroom_id)
  )
  with check (
    user_id = auth.uid()
    and private.is_classroom_member(classroom_id)
    and (
      conversation_key = 'class-chat'
      or exists (
        select 1 from public.classroom_members peer
        where peer.classroom_id = conversation_reads.classroom_id
          and peer.user_id::text = conversation_reads.conversation_key
      )
    )
  );

create policy "message participants can read reactions"
  on public.message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.messages message
      where message.id = message_reactions.message_id
        and private.is_classroom_member(message.classroom_id)
        and (
          message.recipient_id is null
          or auth.uid() in (message.sender_id, message.recipient_id)
        )
    )
  );

create policy "message participants manage their reactions"
  on public.message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages message
      where message.id = message_reactions.message_id
        and private.is_classroom_member(message.classroom_id)
        and (
          message.recipient_id is null
          or auth.uid() in (message.sender_id, message.recipient_id)
        )
    )
  );

create policy "members remove their own reactions"
  on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

create policy "message participants can read mentions"
  on public.message_mentions for select to authenticated
  using (
    exists (
      select 1 from public.messages message
      where message.id = message_mentions.message_id
        and private.is_classroom_member(message.classroom_id)
        and (
          message.recipient_id is null
          or auth.uid() in (message.sender_id, message.recipient_id)
        )
    )
  );

create policy "senders can mention classroom participants"
  on public.message_mentions for insert to authenticated
  with check (
    exists (
      select 1
      from public.messages message
      join public.classroom_members mentioned
        on mentioned.classroom_id = message.classroom_id
       and mentioned.user_id = message_mentions.mentioned_user_id
      where message.id = message_mentions.message_id
        and message.sender_id = auth.uid()
        and (
          message.recipient_id is null
          or message_mentions.mentioned_user_id in (message.sender_id, message.recipient_id)
        )
    )
  );

revoke all on table public.conversation_reads from public, anon;
revoke all on table public.message_reactions from public, anon;
revoke all on table public.message_mentions from public, anon;
grant select, insert, update, delete on table public.conversation_reads to authenticated;
grant select, insert, delete on table public.message_reactions to authenticated;
grant select, insert on table public.message_mentions to authenticated;

alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.message_mentions;

-- Called only after the Edge Function has verified the member's password.
-- It removes user-owned data while preserving shared classrooms where possible.
create or replace function public.prepare_account_deletion(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_classroom record;
  successor_id uuid;
begin
  if target_user_id is null then raise exception 'User is required'; end if;

  for owned_classroom in
    select id from public.classrooms where created_by = target_user_id
  loop
    select member.user_id into successor_id
    from public.classroom_members member
    where member.classroom_id = owned_classroom.id
      and member.user_id <> target_user_id
    order by
      case when member.role = 'moderator' then 0 else 1 end,
      member.joined_at
    limit 1;

    if successor_id is null then
      delete from public.classrooms where id = owned_classroom.id;
    else
      update public.classrooms
      set created_by = successor_id
      where id = owned_classroom.id;
      update public.classroom_members
      set role = 'moderator'
      where classroom_id = owned_classroom.id
        and user_id = successor_id;
    end if;
  end loop;

  delete from public.reports where reporter_id = target_user_id;
  update public.reports set reviewed_by = null where reviewed_by = target_user_id;
  delete from public.announcements where author_id = target_user_id;
  delete from public.messages
  where sender_id = target_user_id or recipient_id = target_user_id;
  delete from public.classroom_members where user_id = target_user_id;
  delete from public.profiles where id = target_user_id;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
