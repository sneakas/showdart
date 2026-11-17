create function public.showdart_registration_status(target_session uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select case
      when session.imported
        or not public.showdart_registration_accepts(tournament.state_json, session.competition_instance)
      then jsonb_build_object('code', 'closed')
      else jsonb_build_object('code', 'ok', 'tournamentName', tournament.state_json->>'tournamentName')
    end
    from public.showdart_registration_sessions session
    left join public.tournament_states tournament
      on tournament.user_id = session.user_id and tournament.tournament_key = 'showdart-default'
    where session.id = target_session
  ), jsonb_build_object('code', 'missing'));
$$;

revoke all on function public.showdart_registration_status(uuid) from public, anon, authenticated;
grant execute on function public.showdart_registration_status(uuid) to service_role;
