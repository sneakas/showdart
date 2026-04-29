const MAX_SHUFFLE_ATTEMPTS = 80;

export function createDefaultTournamentState() {
  return {
    version: 3,
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
    fairnessHistory: { partners: {}, opponents: {} },
    lastRoundPartnerKeys: [],
    lastRoundOpponentKeys: []
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
    currentRound: Number.isInteger(state.currentRound) ? state.currentRound : 0,
    started: !!state.started,
    pendingTagChanges: !!state.pendingTagChanges,
    roundHistory: Array.isArray(state.roundHistory) ? state.roundHistory : [],
    matches: Array.isArray(state.matches) ? state.matches.map(normalizeMatch).filter(Boolean) : [],
    skippedPlayerIds: Array.isArray(state.skippedPlayerIds) ? state.skippedPlayerIds.map(Number).filter(Number.isInteger) : [],
    skippedTeamIds: Array.isArray(state.skippedTeamIds) ? state.skippedTeamIds.map(Number).filter(Number.isInteger) : [],
    finalResultPlayerIds: Array.isArray(state.finalResultPlayerIds) ? state.finalResultPlayerIds.map(Number).filter(Number.isInteger) : null,
    finalResultTeamIds: Array.isArray(state.finalResultTeamIds) ? state.finalResultTeamIds.map(Number).filter(Number.isInteger) : null,
    fairnessHistory: state.fairnessHistory && typeof state.fairnessHistory === 'object' ? state.fairnessHistory : base.fairnessHistory,
    lastRoundPartnerKeys: Array.isArray(state.lastRoundPartnerKeys) ? state.lastRoundPartnerKeys : [],
    lastRoundOpponentKeys: Array.isArray(state.lastRoundOpponentKeys) ? state.lastRoundOpponentKeys : []
  };
}

export function getEntries(state) {
  return state.teammateMode === 'fixed' ? state.fixedTeams : state.players;
}

export function getActiveEntries(state) {
  return getEntries(state).filter(entry => entry.active !== false);
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
    }]
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
      eliminationRound: null,
      lastSkippedRound: null
    }]
  };
}

export function removeEntry(state, id) {
  return state.teammateMode === 'fixed'
    ? { ...state, fixedTeams: state.fixedTeams.filter(team => team.id !== id) }
    : { ...state, players: state.players.filter(player => player.id !== id) };
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
    ? { ...state, fixedTeams: state.fixedTeams.map(update) }
    : { ...state, players: state.players.map(update) };
}

export function configureTournament(state, patch) {
  const laneCount = clampNumber(patch.laneCount ?? state.laneCount, 1, 32, state.laneCount);
  return {
    ...state,
    tournamentName: String(patch.tournamentName ?? state.tournamentName ?? '').trim(),
    teammateMode: patch.teammateMode === 'fixed' ? 'fixed' : 'changing',
    maxLosses: clampNumber(patch.maxLosses ?? state.maxLosses, 1, 20, state.maxLosses),
    laneCount,
    activeLanes: Array.from({ length: laneCount }, (_, index) => index + 1)
  };
}

export function startTournament(state, patch = {}) {
  const configured = configureTournament(state, patch);
  return {
    ...configured,
    started: true,
    currentRound: 1,
    matches: [],
    skippedPlayerIds: [],
    skippedTeamIds: [],
    finalResultPlayerIds: null,
    finalResultTeamIds: null,
    roundHistory: [],
    spectatorOverride: null,
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
  return { ...state, activeLanes: [...activeSet].sort((a, b) => a - b) };
}

export function generateMatches(state) {
  const activeEntries = getActiveEntries(state);
  if (activeEntries.length < 2) return state;
  const { matches, skippedIds } = state.teammateMode === 'fixed'
    ? generateFixedMatches(state, activeEntries)
    : generateChangingMatches(state, activeEntries);
  return assignLanes({
    ...state,
    matches,
    skippedPlayerIds: state.teammateMode === 'fixed' ? [] : skippedIds,
    skippedTeamIds: state.teammateMode === 'fixed' ? skippedIds : [],
    spectatorOverride: null
  });
}

export function assignMatchLane(state, matchId, laneNumber) {
  const normalizedLane = Number.isInteger(Number(laneNumber)) ? Number(laneNumber) : null;
  const activeLanes = normalizedLane && !state.activeLanes.includes(normalizedLane)
    ? [...state.activeLanes, normalizedLane].sort((a, b) => a - b)
    : state.activeLanes;
  return {
    ...state,
    activeLanes,
    matches: state.matches.map(match => {
      if (match.id === matchId) return { ...match, laneNumber: normalizedLane };
      if (normalizedLane && match.winner == null && match.laneNumber === normalizedLane) return { ...match, laneNumber: null };
      return match;
    })
  };
}

export function selectWinner(state, matchId, winner) {
  return {
    ...state,
    matches: state.matches.map(match => match.id === matchId ? { ...match, winner } : match)
  };
}

export function completeRound(state) {
  const entries = getEntries(state);
  const entryMap = new Map(entries.map(entry => [entry.id, entry]));
  const losers = new Set();

  state.matches.forEach(match => {
    const ids = match.winner === 1 ? getSideIds(match, 2) : getSideIds(match, 1);
    ids.forEach(id => losers.add(id));
  });

  const updateEntry = entry => {
    if (!losers.has(entry.id)) return entry;
    const losses = (entry.losses || 0) + 1;
    return {
      ...entry,
      losses,
      active: losses < state.maxLosses,
      eliminationRound: losses >= state.maxLosses ? state.currentRound : entry.eliminationRound
    };
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

  const nextState = {
    ...state,
    players: state.teammateMode === 'fixed' ? state.players : state.players.map(updateEntry),
    fixedTeams: state.teammateMode === 'fixed' ? state.fixedTeams.map(updateEntry) : state.fixedTeams,
    roundHistory: [...(state.roundHistory || []), history],
    matches: [],
    skippedPlayerIds: [],
    skippedTeamIds: [],
    spectatorOverride: null
  };

  const remaining = getActiveEntries(nextState);
  if (remaining.length <= 1) {
    return {
      ...nextState,
      finalResultPlayerIds: nextState.teammateMode === 'fixed' ? null : remaining.map(entry => entry.id),
      finalResultTeamIds: nextState.teammateMode === 'fixed' ? remaining.map(entry => entry.id) : null
    };
  }

  return { ...nextState, currentRound: nextState.currentRound + 1 };
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

function generateFixedMatches(_state, activeTeams) {
  const shuffled = shuffle(activeTeams);
  const matches = [];
  const skippedIds = [];
  while (shuffled.length > 1) {
    const team1 = shuffled.shift();
    const team2 = shuffled.shift();
    matches.push({
      id: matches.length + 1,
      mode: 'fixed',
      team1TeamId: team1.id,
      team2TeamId: team2.id,
      winner: null,
      laneNumber: null
    });
  }
  if (shuffled.length === 1) skippedIds.push(shuffled[0].id);
  return { matches, skippedIds };
}

function generateChangingMatches(state, activePlayers) {
  let best = null;
  for (let attempt = 0; attempt < MAX_SHUFFLE_ATTEMPTS; attempt++) {
    const shuffled = shuffle(activePlayers);
    const matches = [];
    const skippedIds = [];
    while (shuffled.length >= 4) {
      matches.push({
        id: matches.length + 1,
        mode: 'changing',
        team1PlayerIds: [shuffled.shift().id, shuffled.shift().id],
        team2PlayerIds: [shuffled.shift().id, shuffled.shift().id],
        winner: null,
        laneNumber: null
      });
    }
    if (shuffled.length === 3) {
      const skipCandidate = pickSkipCandidate(shuffled, state.currentRound);
      skippedIds.push(skipCandidate.id);
      const pair = shuffled.filter(player => player.id !== skipCandidate.id);
      matches.push({
        id: matches.length + 1,
        mode: 'changing',
        team1PlayerIds: [pair[0].id],
        team2PlayerIds: [pair[1].id],
        winner: null,
        laneNumber: null
      });
    } else if (shuffled.length === 2) {
      matches.push({
        id: matches.length + 1,
        mode: 'changing',
        team1PlayerIds: [shuffled[0].id],
        team2PlayerIds: [shuffled[1].id],
        winner: null,
        laneNumber: null
      });
    } else if (shuffled.length === 1) {
      if (shuffled[0].lastSkippedRound !== state.currentRound - 1) skippedIds.push(shuffled[0].id);
    }
    best = { matches, skippedIds };
    if (skippedIds.length === 0 || !skippedIds.some(id => activePlayers.find(player => player.id === id)?.lastSkippedRound === state.currentRound - 1)) break;
  }
  return best || { matches: [], skippedIds: [] };
}

function assignLanes(state) {
  const lanes = state.activeLanes.length ? state.activeLanes : [1];
  return {
    ...state,
    matches: state.matches.map((match, index) => ({ ...match, laneNumber: lanes[index] ?? null }))
  };
}

function pickSkipCandidate(players, currentRound) {
  return [...players].sort((a, b) => {
    const aPenalty = a.lastSkippedRound === currentRound - 1 ? 1000 : 0;
    const bPenalty = b.lastSkippedRound === currentRound - 1 ? 1000 : 0;
    if (aPenalty !== bPenalty) return aPenalty - bPenalty;
    return (a.losses || 0) - (b.losses || 0);
  })[0];
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
    tags: Array.isArray(player.tags) ? player.tags : [],
    modifiedTags: Array.isArray(player.modifiedTags) ? player.modifiedTags : [],
    eliminationRound: player.eliminationRound ?? null,
    lastSkippedRound: Number.isInteger(player.lastSkippedRound) ? player.lastSkippedRound : null
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
    eliminationRound: team.eliminationRound ?? null,
    lastSkippedRound: Number.isInteger(team.lastSkippedRound) ? team.lastSkippedRound : null
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
      laneNumber: Number.isInteger(match.laneNumber) ? match.laneNumber : null
    };
  }
  return {
    id: Number(match.id),
    mode: 'changing',
    team1PlayerIds: Array.isArray(match.team1PlayerIds) ? match.team1PlayerIds.map(Number).filter(Number.isInteger) : [],
    team2PlayerIds: Array.isArray(match.team2PlayerIds) ? match.team2PlayerIds.map(Number).filter(Number.isInteger) : [],
    winner: match.winner === 1 || match.winner === 2 ? match.winner : null,
    laneNumber: Number.isInteger(match.laneNumber) ? match.laneNumber : null
  };
}

function nextId(collection) {
  return collection.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}
