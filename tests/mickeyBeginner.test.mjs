import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDefaultTournamentState, configureTournament, normalizeTournamentState,
  addPlayer, startTournament, generateMatches, publishRound, resetTournament, startFinalMatch
} from '../lib/tournament/reactEngine.js';
import {
  startMickeyGame, normalizeMickeyState, markMickeyTarget, undoMickeyVisit,
  buildMickeyTournamentResult, getMickeyTargets, runMickeyAiTurn
} from '../lib/mickey/engine.js';
import { startFinalMickeyGame, markFinalMickeyTarget, undoFinalMickeyVisit, buildFinalMickeyResult } from '../lib/mickey/finalEngine.js';
import { buildLaneMatchSnapshot, TOURNAMENT_KEY, applyLaneMatchResult, applyLaneFinalResult } from '../lib/laneMatch.js';
import { buildLaneAnnouncements } from '../lib/laneAnnouncements.js';
import { buildLaneDisplayBoard, parseLaneDisplayBoard, approveLaneDisplayBoard } from '../lib/laneDisplay.js';

function tournament(beginnerMode) {
  let state = configureTournament(createDefaultTournamentState(), { beginnerMode, tournamentName: 'Test', laneCount: 1 });
  for (const name of ['A', 'B', 'C', 'D']) state = addPlayer(state, name);
  return startTournament(state, { beginnerMode, laneCount: 1 });
}

function closeTargets(state, mark, playerIndex) {
  for (let index = 0; index < 6; index += 1) state = mark(state, playerIndex, index, 3);
  return state;
}

test('old saves and fresh/reset tournaments use standard rules; a running tournament retains its choice', () => {
  assert.equal(createDefaultTournamentState().beginnerMode, false);
  assert.equal(normalizeTournamentState({}).beginnerMode, false);
  assert.equal(resetTournament().beginnerMode, false);
  assert.equal(getMickeyTargets().length, 9);
  assert.equal(normalizeMickeyState({}).beginnerMode, false);
  const started = tournament(true);
  assert.equal(configureTournament(started, { beginnerMode: false }).beginnerMode, true);
  assert.equal(configureTournament(tournament(false), { beginnerMode: true }).beginnerMode, false);
});

test('beginner scoring rejects D/T/B, closes after six targets and survives reload and undo', () => {
  let state = startMickeyGame({ beginnerMode: true });
  for (const targetIndex of [6, 7, 8]) {
    assert.equal(markMickeyTarget(state, 0, targetIndex, 3).visits.length, 0);
  }
  state = closeTargets(state, markMickeyTarget, 0);
  assert.equal(state.status, 'finished');
  assert.equal(state.winnerIndex, 0);
  assert.deepEqual(state.players[0].marks, [3, 3, 3, 3, 3, 3, 0, 0, 0]);
  state = normalizeMickeyState(JSON.parse(JSON.stringify(state)));
  const result = buildMickeyTournamentResult(state);
  assert.equal(result.beginnerMode, true);
  assert.equal(result.players[0].closedTargets, 6);
  const undone = undoMickeyVisit(state);
  assert.equal(undone.beginnerMode, true);
  assert.equal(undone.status, 'playing');
  assert.equal(undone.players[0].marks[5], 0);
  assert.equal(closeTargets(startMickeyGame(), markMickeyTarget, 0).status, 'playing');
});

test('beginner final calculates all places, preserves rules on undo and projects six targets', () => {
  let state = startFinalMickeyGame({ beginnerMode: true, participants: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }] });
  assert.equal(markFinalMickeyTarget(state, 0, 8, 3).visits.length, 0);
  state = closeTargets(state, markFinalMickeyTarget, 1);
  state = closeTargets(state, markFinalMickeyTarget, 0);
  assert.equal(state.status, 'finished');
  const result = buildFinalMickeyResult(state);
  assert.equal(result.beginnerMode, true);
  assert.deepEqual(result.orderedPlayerIds, [2, 1, 3]);
  assert.equal(undoFinalMickeyVisit(state).beginnerMode, true);
  assert.equal(undoFinalMickeyVisit(state).status, 'playing');
  const board = buildLaneDisplayBoard({ finalState: state, linkedMatch: { isFinal: true } });
  assert.equal(parseLaneDisplayBoard(board).beginnerMode, true);
  assert.equal(approveLaneDisplayBoard(board, result, true).beginnerMode, true);
  const finalTournament = publishRound(startFinalMatch(tournament(true)));
  const finalMatch = buildLaneMatchSnapshot({ [TOURNAMENT_KEY]: finalTournament }, 1).match;
  assert.equal(finalMatch.beginnerMode, true);
  assert.equal(applyLaneFinalResult({ competitionKey: TOURNAMENT_KEY, state: finalTournament, matchId: finalMatch.id, lane: 1,
    orderedPlayerIds: finalMatch.participants.map(player => player.id), gameResult: result }).beginnerMode, true);
});

test('published match, lane announcement and approved result carry the same beginner mode', () => {
  const state = publishRound(generateMatches(tournament(true)));
  const snapshot = buildLaneMatchSnapshot({ [TOURNAMENT_KEY]: state }, 1);
  assert.equal(snapshot.match.beginnerMode, true);
  assert.equal(buildLaneAnnouncements({ [TOURNAMENT_KEY]: state }, [1])[0].board.showdartPairing.roundLabel, 'Runde 1');
  const game = closeTargets(startMickeyGame({ beginnerMode: snapshot.match.beginnerMode }), markMickeyTarget, 0);
  const result = buildMickeyTournamentResult(game);
  const board = buildLaneDisplayBoard({ state: game });
  assert.equal(parseLaneDisplayBoard(board).beginnerMode, true);
  assert.equal(board.matchLabel, 'Mickey');
  assert.equal(approveLaneDisplayBoard(board, result, false).beginnerMode, true);
  assert.throws(() => parseLaneDisplayBoard({ ...board, beginnerMode: 'true' }));
  const saved = applyLaneMatchResult({ competitionKey: TOURNAMENT_KEY, state, matchId: snapshot.match.id, lane: 1, winnerIndex: 0, gameResult: result });
  assert.equal(saved.beginnerMode, true);
  assert.equal(saved.matches.find(match => match.id === snapshot.match.id).gameResult.beginnerMode, true);
  assert.throws(() => applyLaneMatchResult({ competitionKey: TOURNAMENT_KEY, state, matchId: snapshot.match.id, lane: 1,
    winnerIndex: 0, gameResult: { ...result, beginnerMode: false } }), error => error.code === 'rules_mismatch');
});

test('AI respects the six beginner targets', () => {
  let state = startMickeyGame({ beginnerMode: true, opponentMode: 'ai', aiAverageMarks: 5 });
  for (let turn = 0; turn < 60 && state.status === 'playing'; turn += 1) state = runMickeyAiTurn(state, () => .5);
  assert.equal(state.status, 'finished');
  assert.deepEqual(state.players[1].marks.slice(6), [0, 0, 0]);
});
