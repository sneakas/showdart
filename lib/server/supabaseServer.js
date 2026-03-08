import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getConfigError() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return 'Missing NEXT_PUBLIC_SUPABASE_URL';
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 'Missing SUPABASE_SERVICE_ROLE_KEY';
  return null;
}

export function getBearerToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  return authHeader.slice(7).trim();
}

export function getAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function requireUser(request) {
  const configError = getConfigError();
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

export async function requireAdmin(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth;

  const { data: profile, error: profileError } = await auth.serviceClient
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      error: NextResponse.json(
        { error: 'Failed to verify admin role', detail: profileError.message },
        { status: 500 }
      )
    };
  }

  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  return { adminUser: auth.user, serviceClient: auth.serviceClient };
}
