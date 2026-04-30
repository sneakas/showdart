import assert from 'node:assert/strict';

import {
  addFixedTeam,
  addPlayer,
  assignMatchLane,
  completeFinal,
  completeRound,
  createDefaultTournamentState,
  generateMatches,
  getActiveEntries,
  normalizeTournamentState,
  selectWinner,
  setActiveLane,
  startTournament
} from '../lib/tournament/reactEngine.js';
import { buildScreenState } from '../lib/tournamentScreenState.js';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function changingState(count, patch = {}) {
  let state = createDefaultTournamentState();
  for (let index = 1; index <= count; index += 1) {
    state = addPlayer(state, `Player ${index}`);
  }
  return normalizeTournamentState({ ...state, ...patch });
}

function fixedState(count, patch = {}) {
  let state = normalizeTournamentState({ ...createDefaultTournamentState(), teammateMode: 'fixed' });
  for (let index = 1; index <= count; index += 1) {
    state = addFixedTeam(state, `Team ${index}A`, `Team ${index}B`);
  }
  return normalizeTournamentState({ ...state, ...patch });
}

function winAllMatches(state) {
  return state.matches.reduce((next, match) => selectWinner(next, match.id, 1), state);
}

test('changing-teammate tournaments require at least four players', () => {
  const tooSmall = startTournament(changingState(3), { teammateMode: 'changing' });
  assert.equal(tooSmall.started, false);
  assert.match(tooSmall.lastGenerationError, /mindst 4 spillere/i);

  const valid = startTournament(changingState(4), { teammateMode: 'changing' });
  assert.equal(valid.started, true);
  assert.equal(valid.currentRound, 1);
});

test('fixed-team tournaments require at least two teams', () => {
  const tooSmall = startTournament(fixedState(1), { teammateMode: 'fixed' });
  assert.equal(tooSmall.started, false);
  assert.match(tooSmall.lastGenerationError, /mindst 2 hold/i);

  const valid = startTournament(fixedState(2), { teammateMode: 'fixed' });
  assert.equal(valid.started, true);
  assert.equal(valid.currentRound, 1);
});

test('changing mode assigns O tags to sit-outs and S tags to singles without generating invalid rounds', () => {
  let state = startTournament(changingState(7), { teammateMode: 'changing', laneCount: 4 });
  state = generateMatches(state);

  assert.equal(state.matches.length, 2);
  assert.equal(state.skippedPlayerIds.length, 1);

  const skipped = state.players.find(player => player.id === state.skippedPlayerIds[0]);
  assert.ok(skipped.tags.includes('O'));

  const singlesMatch = state.matches.find(match => match.team1PlayerIds.length === 1 && match.team2PlayerIds.length === 1);
  assert.ok(singlesMatch, 'expected one singles match when seven players are active');
  for (const id of [...singlesMatch.team1PlayerIds, ...singlesMatch.team2PlayerIds]) {
    assert.ok(state.players.find(player => player.id === id).tags.includes('S'));
  }
});

test('O tag cycle keeps the final newly skipped player tagged while resetting the rest', () => {
  let state = startTournament(changingState(5), { teammateMode: 'changing', laneCount: 4 });
  state = {
    ...state,
    players: state.players.map((player, index) => ({
      ...player,
      tags: index < 4 ? ['O'] : []
    }))
  };

  state = generateMatches(state);
  assert.equal(state.skippedPlayerIds.length, 1);
  const skippedId = state.skippedPlayerIds[0];

  for (const player of state.players) {
    const hasO = player.tags.includes('O');
    assert.equal(hasO, player.id === skippedId, `unexpected O tag state for ${player.name}`);
  }
});

test('fixed teams use O tags for sit-outs and avoid repeating sit-outs before others have sat out', () => {
  let state = startTournament(fixedState(3), { teammateMode: 'fixed', laneCount: 2 });
  state = generateMatches(state);

  assert.equal(state.matches.length, 1);
  assert.equal(state.skippedTeamIds.length, 1);
  const firstSkipped = state.skippedTeamIds[0];
  assert.ok(state.fixedTeams.find(team => team.id === firstSkipped).tags.includes('O'));

  state = completeRound(winAllMatches(state));
  state = generateMatches(state);

  assert.equal(state.skippedTeamIds.length, 1);
  assert.notEqual(state.skippedTeamIds[0], firstSkipped);
});

test('inactive lanes cannot be assigned and disabling a lane clears existing assignments', () => {
  let state = startTournament(changingState(4), { teammateMode: 'changing', laneCount: 2 });
  state = generateMatches(state);
  assert.equal(state.matches[0].laneNumber, 1);

  state = setActiveLane(state, 1, false);
  assert.deepEqual(state.activeLanes, [2]);
  assert.equal(state.matches[0].laneNumber, null);

  state = assignMatchLane(state, state.matches[0].id, 1);
  assert.match(state.lastGenerationError, /inaktiv/i);
  assert.equal(state.matches[0].laneNumber, null);
});

test('final placements include finalists first and earlier eliminated entries sharing the same place', () => {
  let state = startTournament(changingState(6), { teammateMode: 'changing', maxLosses: 2 });
  state = {
    ...state,
    players: state.players.map(player => {
      if (player.id === 1 || player.id === 2) return player;
      if (player.id === 3 || player.id === 4) return { ...player, active: false, losses: 2, eliminationRound: 4 };
      return { ...player, active: false, losses: 2, eliminationRound: 3 };
    })
  };

  state = completeFinal(state, [2, 1]);
  const screenState = buildScreenState(state);
  const placements = screenState.finalPlacements.map(entry => ({ id: entry.id, place: entry.place }));

  assert.deepEqual(placements, [
    { id: 2, place: 1 },
    { id: 1, place: 2 },
    { id: 3, place: 3 },
    { id: 4, place: 3 },
    { id: 5, place: 5 },
    { id: 6, place: 5 }
  ]);
  assert.deepEqual(getActiveEntries(state).map(entry => entry.id), [2]);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
