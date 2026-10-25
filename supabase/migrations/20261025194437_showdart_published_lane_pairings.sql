-- One current projection per organizer/lane. Replacements supersede pending
-- deliveries; live scores never enter this queue and idle rows do not poll.
create sequence public.showdart_lane_announcement_revision;
revoke all on sequence public.showdart_lane_announcement_revision from public, anon, authenticated;
grant usage on sequence public.showdart_lane_announcement_revision to service_role;

create table public.showdart_lane_announcements (
  user_id uuid not null,
  lane_number integer not null check (lane_number between 1 and 64),
  revision bigint not null default nextval('public.showdart_lane_announcement_revision'),
  payload_json jsonb,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default clock_timestamp(),
  delivered_at timestamptz,
  primary key (user_id, lane_number),
  check (revision > 0),
  check (payload_json is null or octet_length(payload_json::text) <= 8192)
);
create index showdart_lane_announcements_pending on public.showdart_lane_announcements(next_attempt_at) where delivered_at is null;
alter table public.showdart_lane_announcements enable row level security;
revoke all on public.showdart_lane_announcements from public, anon, authenticated;
grant select, insert, update, delete on public.showdart_lane_announcements to service_role;

-- Both competitions are read together by the server. Compare both versions
-- under one organizer lock so simultaneous result/publish operations cannot
-- commit a pairing calculated from an obsolete other competition.
create function public.save_showdart_state_with_announcements(
  target_user_id uuid, target_tournament_key text, expected_states jsonb,
  target_state jsonb, target_announcements jsonb,
  target_event_id text default null, target_delivery jsonb default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  saved_at timestamptz;
begin
  if target_tournament_key not in ('showdart-default', 'showdart-championship')
    or jsonb_typeof(target_state) is distinct from 'object'
    or jsonb_typeof(target_announcements) is distinct from 'array'
    or jsonb_array_length(target_announcements) > 64
    or not (expected_states ?& array['showdart-default','showdart-championship'])
    or (target_event_id is null) <> (target_delivery is null) then
    raise exception 'Invalid competition save';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('showdart-publication:' || target_user_id::text, 0));
  if exists (
    select 1 from unnest(array['showdart-default','showdart-championship']) as keys(key)
    left join public.tournament_states state on state.user_id = target_user_id and state.tournament_key = keys.key
    where state.updated_at is distinct from (expected_states ->> keys.key)::timestamptz
  ) then return jsonb_build_object('ok', false); end if;

  saved_at := clock_timestamp();
  insert into public.tournament_states(user_id, tournament_key, state_json, updated_at)
  values(target_user_id, target_tournament_key, target_state, saved_at)
  on conflict(user_id, tournament_key) do update set state_json = excluded.state_json, updated_at = excluded.updated_at;

  if target_delivery is not null then
    insert into public.showdart_display_outbox(event_id, user_id, payload_json)
    values(target_event_id, target_user_id, target_delivery) on conflict(event_id) do nothing;
  end if;
  for item in select value from jsonb_array_elements(target_announcements) loop
    if exists(select 1 from public.showdart_lane_announcements
      where user_id=target_user_id and lane_number=(item->>'lane')::integer
        and payload_json is not distinct from nullif(item->'board','null'::jsonb)) then continue; end if;
    -- Do not create empty projections on every ordinary pre-publication save.
    if item->'board' = 'null'::jsonb and not exists (
      select 1 from public.showdart_lane_announcements where user_id = target_user_id and lane_number = (item->>'lane')::integer
    ) then continue; end if;
    insert into public.showdart_lane_announcements(user_id, lane_number, payload_json)
    values(target_user_id, (item->>'lane')::integer, nullif(item->'board','null'::jsonb))
    on conflict(user_id,lane_number) do update
    set payload_json = excluded.payload_json, revision = nextval('public.showdart_lane_announcement_revision'),
      attempts = 0, next_attempt_at = clock_timestamp(), delivered_at = null
    where public.showdart_lane_announcements.payload_json is distinct from excluded.payload_json;
  end loop;
  return jsonb_build_object('ok', true, 'updatedAt', saved_at);
end;
$$;
revoke all on function public.save_showdart_state_with_announcements(uuid,text,jsonb,jsonb,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.save_showdart_state_with_announcements(uuid,text,jsonb,jsonb,jsonb,text,jsonb) to service_role;

create function public.claim_showdart_lane_announcements(target_user_id uuid default null)
returns setof public.showdart_lane_announcements language sql security invoker set search_path = '' as $$
  with claimed as (
    select user_id,lane_number from public.showdart_lane_announcements
    where delivered_at is null and next_attempt_at <= clock_timestamp()
      and (target_user_id is null or user_id = target_user_id)
    order by next_attempt_at limit 8 for update skip locked
  )
  update public.showdart_lane_announcements jobs set attempts = attempts + 1, next_attempt_at = clock_timestamp() + interval '40 seconds'
  from claimed where jobs.user_id = claimed.user_id and jobs.lane_number = claimed.lane_number returning jobs.*;
$$;
revoke all on function public.claim_showdart_lane_announcements(uuid) from public, anon, authenticated;
grant execute on function public.claim_showdart_lane_announcements(uuid) to service_role;

create function public.finish_showdart_lane_announcement(
  target_user_id uuid, target_lane_number integer, target_revision bigint, target_attempt integer, was_delivered boolean
)
returns void language sql security invoker set search_path = '' as $$
  update public.showdart_lane_announcements
  set delivered_at = case when was_delivered then clock_timestamp() else null end,
    next_attempt_at = clock_timestamp() + make_interval(secs => least(120,(2 ^ least(attempts,6))::integer))
  where user_id = target_user_id and lane_number = target_lane_number
    and revision = target_revision and attempts = target_attempt and delivered_at is null;
$$;
revoke all on function public.finish_showdart_lane_announcement(uuid,integer,bigint,integer,boolean) from public, anon, authenticated;
grant execute on function public.finish_showdart_lane_announcement(uuid,integer,bigint,integer,boolean) to service_role;

-- Extend the installed source-only scheduler. Never add a target database job
-- or repeated HTTP work when both delivery queues are empty.
create or replace function showdart_private.queue_display_retry()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare retry_url text; retry_token text;
begin
  if not exists(select 1 from public.showdart_display_outbox where delivered_at is null and expired_at is null and next_attempt_at <= clock_timestamp())
    and not exists(select 1 from public.showdart_display_outbox where created_at < clock_timestamp() - interval '7 days')
    and not exists(select 1 from public.showdart_lane_announcements where delivered_at is null and next_attempt_at <= clock_timestamp())
  then return null; end if;
  select decrypted_secret into retry_url from vault.decrypted_secrets where name = 'showdart_lane_display_retry_url';
  select decrypted_secret into retry_token from vault.decrypted_secrets where name = 'showdart_lane_display_retry_token';
  if retry_url is null or retry_token is null then return null; end if;
  return net.http_get(url := retry_url, headers := jsonb_build_object('Authorization','Bearer ' || retry_token), timeout_milliseconds := 60000);
end;
$$;
revoke all on function showdart_private.queue_display_retry() from public, anon, authenticated;
