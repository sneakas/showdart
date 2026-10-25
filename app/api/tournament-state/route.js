import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/server/supabaseServer';
import { COMPETITION_KEYS } from '../../../lib/laneMatch';
import { readCompetitionStates, saveStateWithAnnouncements, deliverLaneAnnouncements } from '../../../lib/server/laneAnnouncements';

export const maxDuration = 60;

export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const tournamentKey = request.nextUrl.searchParams.get('id') || 'showdart-default';

  try {
    const { data, error } = await auth.serviceClient
      .from('tournament_states')
      .select('tournament_key, state_json, updated_at')
      .eq('user_id', auth.user.id)
      .eq('tournament_key', tournamentKey)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to load tournament state', detail: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        tournamentId: data.tournament_key,
        state: data.state_json,
        updatedAt: data.updated_at
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load tournament state', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const tournamentKey = payload?.id || 'showdart-default';
    const state = payload?.state;

    if (!tournamentKey || typeof tournamentKey !== 'string') {
      return NextResponse.json({ error: 'Invalid body: id is required' }, { status: 400 });
    }

    if (!state || typeof state !== 'object') {
      return NextResponse.json({ error: 'Invalid body: state object is required' }, { status: 400 });
    }

    if (COMPETITION_KEYS.includes(tournamentKey)) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const rows = await readCompetitionStates(auth.serviceClient, auth.user.id);
        const saved = await saveStateWithAnnouncements(auth.serviceClient, auth.user.id, tournamentKey, state, rows);
        if (!saved?.ok) continue;
        let screenDelivery = 'queued';
        try {
          const result = await deliverLaneAnnouncements(auth.serviceClient, auth.user.id);
          screenDelivery = result.delivered === result.attempted ? 'delivered' : 'queued';
        } catch { /* Saving the round and its durable screen projection succeeded. */ }
        return NextResponse.json({ ok: true, tournamentId: tournamentKey, updatedAt: saved.updatedAt, screenDelivery });
      }
      return NextResponse.json({ error: 'Turneringen blev ændret samtidig. Prøv igen.' }, { status: 409 });
    }

    const now = new Date().toISOString();

    const { error } = await auth.serviceClient.from('tournament_states').upsert(
      {
        user_id: auth.user.id,
        tournament_key: tournamentKey,
        state_json: state,
        updated_at: now
      },
      { onConflict: 'user_id,tournament_key' }
    );

    if (error) {
      return NextResponse.json({ error: 'Failed to save tournament state', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tournamentId: tournamentKey, updatedAt: now }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save tournament state', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
