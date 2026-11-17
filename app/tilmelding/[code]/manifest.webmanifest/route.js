import { isRegistrationId } from '../../../../lib/playerRegistration.js';
import showdartManifest from '../../../manifest.js';

export async function GET(_request, { params }) {
  const { code } = await params;
  if (!isRegistrationId(code)) return new Response(null, { status: 404 });
  const url = `/tilmelding/${code}`;
  return Response.json({
    ...showdartManifest(),
    id: url,
    start_url: url,
    scope: '/tilmelding/',
    name: 'Showdart spillertilmelding',
    short_name: 'Tilmelding',
    description: 'Spillertilmelding til en Showdart-turnering.',
    orientation: 'any'
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } });
}
