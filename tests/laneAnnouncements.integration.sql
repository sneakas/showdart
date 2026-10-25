-- Isolated fixture only; never run this file on a production database.
truncate public.tournament_states,public.showdart_display_outbox,public.external_lane_display_states,
  public.kamptavle_training_lane_reservations,public.kamptavle_display_config,public.kamptavle_tournaments,
  public.kamptavle_lane_display_v2_states,realtime.messages;
insert into public.kamptavle_lane_display_v2_settings(lane_number) values(1),(2) on conflict do nothing;
insert into public.screen_devices(lane_number) values(1),(2) on conflict do nothing;
select public.set_showdart_lane_enabled(1,true);

do $$
declare
  owner uuid := '11111111-1111-4111-8111-111111111111';
  other_owner uuid := '44444444-4444-4444-8444-444444444444';
  game uuid := '22222222-2222-4222-8222-222222222222';
  pairing jsonb := '{"mode":"template","template":"announcement","laneNumber":1,"title":"Alice · Bob","message":"Cup · Round 1","imageUrl":null,"showdartPairing":{"matchKey":"cup:one:10","competitionName":"Cup","roundLabel":"Round 1","names":["Alice","Bob"]}}';
  next_pairing jsonb;
  board jsonb := '{"mode":"mickey","stage":"playing","matchLabel":"Cup","players":[{"participantKey":"a","playerId":null,"name":"Alice","marks":[0,0,0,0,0,0,0,0,0]},{"participantKey":"b","playerId":null,"name":"Bob","marks":[0,0,0,0,0,0,0,0,0]}]}';
  result jsonb; count_messages bigint; saved_at timestamptz; projection_revision bigint; new_revision bigint; attempt int; expected jsonb;
begin
  -- Publication works while a Pi is offline; it recovers from its snapshot.
  update public.screen_devices set last_seen_at=clock_timestamp()-interval '1 day' where lane_number=1;
  result := public.apply_showdart_lane_pairing(1,owner,1,pairing);
  assert result->>'ok'='true';
  assert public.get_kamptavle_lane_display_v2_snapshot(1)#>>'{state,showdartPairing,names,0}'='Alice';
  assert (select count(*) from public.external_lane_display_states)=0, 'pairings may not reserve live scoring sessions';
  count_messages := (select count(*) from realtime.messages);
  perform public.apply_showdart_lane_pairing(1,owner,1,pairing);
  perform public.apply_showdart_lane_pairing(1,owner,2,pairing);
  assert (select count(*) from realtime.messages)=count_messages, 'identical announcements must not broadcast';
  result := public.apply_showdart_lane_pairing(2,owner,3,jsonb_set(pairing,'{laneNumber}','2'));
  assert result->>'status'='403', 'pilot must not enable another lane';

  update public.screen_devices set last_seen_at=clock_timestamp() where lane_number=1;
  result := public.apply_showdart_lane_display('claim',1,game,owner,1,board);
  assert result->>'ok'='true';
  next_pairing := jsonb_set(jsonb_set(pairing,'{showdartPairing,names}','["Carla","Dan"]'),'{title}','"Carla · Dan"');
  perform public.apply_showdart_lane_pairing(1,owner,4,next_pairing);
  assert (select state_mode='mickey' from public.kamptavle_lane_display_v2_states where lane_number=1), 'announcement cannot replace live game';
  result := public.apply_showdart_lane_display('result',1,game,owner,2,board || '{"stage":"approved","placements":["a","b"]}', 'approved',clock_timestamp());
  assert result->>'ok'='true';
  perform public.apply_showdart_lane_pairing(1,owner,5,pairing);
  assert (select state_json->>'stage'='approved' from public.kamptavle_lane_display_v2_states where lane_number=1), 'result hold retains priority';
  update public.external_lane_display_states set expires_at=clock_timestamp()-interval '1 second' where lane_number=1;
  update public.kamptavle_lane_display_v2_states set state_json=jsonb_set(state_json,'{leaseExpiresAt}',to_jsonb((clock_timestamp()-interval '1 second')::text)) where lane_number=1;
  assert public.get_kamptavle_lane_display_v2_snapshot(1)#>>'{state,showdartPairing,names,0}'='Alice', 'result expiry must restore the saved pairing';
  perform public.apply_showdart_lane_pairing(1,owner,4,next_pairing);
  assert (select payload_json->>'title'='Alice · Bob' from public.showdart_lane_pairings where lane_number=1), 'late update cannot replace newer pairing';
  perform public.apply_showdart_lane_pairing(1,other_owner,6,null);
  assert (select payload_json is not null from public.showdart_lane_pairings where lane_number=1), 'another organizer cannot clear this pairing';
  perform public.apply_showdart_lane_pairing(1,owner,7,null);
  assert (select state_mode='idle' from public.kamptavle_lane_display_v2_states where lane_number=1), 'unpublication must clear pairing';
  perform public.apply_showdart_lane_pairing(1,owner,6,pairing);
  assert (select payload_json is null from public.showdart_lane_pairings where lane_number=1), 'clear tombstone must reject late delivery';
  perform public.apply_showdart_lane_pairing(1,owner,8,pairing);
  insert into public.kamptavle_tournaments values('native',2);
  insert into public.kamptavle_display_config values('club',true,'native');
  perform public.refresh_kamptavle_lane_display_v2_state(1,false);
  assert (select state_json->>'title'='Native tournament' from public.kamptavle_lane_display_v2_states where lane_number=1), 'native tournament keeps priority';
  update public.kamptavle_display_config set enabled=false;
  perform public.set_showdart_lane_enabled(1,false);
  assert (select state_mode='idle' from public.kamptavle_lane_display_v2_states where lane_number=1), 'disable hides pairings';
  perform public.set_showdart_lane_enabled(1,true);
  assert (select state_json->>'title'='Alice · Bob' from public.kamptavle_lane_display_v2_states where lane_number=1), 'reenable recovers persisted pairing';
  assert public.make_kamptavle_lane_display_v2_patch(pairing,next_pairing) is null, 'pairing transitions must use complete snapshots';
  assert not has_function_privilege('anon','public.apply_showdart_lane_pairing(integer,uuid,bigint,jsonb)','execute');
  assert not has_function_privilege('authenticated','public.apply_showdart_lane_pairing(integer,uuid,bigint,jsonb)','execute');
  assert not has_table_privilege('anon','public.showdart_lane_pairings','select');

  -- State, result outbox, and current announcements commit together.
  expected := '{"showdart-default":null,"showdart-championship":null}';
  result := public.save_showdart_state_with_announcements(owner,'showdart-default',expected,'{"roundPublished":false}','[]');
  assert result->>'ok'='true';
  assert (select count(*) from public.showdart_lane_announcements)=0;
  saved_at := (result->>'updatedAt')::timestamptz;
  expected := jsonb_build_object('showdart-default',saved_at,'showdart-championship',null);
  result := public.save_showdart_state_with_announcements(owner,'showdart-default',expected,'{"roundPublished":true}',jsonb_build_array(jsonb_build_object('lane',1,'board',pairing)));
  assert result->>'ok'='true';
  saved_at := (result->>'updatedAt')::timestamptz;
  select revision into projection_revision from public.showdart_lane_announcements where user_id=owner and lane_number=1;
  result := public.save_showdart_state_with_announcements(owner,'showdart-default',expected,'{"stale":true}','[]');
  assert result->>'ok'='false', 'CAS must reject stale source versions';
  select attempts into attempt from public.claim_showdart_lane_announcements(owner);
  assert attempt=1;
  assert not exists(select 1 from public.claim_showdart_lane_announcements(owner)), 'two workers may not claim the same delivery';
  expected := jsonb_build_object('showdart-default',saved_at,'showdart-championship',null);
  result := public.save_showdart_state_with_announcements(owner,'showdart-default',expected,'{"roundPublished":true,"ui":"changed"}',jsonb_build_array(jsonb_build_object('lane',1,'board',pairing)));
  saved_at := (result->>'updatedAt')::timestamptz;
  assert (select revision=projection_revision from public.showdart_lane_announcements where user_id=owner and lane_number=1), 'unrelated saves must not queue another update';
  expected := jsonb_build_object('showdart-default',saved_at,'showdart-championship',null);
  result := public.save_showdart_state_with_announcements(owner,'showdart-default',expected,'{"winner":1}',jsonb_build_array(jsonb_build_object('lane',1,'board',next_pairing)),'result-atomic','{"action":"result"}');
  assert result->>'ok'='true';
  saved_at := (result->>'updatedAt')::timestamptz;
  select revision into new_revision from public.showdart_lane_announcements where user_id=owner and lane_number=1;
  assert new_revision>projection_revision;
  assert (select count(*) from public.showdart_display_outbox where event_id='result-atomic')=1;
  perform public.finish_showdart_lane_announcement(owner,1,projection_revision,attempt,true);
  assert (select delivered_at is null from public.showdart_lane_announcements where user_id=owner and lane_number=1), 'old acknowledgments cannot consume a newer pairing';
  select attempts into attempt from public.claim_showdart_lane_announcements(owner);
  perform public.finish_showdart_lane_announcement(owner,1,new_revision,attempt,false);
  assert (select delivered_at is null and next_attempt_at>clock_timestamp() from public.showdart_lane_announcements where user_id=owner and lane_number=1), 'failed delivery retains backoff';
  perform public.finish_showdart_lane_announcement(owner,1,new_revision,attempt,true);
  assert (select delivered_at is not null from public.showdart_lane_announcements where user_id=owner and lane_number=1);
  expected := jsonb_build_object('showdart-default',saved_at,'showdart-championship',null);
  begin
    perform public.save_showdart_state_with_announcements(owner,'showdart-default',expected,'{"winner":2}',jsonb_build_array(jsonb_build_object('lane',1,'board',jsonb_build_object('huge',repeat('x',8193)))));
    raise exception 'Expected invalid projection to roll back';
  exception when check_violation then null;
  end;
  assert (select state_json->>'winner'='1' from public.tournament_states where user_id=owner and tournament_key='showdart-default'), 'projection failure must roll back state';
  result := public.save_showdart_state_with_announcements(owner,'showdart-default',expected,'{"roundPublished":false}','[{"lane":1,"board":null}]');
  assert (select payload_json is null and delivered_at is null from public.showdart_lane_announcements where user_id=owner and lane_number=1), 'clears must also be durable';
  assert (select count(*) from public.showdart_lane_announcements where user_id=owner)=1, 'current queue must remain bounded';
  assert not has_function_privilege('authenticated','public.save_showdart_state_with_announcements(uuid,text,jsonb,jsonb,jsonb,text,jsonb)','execute');
  assert not has_table_privilege('authenticated','public.showdart_lane_announcements','select');
end;
$$;
select 'Publication, live priority, result hold, stale messages, CAS, durable retry, rollback and permissions passed' as result;
