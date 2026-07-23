create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.classroom_role as enum ('student', 'moderator');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  avatar_initials text not null check (char_length(avatar_initials) between 1 and 4),
  created_at timestamptz not null default now()
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  school_name text not null check (char_length(school_name) between 2 and 120),
  invite_code_hash text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.classroom_members (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.classroom_role not null default 'student',
  joined_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id),
  recipient_id uuid references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id),
  title text not null check (char_length(title) between 2 and 140),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  reporter_id uuid not null default auth.uid() references public.profiles(id),
  reason text not null check (char_length(reason) between 3 and 1000),
  status public.report_status not null default 'open',
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.member_mutes (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  muted_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (classroom_id, user_id, muted_user_id),
  check (user_id <> muted_user_id)
);

create index messages_classroom_created_idx
  on public.messages (classroom_id, created_at desc);
create index messages_direct_idx
  on public.messages (classroom_id, sender_id, recipient_id, created_at desc);
create index reports_classroom_status_idx
  on public.reports (classroom_id, status, created_at desc);

create or replace function public.make_initials(full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(
    left(split_part(btrim(full_name), ' ', 1), 1) ||
    case
      when position(' ' in btrim(full_name)) > 0
      then left(reverse(split_part(reverse(btrim(full_name)), ' ', 1)), 1)
      else ''
    end
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_name text;
begin
  new_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'New member');
  insert into public.profiles (id, display_name, avatar_initials)
  values (new.id, new_name, public.make_initials(new_name));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_classroom_member(target_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.classroom_members
    where classroom_id = target_classroom_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_classroom_moderator(target_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.classroom_members
    where classroom_id = target_classroom_id
      and user_id = auth.uid()
      and role = 'moderator'
  );
$$;

create or replace function public.shares_classroom_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classroom_members mine
    join public.classroom_members theirs
      on theirs.classroom_id = mine.classroom_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user_id
  );
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
  generated_code text;
  new_classroom_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  generated_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12));

  insert into public.classrooms (name, school_name, invite_code_hash, created_by)
  values (
    btrim(classroom_name),
    btrim(classroom_school_name),
    extensions.crypt(generated_code, extensions.gen_salt('bf')),
    auth.uid()
  )
  returning id into new_classroom_id;

  insert into public.classroom_members (classroom_id, user_id, role)
  values (new_classroom_id, auth.uid(), 'moderator');

  return query select new_classroom_id, generated_code;
end;
$$;

create or replace function public.join_classroom(class_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_classroom_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select id into matched_classroom_id
  from public.classrooms
  where invite_code_hash = extensions.crypt(upper(btrim(class_code)), invite_code_hash)
  limit 1;

  if matched_classroom_id is null then raise exception 'Invalid class code'; end if;

  insert into public.classroom_members (classroom_id, user_id)
  values (matched_classroom_id, auth.uid())
  on conflict do nothing;

  return matched_classroom_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.messages enable row level security;
alter table public.announcements enable row level security;
alter table public.reports enable row level security;
alter table public.member_mutes enable row level security;

create policy "classmates can read profiles"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_classroom_with(id));
create policy "users can update their own profile"
  on public.profiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid());

create policy "members can read classrooms"
  on public.classrooms for select to authenticated
  using (public.is_classroom_member(id));

create policy "members can read classroom membership"
  on public.classroom_members for select to authenticated
  using (public.is_classroom_member(classroom_id));

create policy "participants can read messages"
  on public.messages for select to authenticated
  using (
    public.is_classroom_member(classroom_id)
    and (
      recipient_id is null
      or sender_id = auth.uid()
      or recipient_id = auth.uid()
    )
  );

create policy "members can send authorized messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_classroom_member(classroom_id)
    and (
      recipient_id is null
      or exists (
        select 1 from public.classroom_members recipient
        where recipient.classroom_id = messages.classroom_id
          and recipient.user_id = messages.recipient_id
      )
    )
  );

create policy "members can read announcements"
  on public.announcements for select to authenticated
  using (public.is_classroom_member(classroom_id));
create policy "moderators can create announcements"
  on public.announcements for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_classroom_moderator(classroom_id)
  );

create policy "reporter or moderators can read reports"
  on public.reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or public.is_classroom_moderator(classroom_id)
  );
create policy "members can create reports"
  on public.reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and public.is_classroom_member(classroom_id)
    and (
      message_id is null
      or exists (
        select 1 from public.messages reported_message
        where reported_message.id = reports.message_id
          and reported_message.classroom_id = reports.classroom_id
      )
    )
  );
create policy "moderators can review reports"
  on public.reports for update to authenticated
  using (public.is_classroom_moderator(classroom_id))
  with check (public.is_classroom_moderator(classroom_id));

create policy "users manage their own mutes"
  on public.member_mutes for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_classroom_member(classroom_id)
    and exists (
      select 1 from public.classroom_members muted_member
      where muted_member.classroom_id = member_mutes.classroom_id
        and muted_member.user_id = member_mutes.muted_user_id
    )
  );

revoke all on function public.create_classroom(text, text) from public;
revoke all on function public.join_classroom(text) from public;
revoke all on function public.is_classroom_member(uuid) from public;
revoke all on function public.is_classroom_moderator(uuid) from public;
revoke all on function public.shares_classroom_with(uuid) from public;
grant execute on function public.create_classroom(text, text) to authenticated;
grant execute on function public.join_classroom(text) to authenticated;
grant execute on function public.is_classroom_member(uuid) to authenticated;
grant execute on function public.is_classroom_moderator(uuid) to authenticated;
grant execute on function public.shares_classroom_with(uuid) to authenticated;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.announcements;
