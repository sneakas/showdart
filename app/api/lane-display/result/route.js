import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/server/supabaseServer';
import { readLaneDisplayGrant, deliverLaneDisplayOutbox } from '../../../../lib/server/laneDisplayBridge';
import { approveLaneDisplayBoard } from '../../../../lib/laneDisplay';
import { readJsonBody } from '../../../../lib/server/requestBody';

// Free-play has no tournament row. Persist its approved projection before closing.
export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  try {
    const input = await readJsonBody(request);
    let grant;
    try { grant = readLaneDisplayGrant(input?.display?.token); }
    catch { return NextResponse.json({ ok: true, screenDelivery: 'unavailable' }); }
    if (grant.userId !== auth.user.id || grant.binding) return NextResponse.json({ error: 'Skærmen tilhører en anden kamp.' }, { status: 403 });
    if (!Number.isSafeInteger(input.display.revision) || input.display.revision < 1) throw new Error('Ugyldig skærmversion.');
    const delivery = { action: 'result', lane: grant.lane, sessionId: grant.sessionId, ownerId: auth.user.id,
      revision: input.display.revision, eventId: `${grant.sessionId}:approved`, approvedAt: new Date().toISOString(),
      board: approveLaneDisplayBoard(input.display.board, input.gameResult, false) };
    const { error } = await auth.serviceClient.from('showdart_display_outbox').upsert({ event_id: delivery.eventId, user_id: auth.user.id, payload_json: delivery }, { onConflict: 'event_id', ignoreDuplicates: true });
    if (error) throw error;
    let delivered = false;
    try { delivered = (await deliverLaneDisplayOutbox(auth.serviceClient, delivery.eventId)).delivered > 0; } catch { /* Scheduled retry. */ }
    return NextResponse.json({ ok: true, screenDelivery: delivered ? 'delivered' : 'queued' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Resultatet kunne ikke gemmes.' }, { status: 400 });
  }
}
