import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLaneDisplayBoard, parseLaneDisplayBoard, approveLaneDisplayBoard } from '../lib/laneDisplay.js';
import { bridgeConfig, createLaneDisplayGrant, readLaneDisplayGrant, sendLaneDisplayMessage, deliverLaneDisplayOutbox } from '../lib/server/laneDisplayBridge.js';
import { createLaneDisplayPublisher } from '../lib/laneDisplayPublisher.js';
import { createDefaultTournamentState, normalizeTournamentState } from '../lib/tournament/reactEngine.js';
import { createDefaultChampionshipState, normalizeChampionshipState } from '../lib/championship/engine.js';

const player = (name, id) => ({ name, id, marks: Array(9).fill(0), visits: ['private-history'] });
const owner = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const config = bridgeConfig({ NODE_ENV: 'production', LANE_SCREEN_PLAYGROUND_URL: 'https://example.test/path', LANE_SCREEN_BRIDGE_SECRET: 's'.repeat(32), LANE_SCREEN_ALLOWED_USER_IDS: owner, LANE_SCREEN_LANES: '1,2' });
const state = { status: 'playing', players: [player('Alice', 1), player('Bob', 2)], selectedTargetIndex: 8, visits: [1,2,3] };
const board = buildLaneDisplayBoard({state});

test('new competitions get distinct identities while old saved states normalize consistently', () => {
  assert.notEqual(createDefaultTournamentState().competitionInstanceId, createDefaultTournamentState().competitionInstanceId);
  assert.notEqual(createDefaultChampionshipState().competitionInstanceId, createDefaultChampionshipState().competitionInstanceId);
  assert.equal(normalizeTournamentState({}).competitionInstanceId, 'legacy');
  assert.equal(normalizeChampionshipState({}).competitionInstanceId, 'legacy');
  const tournament = createDefaultTournamentState();
  assert.equal(normalizeTournamentState(tournament).competitionInstanceId, tournament.competitionInstanceId);
});

test('projection contains only visible data; UI changes do not change its fingerprint', () => {
  assert.deepEqual(board, buildLaneDisplayBoard({state: {...state, selectedTargetIndex: 0, visits: [1]}}));
  assert.equal(JSON.stringify(board).includes('private-history'), false);
  assert.ok(Buffer.byteLength(JSON.stringify(board)) < 4096);
  assert.equal(buildLaneDisplayBoard({state: {...state, status: 'setup'}}), null);
});
test('final throwing order preserves player identities and approved placement order', () => {
  const finalState = {status: 'finished', players: [player('Dan',4), player('Alice',1), player('Bob',2), player('Carla',3)]};
  const finalBoard = buildLaneDisplayBoard({state, finalState, linkedMatch: {isFinal: true}});
  assert.equal(finalBoard.stage, 'pending');
  const approved = approveLaneDisplayBoard(finalBoard, {orderedPlayerIds: [2,4,3,1]}, true);
  assert.deepEqual(approved.placements, ['player:2','player:4','player:3','player:1']);
});
test('ordinary winner uses display-side order and requires approval', () => {
  assert.deepEqual(approveLaneDisplayBoard({...board, stage: 'pending'}, {winnerIndex: 1}, false).placements, ['side:1','side:0']);
  assert.throws(() => approveLaneDisplayBoard(board, {winnerIndex: 0}, false));
  assert.throws(() => parseLaneDisplayBoard({...board, stage: 'approved'}));
  assert.throws(() => parseLaneDisplayBoard({...board, players: [board.players[0], board.players[0]]}));
});
test('configuration denies missing allowlists, short secrets and insecure production endpoints', () => {
  assert.equal(config.enabled, true);
  assert.equal(config.url, 'https://example.test/api/integrations/showdart/lane-display');
  assert.equal(bridgeConfig({}).enabled, false);
  assert.equal(bridgeConfig({NODE_ENV: 'production', LANE_SCREEN_PLAYGROUND_URL: 'http://example.test', LANE_SCREEN_BRIDGE_SECRET: 's'.repeat(32), LANE_SCREEN_ALLOWED_USER_IDS: owner, LANE_SCREEN_LANES: '1'}).enabled, false);
});
test('grants are scoped, expiring, tamper-evident and immediately revoked by allowlists', () => {
  const token = createLaneDisplayGrant({userId: owner, lane: 1, sessionId}, config, 1000);
  assert.equal(readLaneDisplayGrant(token, config, 2000).lane, 1);
  assert.throws(() => readLaneDisplayGrant(token + 'a', config, 2000));
  assert.throws(() => readLaneDisplayGrant(token, config, 1000 + 12 * 60 * 60 * 1000));
  assert.throws(() => readLaneDisplayGrant(token, {...config, allowedUsers: new Set()}, 2000));
  assert.throws(() => readLaneDisplayGrant(token, {...config, lanes: [2]}, 2000));
});
test('bridge signs exact bytes, uses a bounded timeout, and preserves busy responses', async () => {
  let request;
  await sendLaneDisplayMessage({action: 'update', board}, {config, now: 1000, fetchImpl: async (url, options) => { request = {url, ...options}; return {ok:true, json: async () => ({ok:true})}; }});
  assert.equal(request.headers['x-showdart-timestamp'], '1000');
  assert.equal(request.headers['x-showdart-signature'].length, 64);
  assert.equal(request.signal.aborted, false);
  await assert.rejects(sendLaneDisplayMessage({}, {config, fetchImpl: async () => ({ok:false,status:409,json:async()=>({error:'Busy'})})}), error => error.status === 409);
});

function clock() {
  let now = 1000;
  let sequence = 0;
  const jobs = new Map();
  return {
    now: () => now,
    setTimer: (work, delay) => { const id = ++sequence; jobs.set(id, {work, at: now + delay}); return id; },
    clearTimer: id => jobs.delete(id),
    async advance(milliseconds) {
      now += milliseconds;
      for (const [id, job] of [...jobs]) if (job.at <= now) { jobs.delete(id); job.work(); }
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
    }
  };
}
test('publisher coalesces bursts, retains a trailing state and never sends concurrently', async () => {
  const time = clock();
  const sent = [];
  let finish;
  const publisher = createLaneDisplayPublisher(async value => { sent.push(value); if (sent.length === 1) await new Promise(resolve => {finish = resolve;}); }, time);
  publisher.publish({marks:1}); publisher.publish({marks:2});
  await time.advance(0);
  assert.deepEqual(sent, [{marks:2}]);
  publisher.publish({marks:3}); publisher.publish({marks:4});
  await time.advance(1000);
  assert.equal(sent.length, 1);
  finish();
  await time.advance(0); await time.advance(550);
  assert.deepEqual(sent, [{marks:2},{marks:4}]);
  publisher.publish({marks:4}); await time.advance(1000);
  assert.equal(sent.length, 2);
  publisher.stop();
});
test('publisher backs off failures, retries only latest state and stops after ownership loss', async () => {
  const time = clock();
  const sent = [];
  const publisher = createLaneDisplayPublisher(async value => {sent.push(value); if (sent.length === 1) throw new Error('offline');}, {...time, random:()=>0});
  publisher.publish(1); await time.advance(0);
  publisher.publish(2); await time.advance(1000); assert.equal(sent.length,1);
  await time.advance(1000); assert.deepEqual(sent,[1,2]);
  publisher.stop();
  const busy = createLaneDisplayPublisher(async () => {const error = new Error('busy'); error.status = 409; throw error;}, time);
  busy.publish(1); await time.advance(0); busy.publish(2); await time.advance(60_000);
  busy.stop();
});
test('delivery acknowledgment follows successful delivery; failures remain retryable', async () => {
  const calls = [];
  const client = {rpc: async (name, args) => { calls.push({name,args}); return name === 'claim_showdart_display_deliveries' ? {data:[{event_id:'e',attempts:2,payload_json:{}}]} : {}; }};
  // No environment configuration: transport fails and only a negative ack is sent.
  const result = await deliverLaneDisplayOutbox(client, 'e');
  assert.deepEqual(result, {delivered:0,attempted:1});
  assert.equal(calls[1].args.was_delivered, false);
  assert.equal(calls[1].args.target_attempt, 2);
});
