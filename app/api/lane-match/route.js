import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/server/supabaseServer';
import { getSpectatorRealtimeChannel } from '../../../lib/server/tournamentSpectator';
import { approveLaneDisplayBoard } from '../../../lib/laneDisplay';
import { readLaneDisplayGrant, deliverLaneDisplayOutbox } from '../../../lib/server/laneDisplayBridge';
import { readCompetitionStates, saveStateWithAnnouncements, deliverLaneAnnouncements } from '../../../lib/server/laneAnnouncements';

export const maxDuration = 60;
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
  return NextResponse.json({ ...buildLaneMatchSnapshot(toStateMap(data), lane), realtimeChannels: COMPETITION_KEYS.map(tournamentKey => getSpectatorRealtimeChannel({ userId: auth.user.id, tournamentKey })) }, { status: 200 });
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

    let delivery = null;
    let displayUnavailable = false;
    let displayBinding = null;
    if (payload?.display?.token) {
      try {
        const grant = readLaneDisplayGrant(payload.display.token);
        if (grant.userId !== auth.user.id || grant.lane !== Number(payload.lane)
          || grant.binding?.competitionKey !== competitionKey || grant.binding?.matchId !== Number(payload.matchId)) {
          throw new LaneMatchError('Skærmen er koblet til en anden kamp.', 'display_mismatch', 403);
        }
        if (!Number.isSafeInteger(payload.display.revision) || payload.display.revision < 1) throw new LaneMatchError('Ugyldig skærmversion.', 'invalid_display_revision');
        const board = approveLaneDisplayBoard(payload.display.board, payload.gameResult, payload?.resultType === 'final');
        delivery = {
          action: 'result', lane: grant.lane, ownerId: auth.user.id, sessionId: grant.sessionId,
          revision: payload.display.revision, eventId: `${grant.sessionId}:approved`, approvedAt: new Date().toISOString(), board
        };
        displayBinding = grant.binding;
      } catch {
        // Screen credentials may expire or be revoked independently of scoring.
        // The authenticated, validated tournament result must still be saved.
        displayUnavailable = true;
      }
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const rows = await readCompetitionStates(auth.serviceClient, auth.user.id);
      const row = rows.find(item => item.tournament_key === competitionKey);
      if (!row) throw new LaneMatchError('Turneringen blev ikke fundet.', 'competition_not_found', 404);
      if (typeof payload.competitionInstanceId === 'string' && payload.competitionInstanceId !== (row.state_json?.competitionInstanceId || 'legacy')) {
        throw new LaneMatchError('Turneringen er startet forfra. Kampresultatet blev ikke ændret.', 'competition_changed', 409);
      }
      if (delivery) {
        if ((row.state_json?.competitionInstanceId || 'legacy') !== displayBinding.instanceId) {
          throw new LaneMatchError('Turneringen er startet forfra. Kampresultatet blev ikke ændret.', 'competition_changed', 409);
        }
      }

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
      const save = await saveStateWithAnnouncements(auth.serviceClient, auth.user.id, competitionKey, nextState, rows, delivery);
      if (!save?.ok) continue;
      const now = save.updatedAt;

      // Never turn a successful result commit into a failed result submission.
      let displayDelivered = false;
      if (delivery) {
        try { displayDelivered = (await deliverLaneDisplayOutbox(auth.serviceClient, delivery.eventId)).delivered > 0; }
        catch { /* Durable outbox is retried by the scheduled endpoint. */ }
      }
      try { await deliverLaneAnnouncements(auth.serviceClient, auth.user.id); }
      catch { /* Scheduled delivery also advances the next published pairing. */ }

      await broadcastState(auth.serviceClient, auth.user.id, competitionKey, nextState, now);
      const snapshot = buildLaneMatchSnapshot({ [competitionKey]: nextState }, payload?.lane);
      return NextResponse.json({ ok: true, state: nextState, next: snapshot, updatedAt: now, screenDelivery: delivery ? (displayDelivered ? 'delivered' : 'queued') : displayUnavailable ? 'unavailable' : null }, { status: 200 });
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
    await serviceClient.removeChannel(channel).catch(() => {});
  }
}
