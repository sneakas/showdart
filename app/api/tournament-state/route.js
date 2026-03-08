import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function validateConfig() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return 'Missing NEXT_PUBLIC_SUPABASE_URL';
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 'Missing SUPABASE_SERVICE_ROLE_KEY';
  return null;
}

function getAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getBearerToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

async function requireUser(request) {
  const configError = validateConfig();
  if (configError) {
    return { error: NextResponse.json({ error: configError }, { status: 500 }) };
  }

  const token = getBearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: 'Missing bearer token' }, { status: 401 }) };
  }

  const anonClient = getAnonClient();
  const { data, error } = await anonClient.auth.getUser(token);

  if (error || !data?.user) {
    return { error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) };
  }

  return { user: data.user, serviceClient: getServiceClient() };
}

export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) {
    return auth.error;
  }

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
  if (auth.error) {
    return auth.error;
  }

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

    const now = new Date().toISOString();

    const { error } = await auth.serviceClient.from('tournament_states').upsert(
      {
        user_id: auth.user.id,
        tournament_key: tournamentKey,
        state_json: state,
        updated_at: now
      },
      {
        onConflict: 'user_id,tournament_key'
      }
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
