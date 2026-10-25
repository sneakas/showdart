import { NextResponse } from 'next/server';
import { getServiceClient, getConfigError } from '../../../../lib/server/supabaseServer';
import { bridgeConfig, constantEqual, deliverLaneDisplayOutbox } from '../../../../lib/server/laneDisplayBridge';
import { deliverLaneAnnouncements } from '../../../../lib/server/laneAnnouncements';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request) {
  if (!process.env.CRON_SECRET || !constantEqual(request.headers.get('authorization'), `Bearer ${process.env.CRON_SECRET}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getConfigError() || !bridgeConfig().enabled) return NextResponse.json({ error: 'Screen bridge is not configured' }, { status: 503 });
  try {
    const service = getServiceClient();
    const results = await deliverLaneDisplayOutbox(service);
    const announcements = await deliverLaneAnnouncements(service);
    return NextResponse.json({ ...results, announcements }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not retry screen delivery' }, { status: 500 });
  }
}
