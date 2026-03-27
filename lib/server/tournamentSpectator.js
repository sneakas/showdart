import crypto from 'crypto';

function getSpectatorSecret() {
  const secret = process.env.SPECTATOR_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('Missing SPECTATOR_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY');
  }
  return secret;
}

function encodePayload(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodePayload(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(encodedPayload) {
  return crypto.createHmac('sha256', getSpectatorSecret()).update(encodedPayload).digest('base64url');
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSpectatorToken({ userId, tournamentKey }) {
  const payload = encodePayload(
    JSON.stringify({
      v: 1,
      u: userId,
      t: tournamentKey
    })
  );

  return `${payload}.${signPayload(payload)}`;
}

export function parseSpectatorToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Invalid spectator token');
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    throw new Error('Invalid spectator token');
  }

  const expectedSignature = signPayload(payload);
  if (!safeCompare(signature, expectedSignature)) {
    throw new Error('Invalid spectator token');
  }

  const decoded = JSON.parse(decodePayload(payload));
  if (decoded?.v !== 1 || typeof decoded?.u !== 'string' || typeof decoded?.t !== 'string') {
    throw new Error('Invalid spectator token');
  }

  return {
    userId: decoded.u,
    tournamentKey: decoded.t
  };
}

export function getSpectatorRealtimeChannel({ userId, tournamentKey }) {
  const hash = crypto.createHash('sha256').update(`${userId}:${tournamentKey}`).digest('hex').slice(0, 32);
  return `showdart-screen-${hash}`;
}
