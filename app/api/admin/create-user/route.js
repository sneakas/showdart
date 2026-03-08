import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/server/supabaseServer';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

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
      user_metadata: { display_name: displayName }
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
