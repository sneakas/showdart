-- Source-side scheduler for hosts whose plan cannot run minute cron jobs.
-- Credentials are supplied separately through Vault; no secrets enter Git.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists showdart_private;
revoke all on schema showdart_private from public, anon, authenticated;

create or replace function showdart_private.queue_display_retry()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  retry_url text;
  retry_token text;
begin
  -- Read the small indexed source queue. Idle club screens add no HTTP calls.
  if not exists (
    select 1 from public.showdart_display_outbox
    where delivered_at is null and expired_at is null and next_attempt_at <= clock_timestamp()
  ) and not exists (
    select 1 from public.showdart_display_outbox
    where created_at < clock_timestamp() - interval '7 days'
  ) then return null; end if;

  select decrypted_secret into retry_url from vault.decrypted_secrets
  where name = 'showdart_lane_display_retry_url';
  select decrypted_secret into retry_token from vault.decrypted_secrets
  where name = 'showdart_lane_display_retry_token';
  if retry_url is null or retry_token is null then return null; end if;

  return net.http_get(
    url := retry_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || retry_token),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function showdart_private.queue_display_retry() from public, anon, authenticated;

select cron.schedule(
  'showdart-lane-display-retry',
  '* * * * *',
  'select showdart_private.queue_display_retry();'
);
-- Activate only after the application and its credentials have been verified.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'showdart-lane-display-retry'),
  active := false
);
