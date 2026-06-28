import assert from 'node:assert/strict';

import {
  MICKEY_TARGETS,
  buildMickeyTournamentResult,
  getMickeyMpr,
  getMickeyMarksValue,
  markMickeyTarget,
  runMickeyAiTurn,
  startMickeyGame,
  undoMickeyVisit
} from '../lib/mickey/engine.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function closePlayer(state, playerIndex = 0) {
  let next = state;
  for (let targetIndex = 0; targetIndex < MICKEY_TARGETS.length; targetIndex += 1) {
    next = markMickeyTarget(next, playerIndex, targetIndex);
    next = markMickeyTarget(next, playerIndex, targetIndex);
    next = markMickeyTarget(next, playerIndex, targetIndex);
  }
  return next;
}

test('Mickey mark values follow extracted cricket rules', () => {
  const number = MICKEY_TARGETS.find(target => target.key === '20');
  const anyDouble = MICKEY_TARGETS.find(target => target.key === 'any-double');
  const anyTriple = MICKEY_TARGETS.find(target => target.key === 'any-triple');
  const bull = MICKEY_TARGETS.find(target => target.key === 'bull');

  assert.equal(getMickeyMarksValue(number, 'single'), 1);
  assert.equal(getMickeyMarksValue(number, 'double'), 2);
  assert.equal(getMickeyMarksValue(number, 'triple'), 3);
  assert.equal(getMickeyMarksValue(anyDouble, 'double'), 1);
  assert.equal(getMickeyMarksValue(anyDouble, 'triple'), 0);
  assert.equal(getMickeyMarksValue(anyTriple, 'triple'), 1);
  assert.equal(getMickeyMarksValue(anyTriple, 'double'), 0);
  assert.equal(getMickeyMarksValue(bull, 'single'), 1);
  assert.equal(getMickeyMarksValue(bull, 'double'), 2);
});

test('manual marks close every Mickey target and create a tournament result payload', () => {
  let state = startMickeyGame({ playerOneName: 'Mickey', playerTwoName: 'Mouse' });
  state = closePlayer(state, 0);

  assert.equal(state.status, 'finished');
  assert.equal(state.winnerIndex, 0);
  assert.equal(state.players[0].marks.every(mark => mark === 3), true);
  assert.equal(state.players[0].rawMarks, 27);
  assert.equal(getMickeyMpr(state.players[0]), '3,00');

  const result = buildMickeyTournamentResult(state, { matchId: 'future-match' });
  assert.equal(result.winnerName, 'Mickey');
  assert.equal(result.loserName, 'Mouse');
  assert.equal(result.players[0].closedTargets, 9);
  assert.equal(result.metadata.matchId, 'future-match');
});

test('undo removes the last visit and reopens the result if needed', () => {
  let state = startMickeyGame({ playerOneName: 'Mickey', playerTwoName: 'Mouse' });
  state = closePlayer(state, 0);
  const undone = undoMickeyVisit(state);

  assert.equal(undone.status, 'playing');
  assert.equal(undone.winnerIndex, null);
  assert.equal(undone.players[0].marks[MICKEY_TARGETS.length - 1], 2);
  assert.equal(undone.visits.length, state.visits.length - 1);
});

test('AI turn records up to three darts without marking closed targets beyond 3', () => {
  let calls = 0;
  const random = () => {
    calls += 1;
    return 0.5;
  };
  const state = startMickeyGame({ opponentMode: 'ai', aiAverageMarks: 4 });
  const next = runMickeyAiTurn(state, random);

  assert.equal(next.visits.length, 1);
  assert.equal(next.visits[0].playerIndex, 1);
  assert.ok(next.visits[0].entries.length <= 3);
  assert.ok(next.players[1].marks.every(mark => mark <= 3));
  assert.ok(calls > 0);
});

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}
