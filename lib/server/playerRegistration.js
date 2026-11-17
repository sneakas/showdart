import { NextResponse } from 'next/server';
import { addPlayer, normalizeTournamentState } from '../tournament/reactEngine.js';
import { TOURNAMENT_KEY } from '../laneMatch.js';

export function registrationResponse(result) {
  const status = {
    ok: 200, closed: 409, duplicate: 409, unavailable: 409, missing: 404,
    changed: 409, invalid_name: 400, invalid: 400, failed: 503
  }[result?.code] || 503;
  return NextResponse.json(result || { code: 'failed' }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function readRegistration(serviceClient, userId) {
  const { data, error } = await serviceClient.rpc('showdart_registration_snapshot', { owner_id: userId });
  if (error) throw error;
  return data;
}

export async function prepareRegistrationTransfer(serviceClient, userId, registration) {
  const { data, error } = await serviceClient.from('tournament_states')
    .select('state_json,updated_at').eq('user_id', userId).eq('tournament_key', TOURNAMENT_KEY).maybeSingle();
  if (error) throw error;
  const previous = normalizeTournamentState(data?.state_json);
  const next = registration.entries.reduce((state, entry) => addPlayer(state, entry.name), previous);
  return { state: { ...next, registrationImportId: registration.id }, updatedAt: data?.updated_at || null };
}
