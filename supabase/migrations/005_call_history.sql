-- Phase B: participant-visible one-to-one call history.
-- This stores call metadata only. Audio, video, and transcripts are never stored.

create table public.call_history (
  id uuid primary key default gen_random_uuid(),
  call_id text not null unique,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null default 'video'
    check (media_type in ('audio', 'video')),
  status text not null default 'calling'
    check (status in ('calling', 'completed', 'missed', 'declined', 'failed', 'cancelled')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  constraint call_history_distinct_participants check (caller_id <> recipient_id)
);

create index call_history_participants_started_idx
  on public.call_history (classroom_id, started_at desc);

alter table public.call_history enable row level security;

create policy "call participants can read call history"
  on public.call_history for select to authenticated
  using (
    auth.uid() in (caller_id, recipient_id)
    and public.is_classroom_member(classroom_id)
  );

create policy "members can create their outgoing call history"
  on public.call_history for insert to authenticated
  with check (
    caller_id = auth.uid()
    and public.is_classroom_member(classroom_id)
    and exists (
      select 1
      from public.classroom_members recipient
      where recipient.classroom_id = call_history.classroom_id
        and recipient.user_id = call_history.recipient_id
    )
  );

create policy "call participants can update call state"
  on public.call_history for update to authenticated
  using (auth.uid() in (caller_id, recipient_id))
  with check (
    auth.uid() in (caller_id, recipient_id)
    and public.is_classroom_member(classroom_id)
  );

create or replace function private.protect_call_history_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.call_id <> old.call_id
    or new.classroom_id <> old.classroom_id
    or new.caller_id <> old.caller_id
    or new.recipient_id <> old.recipient_id
    or new.media_type <> old.media_type
    or new.started_at <> old.started_at then
    raise exception 'Call identity fields cannot be changed';
  end if;
  return new;
end;
$$;

create trigger protect_call_history_identity
  before update on public.call_history
  for each row execute function private.protect_call_history_identity();

revoke all on table public.call_history from public, anon;
grant select, insert, update on table public.call_history to authenticated;

revoke all on function private.protect_call_history_identity()
  from public, anon, authenticated;

alter publication supabase_realtime add table public.call_history;
