create table public.showdart_registration_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  competition_instance text not null,
  imported boolean not null default false,
  revision integer not null default 0
);

create table public.showdart_registration_entries (
  session_id uuid not null references public.showdart_registration_sessions(id) on delete cascade,
  id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  name_key text not null,
  removed boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  primary key (session_id, id)
);

create unique index showdart_registration_unique_name
  on public.showdart_registration_entries(session_id, name_key) where not removed;

alter table public.showdart_registration_sessions enable row level security;
alter table public.showdart_registration_entries enable row level security;
revoke all on public.showdart_registration_sessions, public.showdart_registration_entries from public, anon, authenticated;
grant select, insert, update, delete on public.showdart_registration_sessions, public.showdart_registration_entries to service_role;

create function public.showdart_registration_name_key(player_name text)
returns text language sql immutable strict set search_path = '' as $$
  select lower(btrim(regexp_replace(normalize(player_name, NFC), '[[:space:]]+', ' ', 'g')));
$$;

create function public.showdart_registration_roster_has(tournament jsonb, key text)
returns boolean language sql immutable set search_path = '' as $$
  select exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(tournament->'players') = 'array' then tournament->'players' else '[]'::jsonb end
    ) player where public.showdart_registration_name_key(player->>'name') = key
  );
$$;

create function public.showdart_registration_accepts(tournament jsonb, instance text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(tournament->>'competitionInstanceId', 'legacy') = instance
    and coalesce(tournament->>'started', 'false') = 'false'
    and coalesce(tournament->>'teammateMode', 'changing') <> 'fixed';
$$;

create function public.showdart_keep_open_registration()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  active_instance text;
begin
  if new.tournament_key <> 'showdart-default' then return new; end if;
  if tg_op = 'UPDATE'
    and (old.state_json->>'started', old.state_json->>'teammateMode', old.state_json->>'competitionInstanceId')
      is not distinct from (new.state_json->>'started', new.state_json->>'teammateMode', new.state_json->>'competitionInstanceId')
  then return new; end if;
  select competition_instance into active_instance from public.showdart_registration_sessions
    where user_id = new.user_id and not imported;
  if found and not public.showdart_registration_accepts(new.state_json, active_instance) then
    raise exception 'ShowDart registration is open' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger showdart_keep_open_registration
  before insert or update of state_json on public.tournament_states
  for each row execute function public.showdart_keep_open_registration();

create function public.showdart_registration_snapshot(owner_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('id', session.id, 'imported', session.imported, 'revision', session.revision,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object('id', entry.id, 'name', entry.name) order by entry.created_at, entry.id)
      from public.showdart_registration_entries entry where entry.session_id = session.id and not entry.removed
    ), '[]'::jsonb))
  from public.showdart_registration_sessions session where session.user_id = owner_id;
$$;

create function public.showdart_register_player(target_session uuid, request_id uuid, player_name text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  registration public.showdart_registration_sessions%rowtype;
  tournament jsonb;
  key text;
begin
  select * into registration from public.showdart_registration_sessions where id = target_session;
  if not found then return jsonb_build_object('code', 'missing'); end if;

  if request_id is not null then
    -- Serialize with close/import and the existing tournament save.
    perform pg_advisory_xact_lock(hashtextextended('showdart-publication:' || registration.user_id::text, 0));
    select * into registration from public.showdart_registration_sessions where id = target_session;
    if not found then return jsonb_build_object('code', 'missing'); end if;
    if exists (select 1 from public.showdart_registration_entries where session_id = target_session and id = request_id) then
      return jsonb_build_object('code', 'ok');
    end if;
  end if;

  select state_json into tournament from public.tournament_states
    where user_id = registration.user_id and tournament_key = 'showdart-default';
  if registration.imported or not public.showdart_registration_accepts(tournament, registration.competition_instance) then
    return jsonb_build_object('code', 'closed');
  end if;
  if request_id is null then return jsonb_build_object('code', 'ok'); end if;

  key := public.showdart_registration_name_key(player_name);
  if coalesce(key, '') = '' or char_length(player_name) > 80 then
    return jsonb_build_object('code', 'invalid_name');
  end if;
  if public.showdart_registration_roster_has(tournament, key) then
    return jsonb_build_object('code', 'duplicate');
  end if;
  insert into public.showdart_registration_entries(session_id, id, name, name_key)
    values (target_session, request_id, player_name, key)
    on conflict (session_id, name_key) where not removed do nothing;
  if not found then return jsonb_build_object('code', 'duplicate'); end if;
  update public.showdart_registration_sessions set revision = revision + 1 where id = target_session;
  return jsonb_build_object('code', 'ok');
end;
$$;

create function public.showdart_manage_registration(
  owner_id uuid, operation text, target_session uuid, target_entry uuid, player_name text,
  expected_revision integer, expected_state_time timestamptz, next_state jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  registration public.showdart_registration_sessions%rowtype;
  tournament jsonb;
  state_time timestamptz;
  instance text;
  key text;
  conflicting_name text;
begin
  perform pg_advisory_xact_lock(hashtextextended('showdart-publication:' || owner_id::text, 0));
  select state_json, updated_at into tournament, state_time from public.tournament_states
    where user_id = owner_id and tournament_key = 'showdart-default';
  instance := coalesce(tournament->>'competitionInstanceId', 'legacy');
  select * into registration from public.showdart_registration_sessions where user_id = owner_id;

  if operation = 'open' then
    if not public.showdart_registration_accepts(tournament, instance) then return jsonb_build_object('code', 'unavailable'); end if;
    if registration.id is null or registration.imported or registration.competition_instance <> instance then
      delete from public.showdart_registration_sessions where user_id = owner_id;
      insert into public.showdart_registration_sessions(user_id, competition_instance) values (owner_id, instance);
    end if;
    return jsonb_build_object('code', 'ok');
  end if;

  if registration.id is null or registration.id <> target_session then return jsonb_build_object('code', 'changed'); end if;
  if operation = 'transfer' and registration.imported and tournament->>'registrationImportId' = registration.id::text then
    return jsonb_build_object('code', 'ok', 'state', tournament, 'updatedAt', state_time);
  end if;
  if registration.imported or not public.showdart_registration_accepts(tournament, registration.competition_instance) then
    return jsonb_build_object('code', 'closed');
  end if;

  if operation = 'transfer' then
    if registration.revision is distinct from expected_revision or state_time is distinct from expected_state_time
      or jsonb_typeof(next_state) is distinct from 'object' then
      return jsonb_build_object('code', 'changed');
    end if;
    select name into conflicting_name from public.showdart_registration_entries
      where session_id = registration.id and not removed and public.showdart_registration_roster_has(tournament, name_key)
      limit 1;
    if found then return jsonb_build_object('code', 'duplicate', 'name', conflicting_name); end if;

    state_time := clock_timestamp();
    insert into public.tournament_states(user_id, tournament_key, state_json, updated_at)
      values (owner_id, 'showdart-default', next_state, state_time)
      on conflict (user_id, tournament_key) do update set state_json = excluded.state_json, updated_at = excluded.updated_at;
    update public.showdart_registration_sessions set imported = true where id = registration.id;
    delete from public.showdart_registration_entries where session_id = registration.id;
    return jsonb_build_object('code', 'ok', 'state', next_state, 'updatedAt', state_time);
  end if;

  if operation = 'rename' then
    key := public.showdart_registration_name_key(player_name);
    if coalesce(key, '') = '' or char_length(player_name) > 80 then
      return jsonb_build_object('code', 'invalid_name');
    end if;
    if public.showdart_registration_roster_has(tournament, key) or exists (
      select 1 from public.showdart_registration_entries
      where session_id = target_session and id <> target_entry and name_key = key and not removed
    ) then return jsonb_build_object('code', 'duplicate'); end if;
    update public.showdart_registration_entries set name = player_name, name_key = key
      where session_id = target_session and id = target_entry and not removed;
  elsif operation = 'remove' then
    update public.showdart_registration_entries set removed = true
      where session_id = target_session and id = target_entry and not removed;
  else
    return jsonb_build_object('code', 'invalid');
  end if;
  if found then
    update public.showdart_registration_sessions set revision = revision + 1 where id = target_session;
  end if;
  return jsonb_build_object('code', 'ok');
end;
$$;

revoke all on function public.showdart_registration_name_key(text),
  public.showdart_registration_roster_has(jsonb,text), public.showdart_registration_accepts(jsonb,text),
  public.showdart_keep_open_registration(),
  public.showdart_registration_snapshot(uuid), public.showdart_register_player(uuid,uuid,text),
  public.showdart_manage_registration(uuid,text,uuid,uuid,text,integer,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.showdart_registration_name_key(text),
  public.showdart_registration_roster_has(jsonb,text), public.showdart_registration_accepts(jsonb,text),
  public.showdart_registration_snapshot(uuid), public.showdart_register_player(uuid,uuid,text),
  public.showdart_manage_registration(uuid,text,uuid,uuid,text,integer,timestamptz,jsonb) to service_role;
