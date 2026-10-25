-- Isolated local test schema. Never apply this fixture to an application DB.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create schema realtime;
create table realtime.messages(payload jsonb, event text, topic text);
create function realtime.send(payload jsonb, event text, topic text, private boolean) returns void language sql as $$ insert into realtime.messages values(payload,event,topic) $$;
create table public.kamptavle_lane_display_v2_settings(lane_number integer primary key, enabled boolean default true, training_stream_enabled boolean default true, stream_id text default 'test-stream');
create table public.kamptavle_lane_display_v2_states(lane_number integer primary key, protocol_version integer, stream_id text, revision bigint, state_mode text, state_json jsonb, updated_at timestamptz);
create table public.kamptavle_training_lane_reservations(lane_number integer primary key, live_match_key text, owner_user_id uuid, expires_at timestamptz);
create table public.screen_devices(lane_number integer primary key, enabled boolean default true, last_seen_at timestamptz default clock_timestamp(), kiosk_service_active boolean default true);
create table public.kamptavle_tournaments(id text primary key, lanes_count integer);
create table public.kamptavle_display_config(id text primary key, enabled boolean, active_tournament_id text);
create table public.tournament_states(user_id uuid, tournament_key text, state_json jsonb, updated_at timestamptz, primary key(user_id,tournament_key));

create function public.build_kamptavle_lane_display_v2_state(target_lane_number integer, shared_stats_payload jsonb default null)
returns jsonb language sql as $$
 select case when exists (select 1 from public.kamptavle_display_config where enabled) then
  jsonb_build_object('mode','template','laneNumber',target_lane_number,'template','announcement','title','Native tournament','message',null,'imageUrl',null)
 else jsonb_build_object('mode','idle','laneNumber',target_lane_number,'message',null) end;
$$;
create function public.make_kamptavle_lane_display_v2_patch(old_state jsonb,new_state jsonb) returns jsonb language sql as $$ select null::jsonb $$;
create function public.get_kamptavle_lane_display_v2_snapshot(target_lane_number integer) returns jsonb language sql as $$
 select jsonb_build_object('protocolVersion',1,'messageType','snapshot','streamId',stream_id,
  'scope',jsonb_build_object('type','lane','laneNumber',lane_number),'revision',revision,'generatedAt',updated_at,'state',state_json)
 from public.kamptavle_lane_display_v2_states where lane_number=target_lane_number;
$$;
create function public.claim_kamptavle_training_lane(target_live_match_key text,target_lane_number integer) returns jsonb language plpgsql security definer as $$
begin
 perform pg_advisory_xact_lock(31415,target_lane_number);
 insert into public.kamptavle_training_lane_reservations values(target_lane_number,target_live_match_key,auth.uid(),clock_timestamp()+interval '130 seconds')
 on conflict(lane_number) do update set live_match_key=excluded.live_match_key,owner_user_id=excluded.owner_user_id,expires_at=excluded.expires_at;
 return jsonb_build_object('ok',true);
end;
$$;
create function public.get_kamptavle_training_lane_availability(target_live_match_key text default null) returns jsonb language sql as $$
 select jsonb_agg(jsonb_build_object('lane_number',lane_number,'status','available','available',true)) from public.kamptavle_lane_display_v2_settings;
$$;
