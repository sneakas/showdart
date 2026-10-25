import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser, getServiceClient } from '../../../lib/server/supabaseServer';
import { bridgeConfig, createLaneDisplayGrant, readLaneDisplayGrant, sendLaneDisplayMessage } from '../../../lib/server/laneDisplayBridge';
import { parseLaneDisplayBoard } from '../../../lib/laneDisplay';
import { COMPETITION_KEYS, buildLaneMatchSnapshot } from '../../../lib/laneMatch';
import { readJsonBody } from '../../../lib/server/requestBody';

export const runtime = 'nodejs';

export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const config = bridgeConfig();
  return NextResponse.json({ enabled: config.enabled && config.allowedUsers.has(auth.user.id), lanes: config.allowedUsers.has(auth.user.id) ? config.lanes : [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  try {
    const input = await readJsonBody(request);
    const config = bridgeConfig();
    if (!config.enabled) return NextResponse.json({ error: 'Baneskærmen er ikke konfigureret.' }, { status: 503 });
    if (input.action === 'claim') {
      const auth = await requireUser(request);
      if (auth.error) return auth.error;
      if (!config.allowedUsers.has(auth.user.id) || !config.lanes.includes(input.lane)) return NextResponse.json({ error: 'Du har ikke adgang til denne baneskærm.' }, { status: 403 });
      let binding = null;
      if (input.competitionKey != null) {
        if (!COMPETITION_KEYS.includes(input.competitionKey)) throw new Error('Ugyldig turnering.');
        const { data, error } = await auth.serviceClient.from('tournament_states').select('state_json').eq('user_id', auth.user.id).eq('tournament_key', input.competitionKey).maybeSingle();
        if (error) throw error;
        const snapshot = buildLaneMatchSnapshot({ [input.competitionKey]: data?.state_json }, input.lane);
        if (snapshot.match?.id !== input.matchId) return NextResponse.json({ error: 'Kampen er ikke længere klar på denne bane.' }, { status: 409 });
        if (snapshot.competition.instanceId !== (input.competitionInstanceId || 'legacy')) return NextResponse.json({ error: 'Turneringen er startet forfra. Vælg den aktuelle kamp igen.' }, { status: 409 });
        binding = { competitionKey: input.competitionKey, instanceId: snapshot.competition.instanceId, matchId: input.matchId };
      }
      const sessionId = typeof input.sessionId === 'string' && /^[0-9a-f-]{36}$/i.test(input.sessionId) ? input.sessionId : randomUUID();
      const board = parseLaneDisplayBoard(input.board);
      const result = await sendLaneDisplayMessage({ action: 'claim', lane: input.lane, sessionId, ownerId: auth.user.id, revision: input.revision, board });
      return NextResponse.json({ ...result, token: createLaneDisplayGrant({ userId: auth.user.id, lane: input.lane, sessionId, binding }, config), sessionId });
    }
    if (!['update', 'heartbeat', 'release'].includes(input.action)) throw new Error('Ugyldig skærmhandling.');
    const grant = readLaneDisplayGrant(input.token, config);
    if (input.action === 'heartbeat' && grant.binding) {
      // One small source-DB lookup per minute, never one per scoring click.
      const { data, error } = await getServiceClient().from('tournament_states').select('instanceId:state_json->>competitionInstanceId')
        .eq('user_id', grant.userId).eq('tournament_key', grant.binding.competitionKey).maybeSingle();
      if (error) throw error;
      if (!data || (data.instanceId || 'legacy') !== grant.binding.instanceId) {
        await sendLaneDisplayMessage({ action: 'release', lane: grant.lane, sessionId: grant.sessionId, ownerId: grant.userId, revision: input.revision }).catch(() => {});
        return NextResponse.json({ error: 'Turneringen er startet forfra. Vælg den aktuelle kamp igen.' }, { status: 409 });
      }
    }
    const result = await sendLaneDisplayMessage({
      action: input.action, lane: grant.lane, sessionId: grant.sessionId, ownerId: grant.userId,
      revision: input.revision, ...(input.action === 'update' ? { board: parseLaneDisplayBoard(input.board) } : {})
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Skærmopdateringen fejlede.' }, { status: Number.isInteger(error.status) ? error.status : 400 });
  }
}
