import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/server/supabaseServer';

export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const { data: profile, error: profileError } = await auth.serviceClient
    .from('profiles')
    .select('id, email, role, display_name')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: 'Failed to load profile', detail: profileError.message }, { status: 500 });
  }

  if (!profile) {
    const fallbackEmail = (auth.user.email || '').toLowerCase();
    const displayName = auth.user.user_metadata?.display_name || '';

    const { error: upsertError } = await auth.serviceClient.from('profiles').upsert(
      {
        id: auth.user.id,
        email: fallbackEmail,
        display_name: displayName,
        role: 'user'
      },
      { onConflict: 'id' }
    );

    if (upsertError) {
      return NextResponse.json({ error: 'Failed to initialize profile', detail: upsertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: auth.user.id,
        email: fallbackEmail,
        role: 'user',
        display_name: displayName
      },
      { status: 200 }
    );
  }

  return NextResponse.json(profile, { status: 200 });
}
