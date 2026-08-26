create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'Vynq member',
  avatar_path text,
  bio text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (username is null or username ~ '^[a-z0-9._]{3,24}$')
);

create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  from_uid uuid not null references public.profiles(id) on delete cascade,
  to_uid uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  constraint follow_requests_not_self check (from_uid <> to_uid)
);

create unique index if not exists follow_requests_one_pending
  on public.follow_requests(from_uid, to_uid) where status = 'pending';

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  member_uids uuid[] not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint friendships_two_members check (cardinality(member_uids) = 2)
);

create unique index if not exists friendships_member_pair
  on public.friendships ((least(member_uids[1], member_uids[2])), (greatest(member_uids[1], member_uids[2])));

create table if not exists public.conversations (
  id uuid primary key references public.friendships(id) on delete cascade,
  member_uids uuid[] not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  last_message_at timestamptz,
  last_message_preview text,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint conversations_two_members check (cardinality(member_uids) = 2)
);

-- Repair conversations created by an earlier schema version. Existing tables are
-- not changed by CREATE TABLE IF NOT EXISTS.
alter table public.conversations add column if not exists member_uids uuid[];
alter table public.conversations add column if not exists status text default 'active';
alter table public.conversations add column if not exists last_message_at timestamptz;
alter table public.conversations add column if not exists last_message_preview text;
alter table public.conversations add column if not exists updated_at timestamptz default timezone('utc', now());

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'friendships' and column_name = 'member_uids'
  ) then
    execute $query$
      update public.conversations c
      set member_uids = f.member_uids
      from public.friendships f
      where c.id = f.id and c.member_uids is null
    $query$;
  end if;
end;
$$;

update public.conversations set status = 'active' where status is null;
update public.conversations set updated_at = timezone('utc', now()) where updated_at is null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_uid uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('text', 'image', 'video')),
  text text,
  storage_path text,
  content_type text,
  bytes bigint,
  duration_seconds numeric,
  upload_status text not null default 'ready' check (upload_status in ('uploading', 'ready')),
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '24 hours',
  read_at timestamptz,
  constraint messages_text_or_media check ((type = 'text' and length(trim(coalesce(text, ''))) between 1 and 4000) or (type <> 'text' and storage_path is not null))
);

-- Repair tables created by an earlier version of the schema. `create table if not exists`
-- does not reconcile columns when the table already exists.
alter table public.messages add column if not exists upload_status text default 'ready';
update public.messages set upload_status = 'ready' where upload_status is null;
alter table public.messages alter column upload_status set default 'ready';
alter table public.messages alter column upload_status set not null;
alter table public.messages add column if not exists expires_at timestamptz;
update public.messages
set expires_at = coalesce(created_at, timezone('utc', now())) + interval '24 hours'
where expires_at is null;
alter table public.messages alter column expires_at set default timezone('utc', now()) + interval '24 hours';
alter table public.messages alter column expires_at set not null;

create index if not exists messages_conversation_created on public.messages(conversation_id, created_at);
create index if not exists messages_expiration on public.messages(expires_at);

create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('image', 'video')),
  storage_path text,
  content_type text not null,
  bytes bigint not null,
  duration_seconds numeric,
  upload_status text not null default 'uploading' check (upload_status in ('uploading', 'ready')),
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '24 hours'
);

alter table public.statuses add column if not exists upload_status text default 'ready';
update public.statuses set upload_status = 'ready' where upload_status is null;
do $$
begin
  -- Preserve the intended `uploading` default on a fresh table, but repair an
  -- older table where this column existed without any default.
  if not exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relname = 'statuses' and a.attname = 'upload_status'
  ) then
    alter table public.statuses alter column upload_status set default 'ready';
  end if;
end;
$$;
alter table public.statuses alter column upload_status set not null;
alter table public.statuses add column if not exists expires_at timestamptz;
update public.statuses
set expires_at = coalesce(created_at, timezone('utc', now())) + interval '24 hours'
where expires_at is null;
alter table public.statuses alter column expires_at set default timezone('utc', now()) + interval '24 hours';
alter table public.statuses alter column expires_at set not null;

create index if not exists statuses_owner_expiration on public.statuses(owner_uid, expires_at);

create table if not exists public.status_viewers (
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_uid uuid not null references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default timezone('utc', now()),
  primary key (status_id, viewer_uid)
);

create table if not exists public.presence (
  uid uuid primary key references public.profiles(id) on delete cascade,
  state text not null check (state in ('online', 'offline')),
  last_changed timestamptz not null default timezone('utc', now())
);

create table if not exists public.typing (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  uid uuid not null references public.profiles(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, uid)
);

-- Keep the existing deployed parameter name so CREATE OR REPLACE can update the
-- function without dropping policies that depend on it.
create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations
    where id = target_conversation_id and auth.uid() = any(member_uids) and status = 'active'
  );
$$;

create or replace function public.are_friends(p_first uuid, p_second uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where member_uids @> array[p_first, p_second]::uuid[]
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  safe_username text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  safe_display_name text := left(coalesce(new.raw_user_meta_data ->> 'display_name', new.email, 'Vynq member'), 50);
begin
  if safe_username !~ '^[a-z0-9._]{3,24}$' then
    safe_username := null;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, safe_username, safe_display_name);
  return new;
exception when others then
  -- Never let a profile-create failure abort the auth signup (which surfaces to
  -- the user only as the generic "Database error saving new user"). Create the
  -- profile without a username and let the app assign one later via
  -- claim_username(). If even that fails, give up silently so signup succeeds.
  begin
    insert into public.profiles (id, username, display_name)
    values (new.id, null, safe_display_name)
    on conflict (id) do nothing;
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.claim_username(p_username text, p_display_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  clean_username text := lower(trim(regexp_replace(coalesce(p_username, ''), '^@+', '')));
  existing_username text;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'You must be signed in.'; end if;
  if clean_username !~ '^[a-z0-9._]{3,24}$' then raise exception using errcode = '22023', message = 'Username format is invalid.'; end if;
  select username into existing_username from public.profiles where id = auth.uid();
  if existing_username is not null and existing_username <> clean_username then
    raise exception using errcode = '23505', message = 'This account already has a different username.';
  end if;
  update public.profiles
    set username = clean_username,
        display_name = left(coalesce(nullif(trim(p_display_name), ''), display_name, clean_username), 50),
        updated_at = timezone('utc', now())
    where id = auth.uid();
  return jsonb_build_object('username', clean_username);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'That username is already taken.';
end;
$$;

create or replace function public.send_follow_request(p_target_uid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'You must be signed in.'; end if;
  if p_target_uid = auth.uid() then raise exception using errcode = '22023', message = 'You cannot follow yourself.'; end if;
  if not exists (select 1 from public.profiles where id = p_target_uid and username is not null) then
    raise exception using errcode = 'P0002', message = 'That profile does not exist.';
  end if;
  if public.are_friends(auth.uid(), p_target_uid) then raise exception using errcode = '23505', message = 'You are already friends.'; end if;
  insert into public.follow_requests (from_uid, to_uid) values (auth.uid(), p_target_uid) returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'This follow request is already active.';
end;
$$;

create or replace function public.respond_to_follow_request(p_request_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  request_row public.follow_requests;
  friendship_id uuid;
begin
  select * into request_row from public.follow_requests where id = p_request_id for update;
  if request_row.id is null then raise exception using errcode = 'P0002', message = 'That follow request no longer exists.'; end if;
  if request_row.to_uid <> auth.uid() then raise exception using errcode = '42501', message = 'Only the recipient can respond.'; end if;
  if request_row.status <> 'pending' then raise exception using errcode = '22023', message = 'That request has already been handled.'; end if;
  if p_decision not in ('accepted', 'rejected') then raise exception using errcode = '22023', message = 'Choose accept or reject.'; end if;
  update public.follow_requests set status = p_decision, updated_at = timezone('utc', now()), responded_at = timezone('utc', now()) where id = p_request_id;
  if p_decision = 'accepted' then
    select id into friendship_id from public.friendships where member_uids @> array[request_row.from_uid, request_row.to_uid]::uuid[] limit 1;
    if friendship_id is null then
      insert into public.friendships (member_uids) values (array[request_row.from_uid, request_row.to_uid]::uuid[]) returning id into friendship_id;
      insert into public.conversations (id, member_uids) values (friendship_id, array[request_row.from_uid, request_row.to_uid]::uuid[]);
    end if;
  end if;
  return jsonb_build_object('friendshipId', friendship_id, 'status', p_decision);
end;
$$;

create or replace function public.cancel_follow_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.follow_requests set status = 'cancelled', updated_at = timezone('utc', now()), responded_at = timezone('utc', now()) where id = p_request_id and from_uid = auth.uid() and status = 'pending';
  if not found then raise exception using errcode = 'P0002', message = 'That follow request is no longer active.'; end if;
  return jsonb_build_object('status', 'cancelled');
end;
$$;

-- The first schema version exposed a different return type for this standalone
-- RPC. PostgreSQL cannot replace a function while changing its return type.
drop function if exists public.send_message(uuid, text);
create or replace function public.send_message(p_conversation_id uuid, p_text text)
returns uuid language plpgsql security definer set search_path = public as $$
declare message_id uuid;
begin
  if not public.is_conversation_member(p_conversation_id) then raise exception using errcode = '42501', message = 'You are not a member of this conversation.'; end if;
  if length(trim(coalesce(p_text, ''))) < 1 or length(trim(p_text)) > 4000 then raise exception using errcode = '22023', message = 'Message length is invalid.'; end if;
  insert into public.messages (conversation_id, sender_uid, type, text) values (p_conversation_id, auth.uid(), 'text', trim(p_text)) returning id into message_id;
  update public.conversations set last_message_at = timezone('utc', now()), last_message_preview = left(trim(p_text), 120), updated_at = timezone('utc', now()) where id = p_conversation_id;
  return message_id;
end;
$$;

create or replace function public.create_media_message(p_conversation_id uuid, p_type text, p_content_type text, p_bytes bigint, p_duration numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare message_id uuid := gen_random_uuid(); storage_path text;
begin
  if not public.is_conversation_member(p_conversation_id) then raise exception using errcode = '42501', message = 'You are not a member of this conversation.'; end if;
  if p_type not in ('image', 'video') or p_content_type not in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm') then raise exception using errcode = '22023', message = 'Choose a supported media file.'; end if;
  if p_bytes <= 0 or (p_type = 'image' and p_bytes > 5242880) or (p_type = 'video' and p_bytes > 52428800) then raise exception using errcode = '22023', message = 'That media file is outside the allowed size limit.'; end if;
  if p_type = 'video' and (p_duration is null or p_duration <= 0 or p_duration > 30) then raise exception using errcode = '22023', message = 'Videos can be up to 30 seconds long.'; end if;
  storage_path := format('chat/%s/%s/%s', p_conversation_id, auth.uid(), message_id);
  insert into public.messages (id, conversation_id, sender_uid, type, storage_path, content_type, bytes, duration_seconds, upload_status)
  values (message_id, p_conversation_id, auth.uid(), p_type, storage_path, p_content_type, p_bytes, p_duration, 'uploading');
  return jsonb_build_object('messageId', message_id, 'storagePath', storage_path);
end;
$$;

create or replace function public.finalize_media_message(p_message_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.messages set upload_status = 'ready' where id = p_message_id and sender_uid = auth.uid() and upload_status = 'uploading';
  if not found then raise exception using errcode = 'P0002', message = 'That media message no longer exists.'; end if;
  return jsonb_build_object('messageId', p_message_id);
end;
$$;

create or replace function public.abort_media_message(p_message_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare path text;
begin
  select storage_path into path from public.messages where id = p_message_id and sender_uid = auth.uid();
  delete from public.messages where id = p_message_id and sender_uid = auth.uid();
  return jsonb_build_object('storagePath', path);
end;
$$;

create or replace function public.create_status(p_type text, p_content_type text, p_bytes bigint, p_duration numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare status_id uuid := gen_random_uuid(); storage_path text;
begin
  if p_type not in ('image', 'video') or p_content_type not in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm') then raise exception using errcode = '22023', message = 'Choose a supported media file.'; end if;
  if p_bytes <= 0 or (p_type = 'image' and p_bytes > 5242880) or (p_type = 'video' and p_bytes > 52428800) then raise exception using errcode = '22023', message = 'That media file is outside the allowed size limit.'; end if;
  if p_type = 'video' and (p_duration is null or p_duration <= 0 or p_duration > 30) then raise exception using errcode = '22023', message = 'Videos can be up to 30 seconds long.'; end if;
  storage_path := format('statuses/%s/%s', auth.uid(), status_id);
  insert into public.statuses (id, owner_uid, type, storage_path, content_type, bytes, duration_seconds) values (status_id, auth.uid(), p_type, storage_path, p_content_type, p_bytes, p_duration);
  return jsonb_build_object('statusId', status_id, 'storagePath', storage_path);
end;
$$;

create or replace function public.finalize_status(p_status_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.statuses set upload_status = 'ready' where id = p_status_id and owner_uid = auth.uid() and upload_status = 'uploading';
  if not found then raise exception using errcode = 'P0002', message = 'This status is no longer available.'; end if;
  return jsonb_build_object('statusId', p_status_id);
end;
$$;

create or replace function public.abort_status(p_status_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare path text;
begin
  select storage_path into path from public.statuses where id = p_status_id and owner_uid = auth.uid();
  delete from public.statuses where id = p_status_id and owner_uid = auth.uid();
  return jsonb_build_object('storagePath', path);
end;
$$;

create or replace function public.delete_status(p_status_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from public.statuses where id = p_status_id and owner_uid = auth.uid();
  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.cleanup_expired_rows()
returns jsonb language plpgsql security definer set search_path = public as $$
declare message_count integer; status_count integer;
begin
  delete from public.messages where expires_at <= timezone('utc', now()); get diagnostics message_count = row_count;
  delete from public.statuses where expires_at <= timezone('utc', now()); get diagnostics status_count = row_count;
  return jsonb_build_object('messages', message_count, 'statuses', status_count);
end;
$$;

alter table public.profiles enable row level security;
alter table public.follow_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.statuses enable row level security;
alter table public.status_viewers enable row level security;
alter table public.presence enable row level security;
alter table public.typing enable row level security;

-- Make this SQL editor migration safe to run again after a partial attempt.
drop policy if exists "Profiles are searchable by authenticated users" on public.profiles;
drop policy if exists "Users can update their profile" on public.profiles;
drop policy if exists "Participants can read follow requests" on public.follow_requests;
drop policy if exists "Users can create outgoing requests" on public.follow_requests;
drop policy if exists "Users can update their requests" on public.follow_requests;
drop policy if exists "Friends can read friendships" on public.friendships;
drop policy if exists "Members can read conversations" on public.conversations;
drop policy if exists "Members can read live messages" on public.messages;
drop policy if exists "Members can mark incoming messages read" on public.messages;
drop policy if exists "Friends can read active statuses" on public.statuses;
drop policy if exists "Users can insert own statuses" on public.statuses;
drop policy if exists "Users can update own statuses" on public.statuses;
drop policy if exists "Users can delete own statuses" on public.statuses;
drop policy if exists "Viewers can read status views" on public.status_viewers;
drop policy if exists "Users can mark statuses seen" on public.status_viewers;
drop policy if exists "Users can update own presence" on public.presence;
drop policy if exists "Authenticated users can read presence" on public.presence;
drop policy if exists "Conversation members can read typing" on public.typing;
drop policy if exists "Users can manage own typing" on public.typing;
drop policy if exists "Private media can be read by participants" on storage.objects;
drop policy if exists "Users can upload private media" on storage.objects;
drop policy if exists "Users can remove their private media" on storage.objects;

create policy "Profiles are searchable by authenticated users" on public.profiles for select to authenticated using (username is not null);
create policy "Users can update their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Participants can read follow requests" on public.follow_requests for select to authenticated using (from_uid = auth.uid() or to_uid = auth.uid());
create policy "Users can create outgoing requests" on public.follow_requests for insert to authenticated with check (from_uid = auth.uid() and from_uid <> to_uid);
create policy "Users can update their requests" on public.follow_requests for update to authenticated using (from_uid = auth.uid() or to_uid = auth.uid());

create policy "Friends can read friendships" on public.friendships for select to authenticated using (auth.uid() = any(member_uids));
create policy "Members can read conversations" on public.conversations for select to authenticated using (auth.uid() = any(member_uids));
create policy "Members can read live messages" on public.messages for select to authenticated using (public.is_conversation_member(conversation_id) and upload_status = 'ready' and expires_at > timezone('utc', now()));
create policy "Members can mark incoming messages read" on public.messages for update to authenticated using (public.is_conversation_member(conversation_id) and sender_uid <> auth.uid()) with check (public.is_conversation_member(conversation_id));

create policy "Friends can read active statuses" on public.statuses for select to authenticated using (upload_status = 'ready' and expires_at > timezone('utc', now()) and (owner_uid = auth.uid() or exists (select 1 from public.friendships f where auth.uid() = any(f.member_uids) and owner_uid = any(f.member_uids))));
create policy "Users can insert own statuses" on public.statuses for insert to authenticated with check (owner_uid = auth.uid());
create policy "Users can update own statuses" on public.statuses for update to authenticated using (owner_uid = auth.uid()) with check (owner_uid = auth.uid());
create policy "Users can delete own statuses" on public.statuses for delete to authenticated using (owner_uid = auth.uid());
create policy "Viewers can read status views" on public.status_viewers for select to authenticated using (viewer_uid = auth.uid() or exists (select 1 from public.statuses s where s.id = status_id and s.owner_uid = auth.uid()));
create policy "Users can mark statuses seen" on public.status_viewers for insert to authenticated with check (viewer_uid = auth.uid());
create policy "Users can update own presence" on public.presence for all to authenticated using (uid = auth.uid()) with check (uid = auth.uid());
create policy "Authenticated users can read presence" on public.presence for select to authenticated using (true);
create policy "Conversation members can read typing" on public.typing for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "Users can manage own typing" on public.typing for all to authenticated using (uid = auth.uid() and public.is_conversation_member(conversation_id)) with check (uid = auth.uid() and public.is_conversation_member(conversation_id));

grant execute on function public.claim_username(text, text) to authenticated;
grant execute on function public.send_follow_request(uuid) to authenticated;
grant execute on function public.respond_to_follow_request(uuid, text) to authenticated;
grant execute on function public.cancel_follow_request(uuid) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.create_media_message(uuid, text, text, bigint, numeric) to authenticated;
grant execute on function public.finalize_media_message(uuid) to authenticated;
grant execute on function public.abort_media_message(uuid) to authenticated;
grant execute on function public.create_status(text, text, bigint, numeric) to authenticated;
grant execute on function public.finalize_status(uuid) to authenticated;
grant execute on function public.abort_status(uuid) to authenticated;
grant execute on function public.delete_status(uuid) to authenticated;
grant execute on function public.cleanup_expired_rows() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-media', 'private-media', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = 52428800;

create policy "Private media can be read by participants" on storage.objects for select to authenticated using (
  bucket_id = 'private-media' and (
    ((storage.foldername(name))[1] = 'chat' and exists (select 1 from public.conversations c where c.id::text = (storage.foldername(name))[2] and auth.uid() = any(c.member_uids)))
    or ((storage.foldername(name))[1] = 'statuses' and exists (select 1 from public.statuses s where s.id::text = (storage.foldername(name))[3] and (s.owner_uid = auth.uid() or public.are_friends(s.owner_uid, auth.uid()))))
  )
);
create policy "Users can upload private media" on storage.objects for insert to authenticated with check (
  bucket_id = 'private-media' and ((storage.foldername(name))[1] = 'chat' and (storage.foldername(name))[3] = auth.uid()::text) or (bucket_id = 'private-media' and (storage.foldername(name))[1] = 'statuses' and (storage.foldername(name))[2] = auth.uid()::text)
);
create policy "Users can remove their private media" on storage.objects for delete to authenticated using (
  bucket_id = 'private-media' and (((storage.foldername(name))[1] = 'chat' and (storage.foldername(name))[3] = auth.uid()::text) or ((storage.foldername(name))[1] = 'statuses' and (storage.foldername(name))[2] = auth.uid()::text))
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.messages, public.conversations, public.follow_requests, public.statuses, public.presence, public.typing, public.status_viewers;
  exception when duplicate_object then null;
  end;
end $$;
