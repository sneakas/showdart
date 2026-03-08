import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/server/supabaseServer';

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
