-- Only approved results enter this queue. Live scores never touch this table.
create table public.showdart_display_outbox (
  event_id text primary key,
  user_id uuid not null,
  payload_json jsonb not null,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  delivered_at timestamptz,
  expired_at timestamptz,
  check (octet_length(payload_json::text) <= 12000)
);
create index showdart_display_outbox_pending on public.showdart_display_outbox(next_attempt_at) where delivered_at is null and expired_at is null;
create index showdart_display_outbox_retention on public.showdart_display_outbox(created_at);
alter table public.showdart_display_outbox enable row level security;
revoke all on public.showdart_display_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.showdart_display_outbox to service_role;

create function public.save_showdart_result_with_display(
  target_user_id uuid, target_tournament_key text, expected_updated_at timestamptz,
  target_state jsonb, target_event_id text, target_delivery jsonb
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.tournament_states set state_json = target_state, updated_at = clock_timestamp()
  where user_id = target_user_id and tournament_key = target_tournament_key and updated_at = expected_updated_at;
  if not found then return false; end if;
  insert into public.showdart_display_outbox(event_id, user_id, payload_json)
  values(target_event_id, target_user_id, target_delivery) on conflict(event_id) do nothing;
  return true;
end;
$$;
revoke all on function public.save_showdart_result_with_display(uuid, text, timestamptz, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_showdart_result_with_display(uuid, text, timestamptz, jsonb, text, jsonb) to service_role;

create function public.claim_showdart_display_deliveries(target_event_id text default null)
returns setof public.showdart_display_outbox language plpgsql security definer set search_path = '' as $$
begin
  -- Bounded retention, including failures during extended outages.
  delete from public.showdart_display_outbox where created_at < clock_timestamp() - interval '7 days';
  update public.showdart_display_outbox set expired_at = clock_timestamp()
  where delivered_at is null and expired_at is null and created_at <= clock_timestamp() - interval '5 minutes';
  return query
  with claimed as (
    select event_id from public.showdart_display_outbox
    where delivered_at is null and expired_at is null and next_attempt_at <= clock_timestamp()
      and created_at > clock_timestamp() - interval '5 minutes'
      and (target_event_id is null or event_id = target_event_id)
    order by next_attempt_at limit 5 for update skip locked
  )
  update public.showdart_display_outbox jobs
  set attempts = attempts + 1, next_attempt_at = clock_timestamp() + interval '40 seconds'
  from claimed where jobs.event_id = claimed.event_id returning jobs.*;
end;
$$;
revoke all on function public.claim_showdart_display_deliveries(text) from public, anon, authenticated;
grant execute on function public.claim_showdart_display_deliveries(text) to service_role;

create function public.finish_showdart_display_delivery(target_event_id text, target_attempt integer, was_delivered boolean)
returns void language sql security definer set search_path = '' as $$
  update public.showdart_display_outbox
  set delivered_at = case when was_delivered then clock_timestamp() else null end,
      next_attempt_at = clock_timestamp() + make_interval(secs => least(120, (2 ^ least(attempts, 6))::integer))
  where event_id = target_event_id and attempts = target_attempt and delivered_at is null;
$$;
revoke all on function public.finish_showdart_display_delivery(text, integer, boolean) from public, anon, authenticated;
grant execute on function public.finish_showdart_display_delivery(text, integer, boolean) to service_role;
