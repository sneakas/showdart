import assert from 'node:assert/strict';

import {
  addChampionshipTeam,
  addPointsAdjustment,
  advanceToABGroups,
  allocateInitialGroups,
  completeChampionshipRound,
  configureChampionship,
  createDefaultChampionshipState,
  generateChampionshipPlayoffs,
  generateRequiredTieBreaks,
  getCurrentMatches,
  getDivisionBracket,
  getGroupStandings,
  publishChampionshipRound,
  setChampionshipTieBreakQualifiers,
  setChampionshipWinner,
  swapTeamsBetweenGroups,
  withdrawChampionshipTeam
} from '../lib/championship/engine.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function stateWithTeams(count, config = {}) {
  let state = configureChampionship(createDefaultChampionshipState(), {
    tournamentName: 'Club Championship',
    ...config
  });
  for (let index = 1; index <= count; index += 1) {
    state = addChampionshipTeam(state, `Player ${index}A`, `Player ${index}B`, { seed: index });
  }
  return state;
}

function finishCurrentStage(state) {
  let next = state;
  let guard = 0;
  while (!next.stageComplete && guard < 100) {
    guard += 1;
    next = publishChampionshipRound(next);
    for (const match of getCurrentMatches(next)) {
      if (match.isBye || match.voided || match.winnerId) continue;
      next = setChampionshipWinner(next, match.id, Math.min(match.team1Id, match.team2Id));
    }
    next = completeChampionshipRound(next);
  }
  assert.ok(guard < 100, 'stage loop did not finish');
  return next;
}

test('initial groups are balanced and schedule every pair exactly once', () => {
  let state = stateWithTeams(10, { initialGroupCount: 3 });
  state = allocateInitialGroups(state, 'seeded');

  const groups = state.groups.filter(group => group.division === 'INITIAL');
  assert.deepEqual(groups.map(group => group.teamIds.length).sort((a, b) => a - b), [3, 3, 4]);
  for (const group of groups) {
    const matches = state.matches.filter(match => match.groupId === group.id && match.stage === 'initial');
    assert.equal(matches.length, group.teamIds.length * (group.teamIds.length - 1) / 2);
    const pairs = new Set(matches.map(match => [match.team1Id, match.team2Id].sort((a, b) => a - b).join('-')));
    assert.equal(pairs.size, matches.length);
  }
});

test('teams can be swapped after seeded allocation before results', () => {
  let state = allocateInitialGroups(stateWithTeams(8, { initialGroupCount: 2 }), 'seeded');
  const [first, second] = state.groups;
  const firstId = first.teamIds[0];
  const secondId = second.teamIds[0];
  state = swapTeamsBetweenGroups(state, firstId, secondId);
  assert.ok(state.groups.find(group => group.id === first.id).teamIds.includes(secondId));
  assert.ok(state.groups.find(group => group.id === second.id).teamIds.includes(firstId));
});

test('completed initial groups advance into separate A and B groups with reset standings', () => {
  let state = stateWithTeams(8, {
    initialGroupCount: 2,
    initialAQualifiersPerGroup: 2,
    aGroupCount: 1,
    bGroupCount: 1
  });
  state = finishCurrentStage(allocateInitialGroups(state, 'seeded'));
  state = advanceToABGroups(state);

  assert.equal(state.phase, 'ab_groups');
  assert.equal(state.groups.find(group => group.division === 'A').teamIds.length, 4);
  assert.equal(state.groups.find(group => group.division === 'B').teamIds.length, 4);
  assert.ok(getGroupStandings(state, 'A1').every(entry => entry.points === 0));
  assert.ok(getGroupStandings(state, 'B1').every(entry => entry.points === 0));
});

test('A and B produce separate playoffs, third-place winners and champions', () => {
  let state = stateWithTeams(16, {
    initialGroupCount: 2,
    initialAQualifiersPerGroup: 4,
    aGroupCount: 1,
    bGroupCount: 1,
    aPlayoffQualifiersPerGroup: 4,
    bPlayoffQualifiersPerGroup: 4,
    laneCount: 7
  });
  state = finishCurrentStage(allocateInitialGroups(state, 'seeded'));
  state = finishCurrentStage(advanceToABGroups(state));
  state = generateChampionshipPlayoffs(state);
  state = finishCurrentStage(state);

  assert.equal(state.phase, 'finished');
  const a = getDivisionBracket(state, 'A');
  const b = getDivisionBracket(state, 'B');
  assert.ok(a.championId && a.runnerUpId && a.thirdId);
  assert.ok(b.championId && b.runnerUpId && b.thirdId);
  assert.equal(a.rounds.at(-1).matches.filter(match => ['final', 'third'].includes(match.matchType)).length, 2);
});

test('six qualifiers create eight-slot A and B brackets with byes', () => {
  let state = stateWithTeams(24, {
    initialGroupCount: 2,
    initialAQualifiersPerGroup: 6,
    aGroupCount: 2,
    bGroupCount: 2,
    aPlayoffQualifiersPerGroup: 3,
    bPlayoffQualifiersPerGroup: 3,
    laneCount: 7
  });
  state = finishCurrentStage(allocateInitialGroups(state, 'seeded'));
  state = finishCurrentStage(advanceToABGroups(state));
  state = generateChampionshipPlayoffs(state);

  for (const division of ['A', 'B']) {
    const bracket = getDivisionBracket(state, division);
    assert.equal(bracket.bracketSize, 8);
    assert.equal(bracket.seedTeamIds.length, 6);
    assert.equal(bracket.rounds[0].matches.filter(match => match.isBye).length, 2);
  }

  state = finishCurrentStage(state);
  assert.equal(state.phase, 'finished');
  assert.ok(getDivisionBracket(state, 'A').championId);
  assert.ok(getDivisionBracket(state, 'B').championId);
});

test('three-way boundary ties use one simultaneous event and unlock progression', () => {
  let state = stateWithTeams(6, {
    initialGroupCount: 2,
    initialAQualifiersPerGroup: 1,
    laneCount: 2
  });
  state = allocateInitialGroups(state, 'seeded');
  const cycles = new Map(state.groups.map(group => {
    const [a, b, c] = [...group.teamIds].sort((left, right) => left - right);
    return [group.id, new Map([
      [[a, b].sort((left, right) => left - right).join('-'), a],
      [[b, c].sort((left, right) => left - right).join('-'), b],
      [[a, c].sort((left, right) => left - right).join('-'), c]
    ])];
  }));

  while (!state.stageComplete) {
    state = publishChampionshipRound(state);
    for (const match of getCurrentMatches(state)) {
      const key = [match.team1Id, match.team2Id].sort((a, b) => a - b).join('-');
      state = setChampionshipWinner(state, match.id, cycles.get(match.groupId).get(key));
    }
    state = completeChampionshipRound(state);
  }

  state = generateRequiredTieBreaks(state);
  assert.equal(state.lastError, '');
  const tieBreaks = getCurrentMatches(state);
  assert.equal(tieBreaks.length, 2);
  assert.ok(tieBreaks.every(match => match.isMultiTeamTieBreak && match.participantIds.length === 3 && match.qualifierCount === 1));

  state = publishChampionshipRound(state);
  for (const match of getCurrentMatches(state)) {
    state = setChampionshipTieBreakQualifiers(state, match.id, [match.participantIds[0]]);
  }
  state = completeChampionshipRound(state);
  assert.equal(state.stageComplete, true);

  const repeated = generateRequiredTieBreaks(state);
  assert.match(repeated.lastError, /ingen uløste/i);
  state = advanceToABGroups(state);
  assert.equal(state.phase, 'ab_groups');
  assert.equal(state.lastError, '');
});

test('a simultaneous tie-break can select multiple qualifying teams', () => {
  let state = stateWithTeams(4, {
    initialGroupCount: 1,
    initialAQualifiersPerGroup: 3,
    aGroupCount: 1,
    bGroupCount: 1,
    laneCount: 2
  });
  state = allocateInitialGroups(state, 'seeded');
  const [first, second, third, fourth] = [...state.groups[0].teamIds].sort((a, b) => a - b);

  while (!state.stageComplete) {
    state = publishChampionshipRound(state);
    for (const match of getCurrentMatches(state)) {
      const pair = new Set([match.team1Id, match.team2Id]);
      let winnerId = first;
      if (!pair.has(first)) {
        if (pair.has(second) && pair.has(third)) winnerId = second;
        else if (pair.has(third) && pair.has(fourth)) winnerId = third;
        else winnerId = fourth;
      }
      state = setChampionshipWinner(state, match.id, winnerId);
    }
    state = completeChampionshipRound(state);
  }

  state = generateRequiredTieBreaks(state);
  const tieBreak = getCurrentMatches(state)[0];
  assert.equal(tieBreak.participantIds.length, 3);
  assert.equal(tieBreak.qualifierCount, 2);
  state = publishChampionshipRound(state);
  state = setChampionshipTieBreakQualifiers(state, tieBreak.id, [tieBreak.participantIds[0]]);
  const incomplete = completeChampionshipRound(state);
  assert.match(incomplete.lastError, /afgjort/i);
  state = setChampionshipTieBreakQualifiers(state, tieBreak.id, tieBreak.participantIds.slice(0, 2));
  state = completeChampionshipRound(state);
  state = advanceToABGroups(state);
  assert.equal(state.phase, 'ab_groups');
  assert.equal(state.lastError, '');
});

test('withdrawal supports retaining or voiding completed results', () => {
  let state = allocateInitialGroups(stateWithTeams(4, { initialGroupCount: 1 }), 'seeded');
  state = publishChampionshipRound(state);
  const match = getCurrentMatches(state)[0];
  state = setChampionshipWinner(state, match.id, match.team1Id);

  const kept = withdrawChampionshipTeam(state, match.team2Id, 'keep');
  assert.equal(kept.matches.find(item => item.id === match.id).winnerId, match.team1Id);

  const voided = withdrawChampionshipTeam(state, match.team2Id, 'void');
  assert.equal(voided.matches.find(item => item.id === match.id).voided, true);
  assert.equal(voided.matches.find(item => item.id === match.id).winnerId, null);
});

test('manual points adjustments change standings and require a reason', () => {
  let state = allocateInitialGroups(stateWithTeams(4, { initialGroupCount: 1 }), 'seeded');
  const group = state.groups[0];
  const teamId = group.teamIds[0];
  state = addPointsAdjustment(state, teamId, group.id, 2, 'Organizer correction');
  assert.equal(getGroupStandings(state, group.id).find(entry => entry.teamId === teamId).points, 2);
  assert.equal(state.auditLog.at(-1).action, 'points_adjusted');
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

if (failures) process.exitCode = 1;
