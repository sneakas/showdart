// Latest-state queue: one request in flight, a trailing update, bounded retries.
export function createLaneDisplayPublisher(send, { onStatus = () => {}, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, random = Math.random } = {}) {
  let latest = null;
  let sent = '';
  let inFlight = false;
  let stopped = false;
  let timer = null;
  let lastAttempt = -Infinity;
  let failures = 0;
  let revision = now();
  let retryAt = 0;
  const settlers = [];

  const schedule = () => {
    if (stopped || inFlight || timer !== null || !latest || latest.key === sent) return;
    timer = setTimer(() => { timer = null; void flush(); }, Math.max(0, 550 - (now() - lastAttempt), retryAt - now()));
  };
  const flush = async () => {
    if (stopped || inFlight || !latest || latest.key === sent) return;
    const pending = latest;
    inFlight = true;
    lastAttempt = now();
    revision = Math.max(revision + 1, now());
    try {
      await send(pending.board, revision);
      sent = pending.key;
      failures = 0;
      retryAt = 0;
      if (!stopped) onStatus({ status: 'live', error: '' });
    } catch (error) {
      failures += 1;
      retryAt = now() + Math.min(60_000, 1000 * 2 ** Math.min(failures, 6)) + Math.round(random() * 1000);
      if (!stopped) onStatus({ status: 'error', error: error.message, code: error.status });
      if ([401, 403, 409].includes(error.status)) stopped = true;
    } finally {
      lastAttempt = now();
      inFlight = false;
      settlers.splice(0).forEach(resolve => resolve());
      schedule();
    }
  };
  return {
    publish(board) { latest = { board, key: JSON.stringify(board) }; schedule(); },
    getRevision() { revision = Math.max(revision + 1, now()); return revision; },
    stop() { stopped = true; if (timer !== null) clearTimer(timer); },
    settled() { return inFlight ? new Promise(resolve => settlers.push(resolve)) : Promise.resolve(); }
  };
}
