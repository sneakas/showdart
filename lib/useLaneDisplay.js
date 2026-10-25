'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createLaneDisplayPublisher } from './laneDisplayPublisher';

export function useLaneDisplay({ session, lane, board, linkedMatch, enabled }) {
  const [status, setStatus] = useState({ status: 'off', error: '' });
  const [generation, setGeneration] = useState(0);
  const connectionRef = useRef(null);
  const boardRef = useRef(board);
  const authRef = useRef(session);
  boardRef.current = board;
  authRef.current = session;
  const running = Boolean(board);
  const bindingKey = linkedMatch ? `${linkedMatch.competitionKey}:${linkedMatch.competitionInstanceId || 'legacy'}:${linkedMatch.matchId}` : 'free';

  useEffect(() => {
    if (!enabled || !session?.user?.id || !lane || !running) { setStatus({ status: 'off', error: '' }); return; }
    let cancelled = false;
    let heartbeatTimer = null;
    let token = null;
    let halted = false;
    const storageKey = `showdart-screen:${session.user.id}:${lane}:${bindingKey}`;
    let identity;
    try { identity = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { /* Fresh session. */ }
    if (!identity?.sessionId) identity = { sessionId: crypto.randomUUID() };
    sessionStorage.setItem(storageKey, JSON.stringify(identity));

    const request = async (payload) => {
      const response = await fetch('/api/lane-display', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authRef.current?.access_token || ''}` },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(8000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(data.error || 'Baneskærmen svarer ikke.'); error.status = response.status; throw error; }
      return data;
    };
    const publisher = createLaneDisplayPublisher(async (nextBoard, revision) => {
      if (!token) {
        const claimed = await request({ action: 'claim', lane, sessionId: identity.sessionId, revision, board: nextBoard,
          ...(linkedMatch ? { competitionKey: linkedMatch.competitionKey, competitionInstanceId: linkedMatch.competitionInstanceId || 'legacy', matchId: linkedMatch.matchId } : {}) });
        token = claimed.token;
      } else await request({ action: 'update', token, revision, board: nextBoard });
    }, { onStatus: next => { if ([401, 403, 409].includes(next.code)) halted = true; setStatus(next); } });
    const connection = { publisher, getToken: () => token };
    connectionRef.current = connection;
    setStatus({ status: 'connecting', error: '' });
    publisher.publish(boardRef.current);

    const heartbeat = async () => {
      if (cancelled || halted) return;
      if (token) {
        try { await request({ action: 'heartbeat', token, revision: publisher.getRevision() }); }
        catch (error) {
          if ([401, 403, 409].includes(error.status)) { publisher.stop(); halted = true; }
          if (!cancelled) setStatus({ status: 'error', error: error.message });
        }
      }
      if (!cancelled && !halted) heartbeatTimer = setTimeout(heartbeat, 55_000 + Math.round(Math.random() * 10_000));
    };
    heartbeatTimer = setTimeout(heartbeat, 55_000 + Math.round(Math.random() * 10_000));
    const resume = () => { if (heartbeatTimer !== null) clearTimeout(heartbeatTimer); if (boardRef.current) publisher.publish(boardRef.current); void heartbeat(); };
    window.addEventListener('online', resume);
    return () => {
      cancelled = true;
      publisher.stop();
      if (heartbeatTimer !== null) clearTimeout(heartbeatTimer);
      window.removeEventListener('online', resume);
      if (connectionRef.current === connection) connectionRef.current = null;
      // An ordinary page unload retains the session for reload recovery. An
      // explicit stop calls release below; a vanished tablet expires by lease.
    };
  // Board changes go into the queue without reconnecting the session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session?.user?.id, lane, running, bindingKey, generation]);

  useEffect(() => { if (board) connectionRef.current?.publisher.publish(board); }, [board]);

  const release = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection) return;
    connection.publisher.stop();
    await connection.publisher.settled();
    const token = connection.getToken();
    if (token) {
      await fetch('/api/lane-display', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release', token, revision: connection.publisher.getRevision() }), signal: AbortSignal.timeout(8000) }).catch(() => {});
    }
    if (session?.user?.id && lane) sessionStorage.removeItem(`showdart-screen:${session.user.id}:${lane}:${bindingKey}`);
  }, [session?.user?.id, lane, bindingKey]);

  const getResultDisplay = useCallback(async () => {
    const connection = connectionRef.current;
    if (connection) await connection.publisher.settled();
    const token = connection?.getToken();
    return token ? { token, revision: connection.publisher.getRevision(), board: boardRef.current } : null;
  }, []);
  return { ...status, retry: () => setGeneration(value => value + 1), release, getResultDisplay };
}
