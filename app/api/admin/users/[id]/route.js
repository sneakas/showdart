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

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const id = (params?.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'User id is required' }, { status: 400 });
  }

  if (id === auth.adminUser.id) {
    return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 });
  }

  const { error: deleteAuthError } = await auth.serviceClient.auth.admin.deleteUser(id);
  if (deleteAuthError) {
    return NextResponse.json({ error: 'Failed to delete auth user', detail: deleteAuthError.message }, { status: 500 });
  }

  await auth.serviceClient.from('profiles').delete().eq('id', id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
