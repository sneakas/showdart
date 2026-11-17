-- Run on an isolated database after laneDisplay.schema.sql and the registration migration.
begin;

do $$
declare
  organizer constant uuid := '018e9b30-0000-7000-8000-000000000001';
  other_organizer constant uuid := '018e9b30-0000-7000-8000-000000000002';
  first_entry constant uuid := '018e9b30-0000-7000-8000-000000000003';
  second_entry constant uuid := '018e9b30-0000-7000-8000-000000000004';
  third_entry constant uuid := '018e9b30-0000-7000-8000-000000000005';
  link uuid;
  registration jsonb;
  roster jsonb := '{"competitionInstanceId":"test","players":[{"id":1,"name":"Maja Øster"}]}'::jsonb;
  next_roster jsonb;
  roster_time timestamptz := clock_timestamp();
begin
  insert into auth.users(id) values (organizer), (other_organizer);
  insert into public.tournament_states values (organizer, 'showdart-default', roster, roster_time);

  assert public.showdart_manage_registration(organizer,'open',null,null,null,null,null,null)->>'code' = 'ok';
  registration := public.showdart_registration_snapshot(organizer);
  link := (registration->>'id')::uuid;
  assert public.showdart_register_player(link,null,null)->>'code' = 'ok';
  begin
    update public.tournament_states set state_json = roster || '{"started":true}' where user_id = organizer;
    raise exception 'An open registration must prevent a concurrent tournament start';
  exception when check_violation then
    assert sqlerrm = 'ShowDart registration is open';
  end;
  assert public.showdart_manage_registration(other_organizer,'remove',link,first_entry,null,null,null,null)->>'code' = 'changed';
  assert public.showdart_register_player(link,second_entry,' MAJA   ØSTER ')->>'code' = 'duplicate';

  assert public.showdart_register_player(link,first_entry,'Søren Lund')->>'code' = 'ok';
  assert public.showdart_register_player(link,first_entry,'Søren Lund')->>'code' = 'ok';
  assert public.showdart_register_player(link,second_entry,'  SØREN   LUND  ')->>'code' = 'duplicate';
  assert public.showdart_register_player(link,second_entry,'S.L.')->>'code' = 'ok';
  assert public.showdart_manage_registration(organizer,'rename',link,second_entry,'Søren Lund',null,null,null)->>'code' = 'duplicate';

  assert public.showdart_register_player(link,third_entry,U&'A\030Ase')->>'code' = 'ok';
  assert public.showdart_manage_registration(organizer,'rename',link,second_entry,'Åse',null,null,null)->>'code' = 'duplicate';
  assert public.showdart_manage_registration(organizer,'remove',link,third_entry,null,null,null,null)->>'code' = 'ok';
  assert public.showdart_register_player(link,third_entry,U&'A\030Ase')->>'code' = 'ok';
  assert public.showdart_manage_registration(organizer,'rename',link,second_entry,'Åse',null,null,null)->>'code' = 'ok';

  registration := public.showdart_registration_snapshot(organizer);
  assert jsonb_array_length(registration->'entries') = 2;
  assert registration->'entries'->1->>'name' = 'Åse';
  next_roster := jsonb_set(roster, '{players}', (roster->'players') || '[{"id":2,"name":"Søren Lund"},{"id":3,"name":"Åse"}]')
    || jsonb_build_object('registrationImportId', link);
  assert public.showdart_manage_registration(organizer,'transfer',link,null,null,0,roster_time,next_roster)->>'code' = 'changed';
  assert public.showdart_manage_registration(organizer,'transfer',link,null,null,(registration->>'revision')::int,
    roster_time - interval '1 second',next_roster)->>'code' = 'changed';
  assert public.showdart_manage_registration(organizer,'transfer',link,null,null,(registration->>'revision')::int,
    roster_time,next_roster)->>'code' = 'ok';
  assert public.showdart_manage_registration(organizer,'transfer',link,null,null,0,null,null)->'state' = next_roster;
  assert public.showdart_register_player(link,null,null)->>'code' = 'closed';
  assert public.showdart_register_player(link,third_entry,'Emil')->>'code' = 'closed';
  assert public.showdart_registration_snapshot(organizer)->'entries' = '[]'::jsonb;

  update public.tournament_states set state_json = next_roster || '{"started":true}' where user_id = organizer;
  assert public.showdart_manage_registration(organizer,'open',null,null,null,null,null,null)->>'code' = 'unavailable';
  update public.tournament_states set state_json = next_roster || '{"teammateMode":"fixed"}' where user_id = organizer;
  assert public.showdart_manage_registration(organizer,'open',null,null,null,null,null,null)->>'code' = 'unavailable';
  update public.tournament_states set state_json = '{"competitionInstanceId":"next","players":[]}' where user_id = organizer;
  assert public.showdart_manage_registration(organizer,'open',null,null,null,null,null,null)->>'code' = 'ok';
  assert (public.showdart_registration_snapshot(organizer)->>'id')::uuid <> link;
  assert public.showdart_register_player(link,null,null)->>'code' = 'missing';

  assert not has_table_privilege('anon','public.showdart_registration_entries','SELECT');
  assert not has_table_privilege('authenticated','public.showdart_registration_entries','INSERT');
  assert not has_function_privilege('anon','public.showdart_register_player(uuid,uuid,text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.showdart_registration_snapshot(uuid)','EXECUTE');
  assert has_function_privilege('service_role','public.showdart_register_player(uuid,uuid,text)','EXECUTE');
end;
$$;

rollback;
