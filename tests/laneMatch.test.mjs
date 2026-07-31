import assert from 'node:assert/strict';

import {
  CHAMPIONSHIP_KEY,
  TOURNAMENT_KEY,
  LaneMatchError,
  applyLaneMatchResult,
  buildLaneMatchSnapshot
} from '../lib/laneMatch.js';
import { createDefaultTournamentState, normalizeTournamentState } from '../lib/tournament/reactEngine.js';
import { createDefaultChampionshipState, normalizeChampionshipState } from '../lib/championship/engine.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function publishedTournament() {
  return normalizeTournamentState({
    ...createDefaultTournamentState(),
    tournamentName: 'Friday Cup',
    started: true,
    roundPublished: true,
    currentRound: 2,
    laneCount: 2,
    activeLanes: [1, 2],
    players: [
      { id: 1, name: 'Alice' }, { id: 2, name: 'Bob' },
      { id: 3, name: 'Carla' }, { id: 4, name: 'Dan' }
    ],
    matches: [
      { id: 10, mode: 'changing', team1PlayerIds: [1], team2PlayerIds: [2], winner: null, laneNumber: 1, lanePosition: 1 },
      { id: 11, mode: 'changing', team1PlayerIds: [3], team2PlayerIds: [4], winner: null, laneNumber: 1, lanePosition: 2 }
    ]
  });
}

function publishedChampionship() {
  return normalizeChampionshipState({
    ...createDefaultChampionshipState(),
    tournamentName: 'Club Masters',
    started: true,
    phase: 'initial_groups',
    roundPublished: true,
    stageRound: 1,
    teams: [
      { id: 1, memberOne: 'A', memberTwo: 'B', name: 'A / B' },
      { id: 2, memberOne: 'C', memberTwo: 'D', name: 'C / D' }
    ],
    matches: [{ id: 20, team1Id: 1, team2Id: 2, laneNumber: 2, lanePosition: 1, round: 1 }],
    activeMatchIds: [20]
  });
}

test('selected lane returns only the current tournament match', () => {
  const state = publishedTournament();
  const snapshot = buildLaneMatchSnapshot({ [TOURNAMENT_KEY]: state }, 1);
  assert.equal(snapshot.status, 'match_ready');
  assert.equal(snapshot.match.id, 10);
  assert.equal(snapshot.match.side1Label, 'Alice');
  assert.equal(snapshot.match.side2Label, 'Bob');
});

test('a submitted tournament result completes the current match and preserves Mickey data', () => {
  const state = publishedTournament();
  const next = applyLaneMatchResult({
    competitionKey: TOURNAMENT_KEY,
    state,
    matchId: 10,
    lane: 1,
    winnerIndex: 1,
    gameResult: { game: 'mickey', visits: 12 }
  });
  assert.equal(next.matches.find(match => match.id === 10).winner, 2);
  assert.equal(next.matches.find(match => match.id === 10).gameResult.visits, 12);
  assert.equal(normalizeTournamentState(next).matches.find(match => match.id === 10).gameResult.visits, 12);
  assert.equal(buildLaneMatchSnapshot({ [TOURNAMENT_KEY]: next }, 1).match.id, 11);
});

test('queued matches cannot submit a result', () => {
  assert.throws(() => applyLaneMatchResult({
    competitionKey: TOURNAMENT_KEY,
    state: publishedTournament(),
    matchId: 11,
    lane: 1,
    winnerIndex: 0,
    gameResult: { game: 'mickey' }
  }), error => error instanceof LaneMatchError && error.code === 'match_not_current');
});

test('championship matches resolve winner ids and are preferred when active', () => {
  const championship = publishedChampionship();
  const snapshot = buildLaneMatchSnapshot({
    [TOURNAMENT_KEY]: createDefaultTournamentState(),
    [CHAMPIONSHIP_KEY]: championship
  }, 2);
  assert.equal(snapshot.competition.key, CHAMPIONSHIP_KEY);
  assert.equal(snapshot.match.side1Label, 'A / B');
  const next = applyLaneMatchResult({ competitionKey: CHAMPIONSHIP_KEY, state: championship, matchId: 20, lane: 2, winnerIndex: 0, gameResult: { game: 'mickey' } });
  assert.equal(next.matches[0].winnerId, 1);
  assert.equal(next.matches[0].gameResult.game, 'mickey');
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
