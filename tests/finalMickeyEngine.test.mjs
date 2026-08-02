import assert from 'node:assert/strict';
import { MICKEY_TARGETS } from '../lib/mickey/engine.js';
import { buildFinalMickeyResult, markFinalMickeyTarget, startFinalMickeyGame, undoFinalMickeyVisit } from '../lib/mickey/finalEngine.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const participants = count => Array.from({ length: count }, (_, index) => ({ id: index + 1, name: `Player ${index + 1}` }));

function closePlayer(state, playerId) {
  let next = state;
  for (let targetIndex = 0; targetIndex < MICKEY_TARGETS.length; targetIndex += 1) {
    for (let mark = 0; mark < 3; mark += 1) {
      const playerIndex = next.players.findIndex(player => player.id === playerId);
      next = markFinalMickeyTarget(next, playerIndex, targetIndex);
    }
  }
  return next;
}

test('throw order controls the left-to-right player order', () => {
  const state = startFinalMickeyGame({ participants: participants(4), throwOrderPlayerIds: [3, 1, 4, 2] });
  assert.deepEqual(state.players.map(player => player.id), [3, 1, 4, 2]);
});

test('two-player final assigns the closer first and the remaining player second', () => {
  let state = startFinalMickeyGame({ participants: participants(2), throwOrderPlayerIds: [2, 1] });
  state = closePlayer(state, 1);
  assert.equal(state.status, 'finished');
  assert.deepEqual(state.placements, [{ playerId: 1, place: 1 }, { playerId: 2, place: 2 }]);
});

test('four-player final continues after placements and automatically assigns last place', () => {
  let state = startFinalMickeyGame({ participants: participants(4) });
  state = closePlayer(state, 3);
  assert.equal(state.status, 'playing');
  state = closePlayer(state, 1);
  assert.equal(state.status, 'playing');
  state = closePlayer(state, 4);
  assert.equal(state.status, 'finished');
  assert.deepEqual(state.placements, [
    { playerId: 3, place: 1 }, { playerId: 1, place: 2 }, { playerId: 4, place: 3 }, { playerId: 2, place: 4 }
  ]);
  assert.deepEqual(buildFinalMickeyResult(state).orderedPlayerIds, [3, 1, 4, 2]);
});

test('undoing the deciding entry reopens the final and removes automatic placements', () => {
  let state = startFinalMickeyGame({ participants: participants(3) });
  state = closePlayer(state, 1);
  state = closePlayer(state, 2);
  assert.equal(state.status, 'finished');
  const undone = undoFinalMickeyVisit(state);
  assert.equal(undone.status, 'playing');
  assert.deepEqual(undone.placements, [{ playerId: 1, place: 1 }]);
  assert.equal(undone.players.find(player => player.id === 2).marks[MICKEY_TARGETS.length - 1], 2);
});

for (const { name, fn } of tests) {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}
