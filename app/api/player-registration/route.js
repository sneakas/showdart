import { getConfigError, getServiceClient } from '../../../lib/server/supabaseServer.js';
import { readJsonBody } from '../../../lib/server/requestBody.js';
import { registrationResponse } from '../../../lib/server/playerRegistration.js';
import { cleanRegistrationName, isRegistrationId, isRegistrationName } from '../../../lib/playerRegistration.js';

async function register(id, requestId = null, name = null) {
  if (!isRegistrationId(id)) return registrationResponse({ code: 'missing' });
  if (getConfigError()) return registrationResponse({ code: 'failed' });
  try {
    const { data, error } = await getServiceClient().rpc('showdart_register_player', {
      target_session: id, request_id: requestId, player_name: name
    });
    if (error) throw error;
    return registrationResponse(data);
  } catch (error) {
    console.error('ShowDart registration request failed', error.code || error.name);
    return registrationResponse({ code: 'failed' });
  }
}

export async function GET(request) {
  return register(request.nextUrl.searchParams.get('id'));
}

export async function POST(request) {
  let payload;
  try {
    payload = await readJsonBody(request, 1024);
  } catch {
    return registrationResponse({ code: 'invalid' });
  }
  if (!isRegistrationId(payload?.requestId)) return registrationResponse({ code: 'invalid' });
  const name = cleanRegistrationName(payload.name);
  if (!isRegistrationName(name)) return registrationResponse({ code: 'invalid_name' });
  return register(payload.id, payload.requestId, name);
}
