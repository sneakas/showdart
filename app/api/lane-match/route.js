import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/server/supabaseServer';
import { getSpectatorRealtimeChannel } from '../../../lib/server/tournamentSpectator';
import {
  COMPETITION_KEYS,
  LaneMatchError,
  applyLaneFinalResult,
  applyLaneMatchResult,
  buildLaneMatchSnapshot
} from '../../../lib/laneMatch';

export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const lane = request.nextUrl.searchParams.get('lane');
  const { data, error } = await auth.serviceClient
    .from('tournament_states')
    .select('tournament_key, state_json')
    .eq('user_id', auth.user.id)
    .in('tournament_key', COMPETITION_KEYS);

  if (error) return NextResponse.json({ error: 'Kunne ikke hente banekampen.', detail: error.message }, { status: 500 });
  return NextResponse.json(buildLaneMatchSnapshot(toStateMap(data), lane), { status: 200 });
}

export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const competitionKey = String(payload?.competitionKey || '');
    if (!COMPETITION_KEYS.includes(competitionKey)) {
      throw new LaneMatchError('Den aktive turnering blev ikke fundet.', 'competition_not_found', 404);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data: row, error: readError } = await auth.serviceClient
        .from('tournament_states')
        .select('state_json, updated_at')
        .eq('user_id', auth.user.id)
        .eq('tournament_key', competitionKey)
        .maybeSingle();
      if (readError) throw readError;
      if (!row) throw new LaneMatchError('Turneringen blev ikke fundet.', 'competition_not_found', 404);

      const resultInput = {
        competitionKey,
        state: row.state_json,
        matchId: payload?.matchId,
        lane: payload?.lane,
        gameResult: payload?.gameResult
      };
      const nextState = payload?.resultType === 'final'
        ? applyLaneFinalResult({ ...resultInput, orderedPlayerIds: payload?.orderedPlayerIds })
        : applyLaneMatchResult({ ...resultInput, winnerIndex: payload?.winnerIndex });
      const now = new Date().toISOString();
      const { data: savedRows, error: saveError } = await auth.serviceClient
        .from('tournament_states')
        .update({ state_json: nextState, updated_at: now })
        .eq('user_id', auth.user.id)
        .eq('tournament_key', competitionKey)
        .eq('updated_at', row.updated_at)
        .select('tournament_key');
      if (saveError) throw saveError;
      if (!savedRows?.length) continue;

      await broadcastState(auth.serviceClient, auth.user.id, competitionKey, nextState, now);
      const snapshot = buildLaneMatchSnapshot({ [competitionKey]: nextState }, payload?.lane);
      return NextResponse.json({ ok: true, state: nextState, next: snapshot, updatedAt: now }, { status: 200 });
    }

    return NextResponse.json({ error: 'Turneringen blev ændret samtidig. Prøv igen.' }, { status: 409 });
  } catch (error) {
    if (error instanceof LaneMatchError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Kunne ikke gemme kampresultatet.', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

function toStateMap(rows) {
  return Object.fromEntries((rows || []).map(row => [row.tournament_key, row.state_json]));
}

async function broadcastState(serviceClient, userId, tournamentKey, state, updatedAt) {
  const channel = serviceClient.channel(getSpectatorRealtimeChannel({ userId, tournamentKey }));
  try {
    await channel.send({ type: 'broadcast', event: 'tournament-state', payload: { tournamentId: tournamentKey, state, updatedAt } });
  } catch {
    // Persistence is authoritative; connected screens can recover on reload.
  } finally {
    await serviceClient.removeChannel(channel);
  }
}
