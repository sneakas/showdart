\set ON_ERROR_STOP on
-- Run only after the local fixture, real display producer, and both migrations.
insert into public.kamptavle_lane_display_v2_settings(lane_number) values(1),(2);
insert into public.screen_devices(lane_number) values(1),(2);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

do $$
declare
  owner uuid := '11111111-1111-4111-8111-111111111111';
  session_a uuid := '22222222-2222-4222-8222-222222222222';
  session_b uuid := '33333333-3333-4333-8333-333333333333';
  board jsonb := '{"mode":"mickey","stage":"playing","matchLabel":"Finale","players":[{"participantKey":"a","playerId":null,"name":"Alice","marks":[0,0,0,0,0,0,0,0,0]},{"participantKey":"b","playerId":null,"name":"Bob","marks":[0,0,0,0,0,0,0,0,0]}]}';
  result jsonb; approved jsonb; previous_count bigint; hold_at timestamptz;
begin
  result := public.apply_showdart_lane_display('claim',1,session_a,owner,1,board);
  assert (result->>'status')::int=403, 'must be disabled by default';
  perform public.set_showdart_lane_enabled(1,true);
  result := public.apply_showdart_lane_display('claim',1,session_a,owner,1,board);
  assert (result->>'ok')::boolean, 'first claim must succeed';
  assert (select state_json->>'source'='showdart' from public.kamptavle_lane_display_v2_states where lane_number=1), 'must use existing producer';
  previous_count := (select count(*) from realtime.messages);
  result := public.apply_showdart_lane_display('claim',1,session_a,owner,1,board);
  assert (select count(*) from realtime.messages)=previous_count, 'duplicate claim must not broadcast';
  result := public.claim_kamptavle_training_lane('native',1);
  assert result->>'status'='occupied', 'native and external claims must share arbitration';
  assert public.get_kamptavle_training_lane_availability()->0->>'status'='occupied', 'native availability must show external occupancy';
  result := public.apply_showdart_lane_display('claim',1,session_b,owner,1,board);
  assert (result->>'status')::int=409, 'second session must not take over';
  result := public.apply_showdart_lane_display('release',1,session_b,owner,1);
  assert (result->>'status')::int=409, 'old session release must not clear current game';

  board := jsonb_set(board,'{players,0,marks,0}','3');
  result := public.apply_showdart_lane_display('update',1,session_a,owner,2,board);
  assert (result->>'status')::int=429, 'server must cap rapid ordinary updates';
  update public.external_lane_display_states set last_score_at=clock_timestamp()-interval '1 second' where lane_number=1;
  result := public.apply_showdart_lane_display('update',1,session_a,owner,2,board);
  assert (result->>'ok')::boolean;
  assert (select state_json#>>'{players,0,marks,0}'='3' from public.kamptavle_lane_display_v2_states where lane_number=1);
  result := public.apply_showdart_lane_display('update',1,session_a,owner,1,jsonb_set(board,'{players,0,marks,0}','0'));
  assert (result->>'stale')::boolean, 'late state must not undo a newer state';
  previous_count := (select count(*) from realtime.messages);
  update public.external_lane_display_states set expires_at=clock_timestamp()+interval '60 seconds' where lane_number=1;
  result := public.apply_showdart_lane_display('heartbeat',1,session_a,owner,3);
  assert (select count(*) from realtime.messages)=previous_count, 'heartbeat must not broadcast';
  assert (select expires_at>clock_timestamp()+interval '120 seconds' from public.external_lane_display_states where lane_number=1);

  approved := board || '{"stage":"approved","placements":["b","a"]}'::jsonb;
  result := public.apply_showdart_lane_display('result',1,session_a,owner,4,approved,'event-a',clock_timestamp());
  assert (result->>'ok')::boolean;
  select expires_at into hold_at from public.external_lane_display_states where lane_number=1;
  previous_count := (select count(*) from realtime.messages);
  result := public.apply_showdart_lane_display('result',1,session_a,owner,4,approved,'event-a',clock_timestamp());
  assert (result->>'duplicate')::boolean;
  assert (select expires_at=hold_at from public.external_lane_display_states where lane_number=1), 'duplicate must not restart result hold';
  result := public.apply_showdart_lane_display('update',1,session_a,owner,999,board);
  assert (result->>'sealed')::boolean, 'late live state must not replace approved result';
  result := public.apply_showdart_lane_display('release',1,session_a,owner,1000);
  assert (select count(*) from realtime.messages)=previous_count, 'normal stop must retain approved result';

  update public.external_lane_display_states set expires_at=clock_timestamp()-interval '1 second' where lane_number=1;
  update public.kamptavle_lane_display_v2_states set state_json=jsonb_set(state_json,'{leaseExpiresAt}',to_jsonb((clock_timestamp()-interval '1 second')::text)) where lane_number=1;
  result := public.get_kamptavle_lane_display_v2_snapshot(1);
  assert result#>>'{state,mode}'='idle', 'result must clear on expiry recovery';
  result := public.apply_showdart_lane_display('claim',1,session_b,owner,1,board);
  assert (result->>'ok')::boolean;
  result := public.apply_showdart_lane_display('result',1,session_a,owner,1001,approved,'event-a',clock_timestamp());
  assert (result->>'skipped')::boolean, 'old result must not replace new game';
  assert (select session_id=session_b from public.external_lane_display_states where lane_number=1);

  insert into public.kamptavle_tournaments values('tournament',2);
  insert into public.kamptavle_display_config values('club',true,'tournament');
  perform public.refresh_kamptavle_lane_display_v2_state(1,false);
  assert (select state_mode='template' from public.kamptavle_lane_display_v2_states where lane_number=1), 'native tournament must take precedence';
  result := public.apply_showdart_lane_display('update',1,session_b,owner,2,board);
  assert (result->>'status')::int=409;
  update public.kamptavle_display_config set enabled=false;
  perform public.set_showdart_lane_enabled(1,false);
  assert (select state_mode='idle' from public.kamptavle_lane_display_v2_states where lane_number=1), 'admin disable must restore native screen';
  result := public.claim_kamptavle_training_lane('native',1);
  assert (result->>'ok')::boolean;
  perform public.set_showdart_lane_enabled(1,true);
  result := public.apply_showdart_lane_display('claim',1,session_a,owner,1,board);
  assert (result->>'status')::int=409, 'external may not take native training lane';

  assert not has_function_privilege('anon','public.apply_showdart_lane_display(text,integer,uuid,uuid,bigint,jsonb,text,timestamptz)','execute');
  assert not has_function_privilege('authenticated','public.claim_kamptavle_training_lane_without_showdart(text,integer)','execute');
  assert not has_table_privilege('authenticated','public.external_lane_display_states','update');
  assert has_function_privilege('anon','public.get_kamptavle_lane_display_v2_snapshot(integer)','execute');
end;
$$;

do $$
declare owner uuid := '11111111-1111-4111-8111-111111111111'; saved_at timestamptz := clock_timestamp(); count_jobs int; changed boolean;
begin
  insert into public.tournament_states values(owner,'test','{"winner":null}',saved_at);
  changed := public.save_showdart_result_with_display(owner,'test',saved_at-interval '1 second','{"winner":1}','event','{}');
  assert not changed;
  assert (select count(*) from public.showdart_display_outbox)=0, 'failed CAS must not enqueue';
  changed := public.save_showdart_result_with_display(owner,'test',saved_at,'{"winner":1}','event','{}');
  assert changed;
  assert (select state_json->>'winner'='1' from public.tournament_states where tournament_key='test');
  select count(*) into count_jobs from public.claim_showdart_display_deliveries('event');
  assert count_jobs=1;
  select count(*) into count_jobs from public.claim_showdart_display_deliveries('event');
  assert count_jobs=0, 'second worker cannot claim in-flight job';
  perform public.finish_showdart_display_delivery('event',99,true);
  assert (select delivered_at is null from public.showdart_display_outbox where event_id='event');
  perform public.finish_showdart_display_delivery('event',1,true);
  assert (select delivered_at is not null from public.showdart_display_outbox where event_id='event');
  select updated_at into saved_at from public.tournament_states where tournament_key='test';
  begin
    perform public.save_showdart_result_with_display(owner,'test',saved_at,'{"winner":2}','bad',jsonb_build_object('huge',repeat('x',12001)));
    raise exception 'Expected queue constraint to reject oversized delivery';
  exception when check_violation then null;
  end;
  assert (select state_json->>'winner'='1' from public.tournament_states where tournament_key='test'), 'outbox failure must roll back result commit';
  assert not has_function_privilege('authenticated','public.save_showdart_result_with_display(uuid,text,timestamptz,jsonb,text,jsonb)','execute');
end;
$$;
select 'Lane ownership, rate limits, expiry, idempotency, privileges and atomic outbox passed' as result;
