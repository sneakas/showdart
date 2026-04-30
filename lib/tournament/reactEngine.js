const MAX_SHUFFLE_ATTEMPTS = 260;

export function createDefaultTournamentState() {
  return {
    version: 4,
    tournamentName: '',
    teammateMode: 'changing',
    players: [],
    fixedTeams: [],
    maxLosses: 2,
    laneCount: 4,
    activeLanes: [1, 2, 3, 4],
    currentRound: 0,
    started: false,
    pendingTagChanges: false,
    roundHistory: [],
    spectatorOverride: null,
    matches: [],
    skippedPlayerIds: [],
    skippedTeamIds: [],
    finalResultPlayerIds: null,
    finalResultTeamIds: null,
    finalResults: null,
    fairnessHistory: { partners: {}, opponents: {} },
    lastRoundPartnerKeys: [],
    lastRoundOpponentKeys: [],
    lastGenerationError: ''
  };
}

export function normalizeTournamentState(input) {
  const base = createDefaultTournamentState();
  const state = input && typeof input === 'object' ? input : {};
  const laneCount = clampNumber(state.laneCount, 1, 32, base.laneCount);
  const activeLanes = Array.isArray(state.activeLanes)
    ? [...new Set(state.activeLanes.map(Number).filter(lane => Number.isInteger(lane) && lane >= 1 && lane <= laneCount))]
    : Array.from({ length: laneCount }, (_, index) => index + 1);

  return {
    ...base,
    ...state,
    tournamentName: typeof state.tournamentName === 'string' ? state.tournamentName : '',
    teammateMode: state.teammateMode === 'fixed' ? 'fixed' : 'changing',
    players: Array.isArray(state.players) ? state.players.map(normalizePlayer).filter(Boolean) : [],
    fixedTeams: Array.isArray(state.fixedTeams) ? state.fixedTeams.map(normalizeTeam).filter(Boolean) : [],
    maxLosses: clampNumber(state.maxLosses, 1, 20, base.maxLosses),
    laneCount,
    activeLanes: activeLanes.length ? activeLanes : [1],
    currentRound: Number.isInteger(Number(state.currentRound)) ? Number(state.currentRound) : 0,
    started: !!state.started,
    pendingTagChanges: !!state.pendingTagChanges,
    roundHistory: Array.isArray(state.roundHistory) ? state.roundHistory : [],
    matches: Array.isArray(state.matches) ? state.matches.map(normalizeMatch).filter(Boolean) : [],
    skippedPlayerIds: Array.isArray(state.skippedPlayerIds) ? state.skippedPlayerIds.map(Number).filter(Number.isInteger) : [],
    skippedTeamIds: Array.isArray(state.skippedTeamIds) ? state.skippedTeamIds.map(Number).filter(Number.isInteger) : [],
    finalResultPlayerIds: Array.isArray(state.finalResultPlayerIds) ? state.finalResultPlayerIds.map(Number).filter(Number.isInteger) : null,
    finalResultTeamIds: Array.isArray(state.finalResultTeamIds) ? state.finalResultTeamIds.map(Number).filter(Number.isInteger) : null,
    finalResults: Array.isArray(state.finalResults) ? state.finalResults : null,
    fairnessHistory: normalizeFairnessHistory(state.fairnessHistory),
    lastRoundPartnerKeys: Array.isArray(state.lastRoundPartnerKeys) ? state.lastRoundPartnerKeys : [],
    lastRoundOpponentKeys: Array.isArray(state.lastRoundOpponentKeys) ? state.lastRoundOpponentKeys : [],
    lastGenerationError: typeof state.lastGenerationError === 'string' ? state.lastGenerationError : ''
  };
}

export function getEntries(state) {
  return state.teammateMode === 'fixed' ? state.fixedTeams : state.players;
}

export function getActiveEntries(state) {
  return getEntries(state).filter(entry => entry.active !== false);
}

export function canManageEntriesBetweenRounds(state) {
  return !!state.started && !state.finalResults && state.matches.length === 0 && getSkippedEntries(state).length === 0;
}

export function addPlayer(state, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return state;
  return {
    ...state,
    players: [...state.players, {
      id: nextId(state.players),
      name: trimmed,
      losses: 0,
      active: true,
      tags: [],
      modifiedTags: [],
      eliminationRound: null,
      lastSkippedRound: null
    }],
    lastGenerationError: ''
  };
}

export function addFixedTeam(state, memberOne, memberTwo) {
  const one = String(memberOne || '').trim();
  const two = String(memberTwo || '').trim();
  if (!one || !two) return state;
  const id = nextId(state.fixedTeams);
  return {
    ...state,
    fixedTeams: [...state.fixedTeams, {
      id,
      memberOne: one,
      memberTwo: two,
      name: `${one} / ${two}`,
      losses: 0,
      active: true,
      tags: [],
      modifiedTags: [],
      eliminationRound: null,
      lastSkippedRound: null
    }],
    lastGenerationError: ''
  };
}

export function importEntries(state, text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.reduce((next, line) => {
    if (next.teammateMode === 'fixed') {
      const [one, two] = line.split(/\s*(?:,|\/|&|\+|;)\s*/).map(part => part.trim()).filter(Boolean);
      return addFixedTeam(next, one, two);
    }
    return addPlayer(next, line);
  }, state);
}

export function removeEntry(state, id) {
  return state.teammateMode === 'fixed'
    ? { ...state, fixedTeams: state.fixedTeams.filter(team => team.id !== id), lastGenerationError: '' }
    : { ...state, players: state.players.filter(player => player.id !== id), lastGenerationError: '' };
}

export function eliminateEntry(state, id) {
  const update = entry => entry.id === id
    ? { ...entry, losses: state.maxLosses, active: false, eliminationRound: state.currentRound || 1 }
    : entry;
  return state.teammateMode === 'fixed'
    ? { ...state, fixedTeams: state.fixedTeams.map(update), lastGenerationError: '' }
    : { ...state, players: state.players.map(update), lastGenerationError: '' };
}

export function updateEntryLosses(state, id, losses) {
  const nextLosses = Math.max(0, Number(losses) || 0);
  const update = entry => entry.id === id
    ? {
        ...entry,
        losses: nextLosses,
        active: nextLosses < state.maxLosses,
        eliminationRound: nextLosses >= state.maxLosses ? (state.currentRound || 1) : null
      }
    : entry;
  return state.teammateMode === 'fixed'
    ? { ...state, fixedTeams: state.fixedTeams.map(update), lastGenerationError: '' }
    : { ...state, players: state.players.map(update), lastGenerationError: '' };
}

export function togglePlayerTag(state, playerId, tag) {
  if (!['S', 'O'].includes(tag)) return state;
  if (state.teammateMode === 'fixed') {
    if (tag !== 'O') return state;
    return {
      ...state,
      pendingTagChanges: true,
      fixedTeams: state.fixedTeams.map(team => {
        if (team.id !== playerId) return team;
        const tags = Array.isArray(team.tags) ? [...team.tags] : [];
        const modifiedTags = Array.isArray(team.modifiedTags) ? [...team.modifiedTags] : [];
        const tagIndex = tags.indexOf(tag);
        if (tagIndex >= 0) {
          tags.splice(tagIndex, 1);
        } else {
          tags.push(tag);
        }
        const modifiedIndex = modifiedTags.indexOf(tag);
        if (modifiedIndex >= 0) {
          modifiedTags.splice(modifiedIndex, 1);
        } else {
          modifiedTags.push(tag);
        }
        return { ...team, tags, modifiedTags };
      }),
      lastGenerationError: ''
    };
  }
  return {
    ...state,
    pendingTagChanges: true,
    players: state.players.map(player => {
      if (player.id !== playerId) return player;
      const tags = Array.isArray(player.tags) ? [...player.tags] : [];
      const modifiedTags = Array.isArray(player.modifiedTags) ? [...player.modifiedTags] : [];
      const tagIndex = tags.indexOf(tag);
      if (tagIndex >= 0) {
        tags.splice(tagIndex, 1);
      } else {
        tags.push(tag);
      }
      const modifiedIndex = modifiedTags.indexOf(tag);
      if (modifiedIndex >= 0) {
        modifiedTags.splice(modifiedIndex, 1);
      } else {
        modifiedTags.push(tag);
      }
      return { ...player, tags, modifiedTags };
    }),
    lastGenerationError: ''
  };
}

export function approveTagChanges(state) {
  return {
    ...state,
    pendingTagChanges: false,
    players: state.players.map(player => ({ ...player, modifiedTags: [] })),
    fixedTeams: state.fixedTeams.map(team => ({ ...team, modifiedTags: [] })),
    lastGenerationError: ''
  };
}

export function configureTournament(state, patch) {
  const laneCount = clampNumber(patch.laneCount ?? state.laneCount, 1, 32, state.laneCount);
  return {
    ...state,
    tournamentName: String(patch.tournamentName ?? state.tournamentName ?? '').trim(),
    teammateMode: patch.teammateMode === 'fixed' ? 'fixed' : 'changing',
    maxLosses: clampNumber(patch.maxLosses ?? state.maxLosses, 1, 20, state.maxLosses),
    laneCount,
    activeLanes: Array.from({ length: laneCount }, (_, index) => index + 1),
    lastGenerationError: ''
  };
}

export function startTournament(state, patch = {}) {
  const configured = configureTournament(state, patch);
  const entries = configured.teammateMode === 'fixed' ? configured.fixedTeams : configured.players;
  const minimumEntries = configured.teammateMode === 'fixed' ? 2 : 4;
  if (entries.length < minimumEntries) {
    return {
      ...configured,
      started: false,
      currentRound: 0,
      matches: [],
      skippedPlayerIds: [],
      skippedTeamIds: [],
      lastGenerationError: configured.teammateMode === 'fixed'
        ? 'Der skal være mindst 2 hold for at starte turneringen.'
        : 'Der skal være mindst 4 spillere for at starte turneringen.'
    };
  }
  return {
    ...configured,
    started: true,
    currentRound: 1,
    matches: [],
    skippedPlayerIds: [],
    skippedTeamIds: [],
    finalResultPlayerIds: null,
    finalResultTeamIds: null,
    finalResults: null,
    roundHistory: [],
    spectatorOverride: null,
    fairnessHistory: { partners: {}, opponents: {} },
    lastRoundPartnerKeys: [],
    lastRoundOpponentKeys: [],
    pendingTagChanges: false,
    lastGenerationError: '',
    players: configured.players.map(resetProgress),
    fixedTeams: configured.fixedTeams.map(resetProgress)
  };
}

export function setActiveLane(state, laneNumber, active) {
  const lane = Number(laneNumber);
  if (!Number.isInteger(lane) || lane < 1 || lane > state.laneCount) return state;
  const activeSet = new Set(state.activeLanes);
  if (active) activeSet.add(lane);
  if (!active && activeSet.size > 1) activeSet.delete(lane);
  const activeLanes = [...activeSet].sort((a, b) => a - b);
  return {
    ...state,
    activeLanes,
    matches: state.matches.map(match => !active && match.laneNumber === lane ? { ...match, laneNumber: null } : match),
    lastGenerationError: ''
  };
}

export function generateMatches(state) {
  if (!state.started || state.finalResults) return state;
  if (state.pendingTagChanges) {
    return { ...state, lastGenerationError: 'Godkend tag ændringer før næste runde genereres.' };
  }

  let working = resetCompletedRoleCycles(state);
  const activeEntries = getActiveEntries(working);
  if (activeEntries.length < 2) {
    return { ...working, lastGenerationError: 'Der er ikke nok aktive deltagere til at generere en runde.' };
  }

  const result = working.teammateMode === 'fixed'
    ? generateFixedMatches(working, activeEntries)
    : generateChangingMatches(working, activeEntries);

  if (result.error) {
    return { ...working, lastGenerationError: result.error };
  }

  const withMatches = assignLanes({
    ...working,
    matches: result.matches,
    skippedPlayerIds: working.teammateMode === 'fixed' ? [] : result.skippedIds,
    skippedTeamIds: working.teammateMode === 'fixed' ? result.skippedIds : [],
    spectatorOverride: null,
    lastGenerationError: ''
  });

  return assignAutomaticTags(withMatches);
}

export function assignMatchLane(state, matchId, laneNumber) {
  const normalizedLane = Number.isInteger(Number(laneNumber)) ? Number(laneNumber) : null;
  if (normalizedLane && !state.activeLanes.includes(normalizedLane)) {
    return { ...state, lastGenerationError: 'Banen er inaktiv og kan ikke vælges til en igangværende kamp.' };
  }
  return {
    ...state,
    matches: state.matches.map(match => {
      if (match.id === matchId) return { ...match, laneNumber: normalizedLane };
      if (normalizedLane && match.winner == null && match.laneNumber === normalizedLane) return { ...match, laneNumber: null };
      return match;
    }),
    lastGenerationError: ''
  };
}

export function selectWinner(state, matchId, winner) {
  return {
    ...state,
    matches: state.matches.map(match => match.id === matchId ? { ...match, winner } : match),
    lastGenerationError: ''
  };
}

export function completeRound(state) {
  const entries = getEntries(state);
  const losers = new Set();

  state.matches.forEach(match => {
    if (match.winner !== 1 && match.winner !== 2) return;
    const ids = match.winner === 1 ? getSideIds(match, 2) : getSideIds(match, 1);
    ids.forEach(id => losers.add(id));
  });

  const updateEntry = entry => {
    let next = entry;
    if (losers.has(entry.id)) {
      const losses = (entry.losses || 0) + 1;
      next = {
        ...entry,
        losses,
        active: losses < state.maxLosses,
        eliminationRound: losses >= state.maxLosses ? state.currentRound : entry.eliminationRound
      };
    }
    const skippedIds = state.teammateMode === 'fixed' ? state.skippedTeamIds : state.skippedPlayerIds;
    if (skippedIds.includes(entry.id)) {
      next = { ...next, lastSkippedRound: state.currentRound };
    }
    return next;
  };

  const history = {
    round: state.currentRound,
    mode: state.teammateMode,
    matches: state.matches.map(match => ({
      id: match.id,
      laneNumber: Number.isInteger(match.laneNumber) ? match.laneNumber : null,
      team1Label: getMatchLabel(state, match, 1),
      team2Label: getMatchLabel(state, match, 2),
      winner: match.winner,
      winnerLabel: match.winner ? getMatchLabel(state, match, match.winner) : ''
    })),
    sitOuts: getSkippedEntries(state).map(entry => entry.name)
  };

  const fairness = recordFairnessRound(state);
  const nextState = {
    ...state,
    players: state.teammateMode === 'fixed' ? state.players : state.players.map(updateEntry),
    fixedTeams: state.teammateMode === 'fixed' ? state.fixedTeams.map(updateEntry) : state.fixedTeams,
    roundHistory: [...(state.roundHistory || []), history],
    matches: [],
    skippedPlayerIds: [],
    skippedTeamIds: [],
    spectatorOverride: null,
    fairnessHistory: fairness.fairnessHistory,
    lastRoundPartnerKeys: fairness.lastRoundPartnerKeys,
    lastRoundOpponentKeys: fairness.lastRoundOpponentKeys,
    lastGenerationError: ''
  };

  const remaining = getActiveEntries(nextState);
  if (remaining.length <= 1) {
    return {
      ...nextState,
      finalResultPlayerIds: nextState.teammateMode === 'fixed' ? null : remaining.map(entry => entry.id),
      finalResultTeamIds: nextState.teammateMode === 'fixed' ? remaining.map(entry => entry.id) : null,
      finalResults: remaining.map((entry, index) => ({ id: entry.id, name: entry.name, place: index + 1 }))
    };
  }

  return { ...nextState, currentRound: nextState.currentRound + 1 };
}

export function startFinalMatch(state) {
  if (!state.started || state.finalResults || state.matches.length > 0) return state;
  const active = getActiveEntries(state);
  if (active.length < 2 || active.length > 5) return state;
  return {
    ...state,
    matches: [],
    skippedPlayerIds: [],
    skippedTeamIds: [],
    spectatorOverride: null,
    lastGenerationError: ''
  };
}

export function completeFinal(state, orderedIds) {
  const active = getActiveEntries(state);
  const activeIds = new Set(active.map(entry => entry.id));
  const ordered = Array.isArray(orderedIds)
    ? orderedIds.map(Number).filter(id => activeIds.has(id))
    : [];
  const missing = active.filter(entry => !ordered.includes(entry.id)).map(entry => entry.id);
  const finalIds = [...ordered, ...missing];
  const finalSet = new Set(finalIds);
  const results = finalIds.map((id, index) => {
    const entry = active.find(item => item.id === id);
    return { id, name: entry?.name || String(id), place: index + 1 };
  });
  const update = entry => finalSet.has(entry.id)
    ? { ...entry, active: entry.id === finalIds[0], eliminationRound: entry.id === finalIds[0] ? entry.eliminationRound : 'final' }
    : entry;

  return {
    ...state,
    players: state.teammateMode === 'fixed' ? state.players : state.players.map(update),
    fixedTeams: state.teammateMode === 'fixed' ? state.fixedTeams.map(update) : state.fixedTeams,
    finalResultPlayerIds: state.teammateMode === 'fixed' ? null : finalIds,
    finalResultTeamIds: state.teammateMode === 'fixed' ? finalIds : null,
    finalResults: results,
    matches: [],
    skippedPlayerIds: [],
    skippedTeamIds: [],
    spectatorOverride: null,
    lastGenerationError: ''
  };
}

export function showStandingsOverride(state, durationMs = 30000) {
  return {
    ...state,
    spectatorOverride: {
      mode: 'standings',
      round: state.currentRound,
      durationMs,
      expiresAt: Date.now() + durationMs
    }
  };
}

export function resetTournament() {
  return createDefaultTournamentState();
}

export function getMatchLabel(state, match, side) {
  if (match.mode === 'fixed') {
    const id = side === 1 ? match.team1TeamId : match.team2TeamId;
    return state.fixedTeams.find(team => team.id === id)?.name || `Team ${side}`;
  }
  const ids = side === 1 ? match.team1PlayerIds : match.team2PlayerIds;
  return ids.map(id => state.players.find(player => player.id === id)?.name).filter(Boolean).join(', ');
}

export function getSkippedEntries(state) {
  const ids = state.teammateMode === 'fixed' ? state.skippedTeamIds : state.skippedPlayerIds;
  const entries = getEntries(state);
  return ids.map(id => entries.find(entry => entry.id === id)).filter(Boolean);
}

export function getSortedStandings(state) {
  return [...getEntries(state)].sort((left, right) => {
    if ((left.active !== false) !== (right.active !== false)) return left.active !== false ? -1 : 1;
    if ((left.active !== false) && (right.active !== false) && (left.losses || 0) !== (right.losses || 0)) return (left.losses || 0) - (right.losses || 0);
    if (left.active === false && right.active === false) return eliminationSortValue(right.eliminationRound) - eliminationSortValue(left.eliminationRound);
    return (left.id || 0) - (right.id || 0);
  });
}

function generateFixedMatches(state, activeTeams) {
  let best = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < MAX_SHUFFLE_ATTEMPTS; attempt++) {
    const shuffled = shuffle(activeTeams);
    const pairs = [];
    const skipped = [];
    while (shuffled.length > 1) pairs.push([shuffled.shift(), shuffled.shift()]);
    if (shuffled.length === 1) skipped.push(shuffled[0]);
    const skipPenalty = skipped.some(team => team.lastSkippedRound === state.currentRound - 1) ? 20000 : 0;
    const penalty = getFixedRoundFairnessPenalty(state, pairs) + getFixedRolePenalty(skipped, activeTeams) + skipPenalty;
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = { pairs, skipped };
    }
    if (penalty === 0) break;
  }
  if (!best) return { error: 'Kunne ikke generere holdkampe. Prøv igen.' };
  return {
    matches: best.pairs.map(([team1, team2], index) => ({ id: index + 1, mode: 'fixed', team1TeamId: team1.id, team2TeamId: team2.id, winner: null, laneNumber: null })),
    skippedIds: best.skipped.map(team => team.id)
  };
}

function generateChangingMatches(state, activePlayers) {
  let best = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < MAX_SHUFFLE_ATTEMPTS; attempt++) {
    const shuffled = shuffle(activePlayers);
    const pairs = [];
    const skipped = [];
    while (shuffled.length >= 4) {
      pairs.push([[shuffled.shift(), shuffled.shift()], [shuffled.shift(), shuffled.shift()]]);
    }
    if (shuffled.length === 3) {
      const option = buildThreePlayerRemainderAssignments(shuffled, state, activePlayers)[0];
      if (!option) continue;
      pairs.push(...option.teams);
      skipped.push(...option.skippedPlayers);
    } else if (shuffled.length === 2) {
      pairs.push([[shuffled[0]], [shuffled[1]]]);
    } else if (shuffled.length === 1) {
      skipped.push(shuffled[0]);
    }
    const skipPenalty = skipped.some(player => player.lastSkippedRound === state.currentRound - 1) ? 20000 : 0;
    const penalty = getChangingRoundFairnessPenalty(state, pairs) + getChangingRolePenalty(pairs, skipped, activePlayers) + skipPenalty;
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = { pairs, skipped };
    }
    if (penalty === 0) break;
  }
  if (!best) return { error: 'Kunne ikke generere gyldige kampe. Tjek tags og aktive spillere.' };
  return {
    matches: best.pairs.map(([team1, team2], index) => ({
      id: index + 1,
      mode: 'changing',
      team1PlayerIds: team1.map(player => player.id),
      team2PlayerIds: team2.map(player => player.id),
      winner: null,
      laneNumber: null
    })),
    skippedIds: best.skipped.map(player => player.id)
  };
}

function buildThreePlayerRemainderAssignments(players, state, activePlayers) {
  return players.map(skipPlayer => {
    const pair = players.filter(player => player.id !== skipPlayer.id);
    const teams = [[[pair[0]], [pair[1]]]];
    const skippedPlayers = [skipPlayer];
    return {
      teams,
      skippedPlayers,
      penalty: getChangingRolePenalty(teams, skippedPlayers, activePlayers) + (skipPlayer.lastSkippedRound === state.currentRound - 1 ? 20000 : 0)
    };
  }).sort((left, right) => left.penalty - right.penalty);
}

function assignAutomaticTags(state) {
  if (state.teammateMode === 'fixed') {
    const activeBefore = getActiveEntries(state);
    const missingOBefore = activeBefore.filter(team => !team.tags.includes('O'));
    const skippedIds = new Set(state.skippedTeamIds);
    let preserveOIds = null;
    if (missingOBefore.length === 1 && skippedIds.has(missingOBefore[0].id)) {
      preserveOIds = new Set([missingOBefore[0].id]);
    }

    let fixedTeams = state.fixedTeams.map(team => {
      const tags = Array.isArray(team.tags) ? [...team.tags] : [];
      const modifiedTags = Array.isArray(team.modifiedTags) ? [...team.modifiedTags] : [];
      if (skippedIds.has(team.id) && !tags.includes('O')) tags.push('O');
      return {
        ...team,
        tags,
        modifiedTags: modifiedTags.filter(tag => tag !== 'O'),
        lastSkippedRound: skippedIds.has(team.id) ? state.currentRound : team.lastSkippedRound
      };
    });

    const activeAfterO = fixedTeams.filter(team => team.active !== false);
    if (preserveOIds) {
      fixedTeams = fixedTeams.map(team => team.active !== false && !preserveOIds.has(team.id) ? { ...team, tags: team.tags.filter(tag => tag !== 'O') } : team);
    } else if (activeAfterO.length > 0 && activeAfterO.every(team => team.tags.includes('O'))) {
      fixedTeams = fixedTeams.map(team => team.active !== false ? { ...team, tags: team.tags.filter(tag => tag !== 'O') } : team);
    }

    return { ...state, fixedTeams, pendingTagChanges: false };
  }

  const activeBefore = getActiveEntries(state);
  const missingSBefore = activeBefore.filter(player => !player.tags.includes('S'));
  const missingOBefore = activeBefore.filter(player => !player.tags.includes('O'));
  const oneVOneMatches = state.matches.filter(match => match.team1PlayerIds.length === 1 && match.team2PlayerIds.length === 1);
  const singleParticipantIds = new Set(oneVOneMatches.flatMap(match => [...match.team1PlayerIds, ...match.team2PlayerIds]));
  const skippedIds = new Set(state.skippedPlayerIds);

  let preserveSIds = null;
  if (missingSBefore.length === 1) {
    const missingId = missingSBefore[0].id;
    const decidingMatch = oneVOneMatches.find(match => match.team1PlayerIds.includes(missingId) || match.team2PlayerIds.includes(missingId));
    if (decidingMatch) preserveSIds = new Set([...decidingMatch.team1PlayerIds, ...decidingMatch.team2PlayerIds]);
  }

  let preserveOIds = null;
  if (missingOBefore.length === 1 && skippedIds.has(missingOBefore[0].id)) {
    preserveOIds = new Set([missingOBefore[0].id]);
  }

  let players = state.players.map(player => {
    const tags = Array.isArray(player.tags) ? [...player.tags] : [];
    const modifiedTags = Array.isArray(player.modifiedTags) ? [...player.modifiedTags] : [];
    if (singleParticipantIds.has(player.id) && !tags.includes('S')) tags.push('S');
    if (skippedIds.has(player.id) && !tags.includes('O')) tags.push('O');
    return {
      ...player,
      tags,
      modifiedTags: modifiedTags.filter(tag => tag !== 'S' && tag !== 'O'),
      lastSkippedRound: skippedIds.has(player.id) ? state.currentRound : player.lastSkippedRound
    };
  });

  const activeAfterS = players.filter(player => player.active !== false);
  if (preserveSIds) {
    players = players.map(player => player.active !== false && !preserveSIds.has(player.id) ? { ...player, tags: player.tags.filter(tag => tag !== 'S') } : player);
  } else if (activeAfterS.length > 0 && activeAfterS.every(player => player.tags.includes('S'))) {
    players = players.map(player => player.active !== false ? { ...player, tags: player.tags.filter(tag => tag !== 'S') } : player);
  }

  const activeAfterO = players.filter(player => player.active !== false);
  if (preserveOIds) {
    players = players.map(player => player.active !== false && !preserveOIds.has(player.id) ? { ...player, tags: player.tags.filter(tag => tag !== 'O') } : player);
  } else if (activeAfterO.length > 0 && activeAfterO.every(player => player.tags.includes('O'))) {
    players = players.map(player => player.active !== false ? { ...player, tags: player.tags.filter(tag => tag !== 'O') } : player);
  }

  return { ...state, players, pendingTagChanges: false };
}

function resetCompletedRoleCycles(state) {
  if (state.teammateMode === 'fixed') {
    const activeTeams = state.fixedTeams.filter(team => team.active !== false);
    if (!activeTeams.length || !activeTeams.every(team => team.tags.includes('O'))) return state;
    return {
      ...state,
      fixedTeams: state.fixedTeams.map(team => team.active === false ? team : {
        ...team,
        tags: team.tags.filter(tag => tag !== 'O'),
        modifiedTags: []
      })
    };
  }

  const active = state.players.filter(player => player.active !== false);
  if (!active.length) return state;
  const allHaveS = active.every(player => player.tags.includes('S'));
  const allHaveO = active.every(player => player.tags.includes('O'));
  if (!allHaveS && !allHaveO) return state;
  return {
    ...state,
    players: state.players.map(player => {
      if (player.active === false) return player;
      return {
        ...player,
        tags: player.tags.filter(tag => (allHaveS && tag === 'S') || (allHaveO && tag === 'O') ? false : true),
        modifiedTags: []
      };
    })
  };
}

function assignLanes(state) {
  const lanes = state.activeLanes.length ? state.activeLanes : [1];
  return {
    ...state,
    matches: state.matches.map((match, index) => ({ ...match, laneNumber: lanes[index] ?? null }))
  };
}

function getChangingRolePenalty(teams, skippedPlayers, activePlayers) {
  const missingS = activePlayers.filter(player => !player.tags.includes('S'));
  const missingO = activePlayers.filter(player => !player.tags.includes('O'));
  const oneVOneParticipants = teams.flatMap(([team1, team2]) => team1.length === 1 && team2.length === 1 ? [...team1, ...team2] : []);
  const playersReceivingS = oneVOneParticipants.filter(player => !player.tags.includes('S')).length;
  const playersReceivingO = skippedPlayers.filter(player => !player.tags.includes('O')).length;
  const missedS = Math.max(0, Math.min(2, missingS.length) - playersReceivingS);
  const missedO = Math.max(0, Math.min(skippedPlayers.length, missingO.length) - playersReceivingO);
  const alreadyTaggedSingles = oneVOneParticipants.filter(player => player.tags.includes('S')).length;
  const alreadyTaggedSkipped = skippedPlayers.filter(player => player.tags.includes('O')).length;
  return missedS * 5000 + missedO * 5000 + alreadyTaggedSingles * 120 + alreadyTaggedSkipped * 120;
}

function getFixedRolePenalty(skippedTeams, activeTeams) {
  const missingO = activeTeams.filter(team => !team.tags.includes('O'));
  const teamsReceivingO = skippedTeams.filter(team => !team.tags.includes('O')).length;
  const missedO = Math.max(0, Math.min(skippedTeams.length, missingO.length) - teamsReceivingO);
  const alreadyTaggedSkipped = skippedTeams.filter(team => team.tags.includes('O')).length;
  return missedO * 5000 + alreadyTaggedSkipped * 120;
}

function getChangingRoundFairnessPenalty(state, teams) {
  const previousPartners = new Set(state.lastRoundPartnerKeys || []);
  const previousOpponents = new Set(state.lastRoundOpponentKeys || []);
  let penalty = 0;
  teams.forEach(([team1, team2]) => {
    [team1, team2].forEach(team => {
      if (team.length === 2) {
        const key = pairKey(playerFairnessId(team[0].id), playerFairnessId(team[1].id));
        penalty += getPairCount(state, 'partners', key) * 220;
        if (previousPartners.has(key)) penalty += 650;
      }
    });
    team1.forEach(left => team2.forEach(right => {
      const key = pairKey(playerFairnessId(left.id), playerFairnessId(right.id));
      penalty += getPairCount(state, 'opponents', key) * 90;
      if (previousOpponents.has(key)) penalty += 320;
    }));
  });
  return penalty;
}

function getFixedRoundFairnessPenalty(state, matchups) {
  const previousOpponents = new Set(state.lastRoundOpponentKeys || []);
  return matchups.reduce((penalty, [team1, team2]) => {
    const key = pairKey(teamFairnessId(team1.id), teamFairnessId(team2.id));
    return penalty + getPairCount(state, 'opponents', key) * 280 + (previousOpponents.has(key) ? 750 : 0);
  }, 0);
}

function recordFairnessRound(state) {
  const fairnessHistory = normalizeFairnessHistory(state.fairnessHistory);
  const partnerKeys = [];
  const opponentKeys = [];
  const increment = (type, idA, idB) => {
    const key = pairKey(idA, idB);
    fairnessHistory[type][key] = (fairnessHistory[type][key] || 0) + 1;
    return key;
  };

  state.matches.forEach(match => {
    if (match.mode === 'fixed') {
      opponentKeys.push(increment('opponents', teamFairnessId(match.team1TeamId), teamFairnessId(match.team2TeamId)));
      return;
    }
    const team1 = match.team1PlayerIds || [];
    const team2 = match.team2PlayerIds || [];
    if (team1.length === 2) partnerKeys.push(increment('partners', playerFairnessId(team1[0]), playerFairnessId(team1[1])));
    if (team2.length === 2) partnerKeys.push(increment('partners', playerFairnessId(team2[0]), playerFairnessId(team2[1])));
    team1.forEach(left => team2.forEach(right => opponentKeys.push(increment('opponents', playerFairnessId(left), playerFairnessId(right)))));
  });

  return { fairnessHistory, lastRoundPartnerKeys: partnerKeys, lastRoundOpponentKeys: opponentKeys };
}

function getPairCount(state, type, key) {
  return Number(state.fairnessHistory?.[type]?.[key]) || 0;
}

function getSideIds(match, side) {
  if (match.mode === 'fixed') return [side === 1 ? match.team1TeamId : match.team2TeamId];
  return side === 1 ? match.team1PlayerIds : match.team2PlayerIds;
}

function resetProgress(entry) {
  return {
    ...entry,
    losses: 0,
    active: true,
    tags: Array.isArray(entry.tags) ? [] : entry.tags,
    modifiedTags: Array.isArray(entry.modifiedTags) ? [] : entry.modifiedTags,
    eliminationRound: null,
    lastSkippedRound: null
  };
}

function normalizePlayer(player) {
  if (!player || typeof player.name !== 'string') return null;
  return {
    id: Number(player.id),
    name: player.name,
    losses: Number(player.losses) || 0,
    active: player.active !== false,
    tags: Array.isArray(player.tags) ? player.tags.filter(tag => tag === 'S' || tag === 'O') : [],
    modifiedTags: Array.isArray(player.modifiedTags) ? player.modifiedTags.filter(tag => tag === 'S' || tag === 'O') : [],
    eliminationRound: player.eliminationRound ?? null,
    lastSkippedRound: Number.isInteger(Number(player.lastSkippedRound)) ? Number(player.lastSkippedRound) : null
  };
}

function normalizeTeam(team) {
  if (!team || typeof team.memberOne !== 'string' || typeof team.memberTwo !== 'string') return null;
  return {
    id: Number(team.id),
    memberOne: team.memberOne,
    memberTwo: team.memberTwo,
    name: team.name || `${team.memberOne} / ${team.memberTwo}`,
    losses: Number(team.losses) || 0,
    active: team.active !== false,
    tags: Array.isArray(team.tags) ? team.tags.filter(tag => tag === 'O') : [],
    modifiedTags: Array.isArray(team.modifiedTags) ? team.modifiedTags.filter(tag => tag === 'O') : [],
    eliminationRound: team.eliminationRound ?? null,
    lastSkippedRound: Number.isInteger(Number(team.lastSkippedRound)) ? Number(team.lastSkippedRound) : null
  };
}

function normalizeMatch(match) {
  if (!match || !Number.isInteger(Number(match.id))) return null;
  if (match.mode === 'fixed') {
    return {
      id: Number(match.id),
      mode: 'fixed',
      team1TeamId: Number(match.team1TeamId),
      team2TeamId: Number(match.team2TeamId),
      winner: match.winner === 1 || match.winner === 2 ? match.winner : null,
      laneNumber: Number.isInteger(Number(match.laneNumber)) ? Number(match.laneNumber) : null
    };
  }
  return {
    id: Number(match.id),
    mode: 'changing',
    team1PlayerIds: Array.isArray(match.team1PlayerIds) ? match.team1PlayerIds.map(Number).filter(Number.isInteger) : [],
    team2PlayerIds: Array.isArray(match.team2PlayerIds) ? match.team2PlayerIds.map(Number).filter(Number.isInteger) : [],
    winner: match.winner === 1 || match.winner === 2 ? match.winner : null,
    laneNumber: Number.isInteger(Number(match.laneNumber)) ? Number(match.laneNumber) : null
  };
}

function normalizeFairnessHistory(value) {
  return value && typeof value === 'object'
    ? { partners: { ...(value.partners || {}) }, opponents: { ...(value.opponents || {}) } }
    : { partners: {}, opponents: {} };
}

function pairKey(idA, idB) {
  return [idA, idB].sort().join('|');
}

function playerFairnessId(id) {
  return `player-${id}`;
}

function teamFairnessId(id) {
  return `team-${id}`;
}

function nextId(collection) {
  return collection.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function eliminationSortValue(value) {
  if (value === 'final') return Number.MAX_SAFE_INTEGER;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}
