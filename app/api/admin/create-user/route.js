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
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  return authHeader.slice(7).trim();
}

async function requireAdmin(request) {
  const configError = validateConfig();
  if (configError) {
    return { error: NextResponse.json({ error: configError }, { status: 500 }) };
  }

  const token = getBearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: 'Missing bearer token' }, { status: 401 }) };
  }

  const anonClient = getAnonClient();
  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return { error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) };
  }

  const serviceClient = getServiceClient();
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: NextResponse.json({ error: 'Failed to verify admin role', detail: profileError.message }, { status: 500 }) };
  }

  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  return { adminUser: userData.user, serviceClient };
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const payload = await request.json();
    const email = (payload?.email || '').trim().toLowerCase();
    const password = payload?.password || '';
    const displayName = (payload?.displayName || '').trim();
    const requestedRole = payload?.role === 'admin' ? 'admin' : 'user';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const { data: created, error: createError } = await auth.serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName
      }
    });

    if (createError || !created?.user) {
      return NextResponse.json(
        { error: 'Failed to create account', detail: createError?.message || 'Unknown error' },
        { status: 500 }
      );
    }

    const { error: profileUpsertError } = await auth.serviceClient.from('profiles').upsert(
      {
        id: created.user.id,
        email,
        display_name: displayName,
        role: requestedRole
      },
      { onConflict: 'id' }
    );

    if (profileUpsertError) {
      return NextResponse.json(
        { error: 'User created, but failed to set profile role', detail: profileUpsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: created.user.id,
          email,
          role: requestedRole
        }
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create account', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
