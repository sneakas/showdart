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

export async function GET(request) {
  const configError = validateConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const anonClient = getAnonClient();
  const { data: userData, error: userError } = await anonClient.auth.getUser(token);

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const serviceClient = getServiceClient();

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id, email, role, display_name')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: 'Failed to load profile', detail: profileError.message }, { status: 500 });
  }

  if (!profile) {
    const fallbackEmail = (userData.user.email || '').toLowerCase();
    const { error: upsertError } = await serviceClient.from('profiles').upsert(
      {
        id: userData.user.id,
        email: fallbackEmail,
        display_name: userData.user.user_metadata?.display_name || '',
        role: 'user'
      },
      { onConflict: 'id' }
    );

    if (upsertError) {
      return NextResponse.json({ error: 'Failed to initialize profile', detail: upsertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: userData.user.id,
        email: fallbackEmail,
        role: 'user',
        display_name: userData.user.user_metadata?.display_name || ''
      },
      { status: 200 }
    );
  }

  return NextResponse.json(profile, { status: 200 });
}
