import { NextResponse } from 'next/server';
import { getConfigError, getServiceClient } from '../../../../lib/server/supabaseServer';
import { getSpectatorRealtimeChannel, parseSpectatorToken } from '../../../../lib/server/tournamentSpectator';

export async function GET(request) {
  const configError = getConfigError();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing spectator token' }, { status: 400 });
  }

  let tournamentRef;
  try {
    tournamentRef = parseSpectatorToken(token);
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid spectator token' }, { status: 401 });
  }

  try {
    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient
      .from('tournament_states')
      .select('tournament_key, state_json, updated_at')
      .eq('user_id', tournamentRef.userId)
      .eq('tournament_key', tournamentRef.tournamentKey)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to load spectator state', detail: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        tournamentId: tournamentRef.tournamentKey,
        realtimeChannel: getSpectatorRealtimeChannel(tournamentRef),
        state: data?.state_json || null,
        updatedAt: data?.updated_at || null
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load spectator state', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
