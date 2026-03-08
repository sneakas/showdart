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

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { data, error } = await auth.serviceClient
    .from('profiles')
    .select('id, email, display_name, role')
    .order('email', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load users', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] }, { status: 200 });
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const id = (payload?.id || '').trim();
    const displayName = (payload?.displayName || '').trim();
    const role = payload?.role === 'admin' ? 'admin' : 'user';

    if (!id) {
      return NextResponse.json({ error: 'User id is required' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await auth.serviceClient
      .from('profiles')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: 'Failed to load user', detail: existingError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { error: updateProfileError } = await auth.serviceClient
      .from('profiles')
      .update({ display_name: displayName, role })
      .eq('id', id);

    if (updateProfileError) {
      return NextResponse.json({ error: 'Failed to update user profile', detail: updateProfileError.message }, { status: 500 });
    }

    const { error: updateAuthError } = await auth.serviceClient.auth.admin.updateUserById(id, {
      user_metadata: { display_name: displayName }
    });

    if (updateAuthError) {
      return NextResponse.json({ error: 'Profile updated, but failed to sync auth metadata', detail: updateAuthError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: { id, email: existing.email, display_name: displayName, role } }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
