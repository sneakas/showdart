export async function readJsonBody(request, limit = 12000) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Tom forespørgsel.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        const error = new Error('Forespørgslen er for stor.');
        error.status = 413;
        throw error;
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}
