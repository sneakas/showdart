import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/server/supabaseServer';
import { createSpectatorToken, getSpectatorRealtimeChannel } from '../../../lib/server/tournamentSpectator';

export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const tournamentKey = request.nextUrl.searchParams.get('id') || 'showdart-default';
  if (!tournamentKey || typeof tournamentKey !== 'string') {
    return NextResponse.json({ error: 'Tournament id is required' }, { status: 400 });
  }

  const token = createSpectatorToken({
    userId: auth.user.id,
    tournamentKey
  });
  const screenRoute = tournamentKey === 'showdart-championship' ? 'championship-screen' : 'screen';

  return NextResponse.json(
    {
      tournamentId: tournamentKey,
      token,
      realtimeChannel: getSpectatorRealtimeChannel({
        userId: auth.user.id,
        tournamentKey
      }),
      screenUrl: `${request.nextUrl.origin}/${screenRoute}/${encodeURIComponent(token)}`
    },
    { status: 200 }
  );
}
