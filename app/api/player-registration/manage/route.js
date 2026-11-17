import { requireUser } from '../../../../lib/server/supabaseServer.js';
import { readJsonBody } from '../../../../lib/server/requestBody.js';
import { prepareRegistrationTransfer, readRegistration, registrationResponse } from '../../../../lib/server/playerRegistration.js';
import { cleanRegistrationName, isRegistrationId, isRegistrationName } from '../../../../lib/playerRegistration.js';

export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  try {
    return registrationResponse({ code: 'ok', registration: await readRegistration(auth.serviceClient, auth.user.id) });
  } catch (error) {
    console.error('ShowDart registration list failed', error.code || error.name);
    return registrationResponse({ code: 'failed' });
  }
}

export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  let payload;
  try {
    payload = await readJsonBody(request, 1024);
  } catch {
    return registrationResponse({ code: 'invalid' });
  }
  const { action, id, entryId, revision } = payload || {};
  if (!['open', 'rename', 'remove', 'transfer'].includes(action) || (action !== 'open' && !isRegistrationId(id))) {
    return registrationResponse({ code: 'invalid' });
  }
  if (['rename', 'remove'].includes(action) && !isRegistrationId(entryId)) return registrationResponse({ code: 'invalid' });
  const name = cleanRegistrationName(payload.name);
  if (action === 'rename' && !isRegistrationName(name)) return registrationResponse({ code: 'invalid_name' });
  if (action === 'transfer' && !Number.isSafeInteger(revision)) return registrationResponse({ code: 'invalid' });

  const { serviceClient, user: { id: userId } } = auth;
  try {
    let transfer;
    if (action === 'transfer') {
      const registration = await readRegistration(serviceClient, userId);
      if (registration?.id !== id) return registrationResponse({ code: 'changed' });
      if (!registration.imported && registration.revision !== revision) {
        return registrationResponse({ code: 'changed', registration });
      }
      if (!registration.imported) transfer = await prepareRegistrationTransfer(serviceClient, userId, registration);
    }
    const { data, error } = await serviceClient.rpc('showdart_manage_registration', {
      owner_id: userId, operation: action, target_session: id ?? null,
      target_entry: entryId ?? null, player_name: name || null, expected_revision: revision ?? null,
      expected_state_time: transfer?.updatedAt ?? null, next_state: transfer?.state ?? null
    });
    if (error) throw error;
    if (data.code !== 'ok') return registrationResponse(data);
    const registration = await readRegistration(serviceClient, userId);
    return registrationResponse({ ...data, registration });
  } catch (error) {
    console.error('ShowDart registration update failed', error.code || error.name);
    return registrationResponse({ code: 'failed' });
  }
}
