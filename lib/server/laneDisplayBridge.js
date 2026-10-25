import { createHmac, timingSafeEqual } from 'node:crypto';

export function bridgeConfig(env = process.env) {
  const allowedUsers = new Set((env.LANE_SCREEN_ALLOWED_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean));
  const lanes = (env.LANE_SCREEN_LANES || '').split(',').map(Number).filter(lane => Number.isInteger(lane) && lane >= 1 && lane <= 64);
  const secret = env.LANE_SCREEN_BRIDGE_SECRET || '';
  let url = null;
  try {
    const parsed = new URL(env.LANE_SCREEN_PLAYGROUND_URL);
    if (parsed.protocol === 'https:' || (env.NODE_ENV !== 'production' && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) url = new URL('/api/integrations/showdart/lane-display', parsed).toString();
  } catch { /* Disabled until explicitly configured. */ }
  return { secret, url, allowedUsers, lanes, enabled: Boolean(url && secret.length >= 32 && allowedUsers.size && lanes.length) };
}

export function constantEqual(left, right) {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function sign(text, secret) {
  return createHmac('sha256', secret).update(text).digest('hex');
}

export function createLaneDisplayGrant(input, config = bridgeConfig(), now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...input, expiresAt: now + 12 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(`grant:${payload}`, config.secret)}`;
}

export function readLaneDisplayGrant(token, config = bridgeConfig(), now = Date.now()) {
  if (!config.enabled || typeof token !== 'string' || token.length > 2500) throw new Error('Baneskærmen er ikke konfigureret.');
  const [payload, signature, extra] = token.split('.');
  if (extra || !constantEqual(signature, sign(`grant:${payload}`, config.secret))) throw new Error('Ugyldig skærmadgang.');
  const grant = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!Number.isFinite(grant.expiresAt) || grant.expiresAt <= now || !config.allowedUsers.has(grant.userId) || !config.lanes.includes(grant.lane)
    || typeof grant.sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(grant.sessionId)) throw new Error('Skærmadgangen er udløbet eller tilbagekaldt.');
  return grant;
}

export async function sendLaneDisplayMessage(message, { config = bridgeConfig(), fetchImpl = fetch, now = Date.now() } = {}) {
  if (!config.enabled) throw new Error('Baneskærmen er ikke konfigureret.');
  const body = JSON.stringify(message);
  const timestamp = String(now);
  const response = await fetchImpl(config.url, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', 'x-showdart-timestamp': timestamp, 'x-showdart-signature': sign(`${timestamp}.${body}`, config.secret) },
    body
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Baneskærmen svarer ikke.');
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function deliverLaneDisplayOutbox(serviceClient, eventId = null) {
  const { data: jobs, error } = await serviceClient.rpc('claim_showdart_display_deliveries', { target_event_id: eventId });
  if (error) throw error;
  let delivered = 0;
  // Bounded batch; final results are low-frequency and durable. No score queue.
  for (const job of jobs || []) {
    try {
      await sendLaneDisplayMessage(job.payload_json);
      const { error: ackError } = await serviceClient.rpc('finish_showdart_display_delivery', { target_event_id: job.event_id, target_attempt: job.attempts, was_delivered: true });
      if (ackError) throw ackError;
      delivered += 1;
    } catch {
      await serviceClient.rpc('finish_showdart_display_delivery', { target_event_id: job.event_id, target_attempt: job.attempts, was_delivered: false });
    }
  }
  return { delivered, attempted: jobs?.length || 0 };
}
