const GROUP_PHASES = new Set(['initial_groups', 'ab_groups']);

export function createDefaultChampionshipState() {
  return {
    version: 1,
    tournamentName: '',
    phase: 'registration',
    started: false,
    config: {
      initialGroupCount: 2,
      initialAQualifiersPerGroup: 2,
      aGroupCount: 2,
      bGroupCount: 2,
      aPlayoffQualifiersPerGroup: 2,
      bPlayoffQualifiersPerGroup: 2,
      allocationMode: 'seeded',
      aPlayoffDrawMode: 'seeded',
      bPlayoffDrawMode: 'seeded',
      laneCount: 4
    },
    teams: [],
    groups: [],
    matches: [],
    activeMatchIds: [],
    activeLanes: [1, 2, 3, 4],
    stageRound: 0,
    roundPublished: false,
    stageComplete: false,
    adjustments: [],
    auditLog: [],
    brackets: { A: null, B: null },
    manualPlayoffSeeds: { A: [], B: [] },
    lastError: ''
  };
}

export function normalizeChampionshipState(input) {
  const base = createDefaultChampionshipState();
  const state = input && typeof input === 'object' ? input : {};
  const config = normalizeConfig({ ...base.config, ...(state.config || {}) });
  const teams = Array.isArray(state.teams) ? state.teams.map(normalizeTeam).filter(Boolean) : [];
  const teamIds = new Set(teams.map(team => team.id));
  const groups = Array.isArray(state.groups)
    ? state.groups.map(normalizeGroup).filter(Boolean).map(group => ({ ...group, teamIds: group.teamIds.filter(id => teamIds.has(id)) }))
    : [];
  const matches = Array.isArray(state.matches) ? state.matches.map(normalizeMatch).filter(Boolean) : [];
  const activeLanes = Array.isArray(state.activeLanes)
    ? [...new Set(state.activeLanes.map(Number).filter(lane => Number.isInteger(lane) && lane >= 1 && lane <= config.laneCount))]
    : Array.from({ length: config.laneCount }, (_, index) => index + 1);
  return {
    ...base,
    ...state,
    config,
    teams,
    groups,
    matches: normalizeLaneQueues(matches),
    activeMatchIds: Array.isArray(state.activeMatchIds) ? state.activeMatchIds.map(Number).filter(Number.isInteger) : [],
    activeLanes: activeLanes.length ? activeLanes : [1],
    stageRound: Number.isInteger(Number(state.stageRound)) ? Number(state.stageRound) : 0,
    roundPublished: !!state.roundPublished,
    stageComplete: !!state.stageComplete,
    adjustments: Array.isArray(state.adjustments) ? state.adjustments : [],
    auditLog: Array.isArray(state.auditLog) ? state.auditLog : [],
    brackets: { A: state.brackets?.A || null, B: state.brackets?.B || null },
    manualPlayoffSeeds: {
      A: Array.isArray(state.manualPlayoffSeeds?.A) ? state.manualPlayoffSeeds.A.map(Number) : [],
      B: Array.isArray(state.manualPlayoffSeeds?.B) ? state.manualPlayoffSeeds.B.map(Number) : []
    },
    lastError: typeof state.lastError === 'string' ? state.lastError : ''
  };
}

export function configureChampionship(state, patch = {}) {
  if (state.started) return { ...state, lastError: 'Opsætningen kan ikke ændres efter gruppespillet er startet.' };
  const config = normalizeConfig({ ...state.config, ...patch });
  return {
    ...state,
    tournamentName: String(patch.tournamentName ?? state.tournamentName ?? '').trim(),
    config,
    activeLanes: Array.from({ length: config.laneCount }, (_, index) => index + 1),
    lastError: ''
  };
}

export function updateChampionshipQualificationSettings(state, patch = {}) {
  if (['playoffs', 'finished'].includes(state.phase)) return { ...state, lastError: 'Kvalifikationsregler kan ikke ændres efter slutspillet er startet.' };
  const config = normalizeConfig({
    ...state.config,
    aPlayoffQualifiersPerGroup: patch.aPlayoffQualifiersPerGroup ?? state.config.aPlayoffQualifiersPerGroup,
    bPlayoffQualifiersPerGroup: patch.bPlayoffQualifiersPerGroup ?? state.config.bPlayoffQualifiersPerGroup,
    aPlayoffDrawMode: patch.aPlayoffDrawMode ?? state.config.aPlayoffDrawMode,
    bPlayoffDrawMode: patch.bPlayoffDrawMode ?? state.config.bPlayoffDrawMode
  });
  return withAudit({ ...state, config, lastError: '' }, 'qualification_settings_updated', {
    aPlayoffQualifiersPerGroup: config.aPlayoffQualifiersPerGroup,
    bPlayoffQualifiersPerGroup: config.bPlayoffQualifiersPerGroup,
    aPlayoffDrawMode: config.aPlayoffDrawMode,
    bPlayoffDrawMode: config.bPlayoffDrawMode
  });
}

export function addChampionshipTeam(state, memberOne, memberTwo, options = {}) {
  const one = String(memberOne || '').trim();
  const two = String(memberTwo || '').trim();
  if (!one || !two) return { ...state, lastError: 'Begge spillernavne er påkrævet.' };
  const id = nextNumericId(state.teams);
  const team = {
    id,
    memberOne: one,
    memberTwo: two,
    name: `${one} / ${two}`,
    seed: Number(options.seed) || id,
    active: true,
    withdrawn: false,
    sourceGroupId: null
  };
  let next = { ...state, teams: [...state.teams, team], lastError: '' };
  if (state.started && GROUP_PHASES.has(state.phase)) {
    next = addTeamToActiveGroup(next, id, options.groupId);
  } else if (state.started) {
    return { ...state, lastError: 'Nye hold kan ikke tilføjes efter slutspillet er startet.' };
  }
  return withAudit(next, 'team_added', { teamId: id, name: team.name, groupId: options.groupId || null });
}

export function updateChampionshipTeam(state, teamId, patch = {}) {
  const id = Number(teamId);
  return withAudit({
    ...state,
    teams: state.teams.map(team => team.id === id ? {
      ...team,
      memberOne: String(patch.memberOne ?? team.memberOne).trim(),
      memberTwo: String(patch.memberTwo ?? team.memberTwo).trim(),
      name: patch.name ? String(patch.name).trim() : `${String(patch.memberOne ?? team.memberOne).trim()} / ${String(patch.memberTwo ?? team.memberTwo).trim()}`,
      seed: Number(patch.seed ?? team.seed) || team.seed
    } : team),
    lastError: ''
  }, 'team_updated', { teamId: id });
}

export function allocateInitialGroups(state, mode = state.config.allocationMode) {
  if (state.started) return { ...state, lastError: 'De første grupper er allerede oprettet.' };
  const activeTeams = state.teams.filter(team => !team.withdrawn);
  if (activeTeams.length < 4) return { ...state, lastError: 'Der skal være mindst 4 hold.' };
  const count = Math.max(1, Math.min(state.config.initialGroupCount, Math.floor(activeTeams.length / 2)));
  const ordered = orderTeams(activeTeams, mode);
  const allocations = allocateSnake(ordered.map(team => ({ teamId: team.id })), count);
  const groups = allocations.map((entries, index) => ({
    id: `I${index + 1}`,
    division: 'INITIAL',
    name: `Gruppe ${index + 1}`,
    teamIds: entries.map(entry => entry.teamId)
  }));
  const scheduled = scheduleGroups([], groups, 'initial', 1);
  let next = {
    ...state,
    started: true,
    phase: 'initial_groups',
    groups,
    matches: scheduled.matches,
    stageRound: 1,
    stageComplete: false,
    roundPublished: false,
    lastError: ''
  };
  next = activateGroupRound(next, 1);
  return withAudit(next, 'initial_groups_created', { groupCount: groups.length, mode });
}

export function swapTeamsBetweenGroups(state, firstTeamId, secondTeamId) {
  if (!GROUP_PHASES.has(state.phase)) return { ...state, lastError: 'Hold kan kun byttes i gruppespillet.' };
  if (state.matches.some(match => isStageMatch(state, match) && match.winnerId)) {
    return { ...state, lastError: 'Hold kan ikke byttes efter de første resultater i stadiet.' };
  }
  const firstId = Number(firstTeamId);
  const secondId = Number(secondTeamId);
  const firstGroup = state.groups.find(group => group.teamIds.includes(firstId));
  const secondGroup = state.groups.find(group => group.teamIds.includes(secondId));
  if (!firstGroup || !secondGroup || firstGroup.id === secondGroup.id) return { ...state, lastError: 'Vælg hold fra to forskellige grupper.' };
  const groups = state.groups.map(group => {
    if (group.id === firstGroup.id) return { ...group, teamIds: group.teamIds.map(id => id === firstId ? secondId : id) };
    if (group.id === secondGroup.id) return { ...group, teamIds: group.teamIds.map(id => id === secondId ? firstId : id) };
    return group;
  });
  const stageMatchesRemoved = state.matches.filter(match => !isStageMatch(state, match));
  const stageGroups = groups.filter(group => isCurrentPhaseGroup(state.phase, group));
  const stage = state.phase === 'initial_groups' ? 'initial' : null;
  let matches = stageMatchesRemoved;
  if (stage) {
    matches = scheduleGroups(matches, stageGroups, stage, nextMatchId(matches)).matches;
  } else {
    const aGroups = stageGroups.filter(group => group.division === 'A');
    const bGroups = stageGroups.filter(group => group.division === 'B');
    matches = scheduleGroups(matches, aGroups, 'a_group', nextMatchId(matches)).matches;
    matches = scheduleGroups(matches, bGroups, 'b_group', nextMatchId(matches)).matches;
  }
  let next = { ...state, groups, matches, stageRound: 1, roundPublished: false, lastError: '' };
  next = activateGroupRound(next, 1);
  return withAudit(next, 'teams_swapped', { firstTeamId: firstId, secondTeamId: secondId });
}

export function getGroupStandings(state, groupId) {
  const group = state.groups.find(item => item.id === groupId);
  if (!group) return [];
  const relevantMatches = state.matches.filter(match => match.groupId === groupId && !match.voided);
  const teamSet = new Set(group.teamIds);
  const stats = group.teamIds.map(teamId => {
    const team = state.teams.find(item => item.id === teamId);
    const completed = relevantMatches.filter(match => !match.isTieBreak && match.winnerId && (match.team1Id === teamId || match.team2Id === teamId));
    const wins = completed.filter(match => match.winnerId === teamId).length;
    const tieBreakWins = relevantMatches.filter(match => match.isTieBreak && match.winnerId === teamId).length;
    const completedMultiTieBreaks = relevantMatches.filter(match => (
      match.isMultiTeamTieBreak
      && isMatchResolved(match)
      && match.participantIds.includes(teamId)
    ));
    const multiTieBreakScore = completedMultiTieBreaks.reduce((score, match) => {
      const qualifierIndex = match.qualifierIds.indexOf(teamId);
      return score + (qualifierIndex >= 0 ? match.qualifierIds.length - qualifierIndex : 0);
    }, 0);
    const adjustment = state.adjustments.filter(item => item.teamId === teamId && item.groupId === groupId).reduce((sum, item) => sum + Number(item.points || 0), 0);
    return {
      teamId,
      name: team?.name || `Hold ${teamId}`,
      played: completed.length,
      wins,
      losses: completed.length - wins,
      points: wins * 2 + adjustment,
      adjustment,
      tieBreakWins,
      multiTieBreakScore,
      seed: team?.seed || 999
    };
  });
  const byPoints = new Map();
  stats.forEach(item => {
    const key = item.points;
    byPoints.set(key, [...(byPoints.get(key) || []), item.teamId]);
  });
  stats.forEach(item => {
    const tiedIds = new Set(byPoints.get(item.points) || []);
    item.miniWins = relevantMatches.filter(match => !match.isTieBreak && match.winnerId === item.teamId && tiedIds.has(match.team1Id) && tiedIds.has(match.team2Id)).length;
  });
  return stats
    .sort((left, right) => right.points - left.points || right.miniWins - left.miniWins || right.multiTieBreakScore - left.multiTieBreakScore || right.tieBreakWins - left.tieBreakWins || left.seed - right.seed || left.teamId - right.teamId)
    .map((item, index, all) => ({
      ...item,
      rank: index + 1,
      unresolvedTie: all.some(other => other.teamId !== item.teamId && other.points === item.points && other.miniWins === item.miniWins && other.multiTieBreakScore === item.multiTieBreakScore && other.tieBreakWins === item.tieBreakWins)
    }));
}

export function getCurrentMatches(state) {
  const active = new Set(state.activeMatchIds);
  return state.matches.filter(match => active.has(match.id)).sort((left, right) => (
    (Number(left.lanePosition) || 999) - (Number(right.lanePosition) || 999)
    || (Number(left.laneNumber) || 999) - (Number(right.laneNumber) || 999)
    || left.id - right.id
  ));
}

export function getChampionshipMatchStatus(state, matchId) {
  const match = state.matches.find(item => item.id === Number(matchId));
  if (!match) return 'unassigned';
  if (isMatchResolved(match) || match.isBye || match.voided) return 'completed';
  if (!Number.isInteger(match.laneNumber)) return 'unassigned';
  const active = getCurrentMatches(state).filter(item => item.laneNumber === match.laneNumber && !isMatchResolved(item) && !item.isBye && !item.voided);
  return active[0]?.id === match.id ? 'current' : 'queued';
}

export function assignChampionshipMatchLane(state, matchId, laneNumber) {
  const id = Number(matchId);
  const lane = Number.isInteger(Number(laneNumber)) ? Number(laneNumber) : null;
  if (lane && !state.activeLanes.includes(lane)) return { ...state, lastError: 'Banen er inaktiv.' };
  const targetPosition = lane
    ? Math.max(0, ...getCurrentMatches(state).filter(match => match.id !== id && match.laneNumber === lane).map(match => Number(match.lanePosition) || 0)) + 1
    : null;
  return {
    ...state,
    matches: normalizeLaneQueues(state.matches.map(match => match.id === id ? { ...match, laneNumber: lane, lanePosition: targetPosition } : match), new Set(state.activeMatchIds)),
    lastError: ''
  };
}

export function moveChampionshipMatchInQueue(state, matchId, direction) {
  const id = Number(matchId);
  const match = state.matches.find(item => item.id === id);
  if (!match || !state.activeMatchIds.includes(id) || !Number.isInteger(match.laneNumber)) return state;
  const queue = getCurrentMatches(state).filter(item => item.laneNumber === match.laneNumber).sort((a, b) => (a.lanePosition || 999) - (b.lanePosition || 999) || a.id - b.id);
  const index = queue.findIndex(item => item.id === id);
  const targetIndex = index + (Number(direction) < 0 ? -1 : 1);
  if (index < 0 || targetIndex < 0 || targetIndex >= queue.length) return state;
  const target = queue[targetIndex];
  if (isMatchResolved(match) || isMatchResolved(target)) return { ...state, lastError: 'Afsluttede kampe kan ikke flyttes.' };
  const positions = new Map(queue.map((item, queueIndex) => [item.id, queueIndex + 1]));
  positions.set(match.id, targetIndex + 1);
  positions.set(target.id, index + 1);
  return {
    ...state,
    matches: normalizeLaneQueues(state.matches.map(item => positions.has(item.id) ? { ...item, lanePosition: positions.get(item.id) } : item), new Set(state.activeMatchIds)),
    lastError: ''
  };
}

export function setChampionshipActiveLane(state, laneNumber, active) {
  const lane = Number(laneNumber);
  const lanes = new Set(state.activeLanes);
  if (active) lanes.add(lane);
  if (!active && lanes.size > 1) lanes.delete(lane);
  const activeLanes = [...lanes].sort((a, b) => a - b);
  let matches = state.matches.map(match => !active && state.activeMatchIds.includes(match.id) && match.laneNumber === lane
    ? { ...match, laneNumber: null, lanePosition: null }
    : match);
  const displaced = matches.filter(match => state.activeMatchIds.includes(match.id) && !isMatchResolved(match) && !match.isBye && !match.voided && !match.laneNumber);
  displaced.forEach((match, index) => {
    const targetLane = activeLanes[index % activeLanes.length];
    const position = Math.max(0, ...matches.filter(item => state.activeMatchIds.includes(item.id) && item.laneNumber === targetLane).map(item => Number(item.lanePosition) || 0)) + 1;
    matches = matches.map(item => item.id === match.id ? { ...item, laneNumber: targetLane, lanePosition: position } : item);
  });
  return { ...state, activeLanes, matches: normalizeLaneQueues(matches, new Set(state.activeMatchIds)), lastError: '' };
}

export function publishChampionshipRound(state) {
  const current = getCurrentMatches(state).filter(match => !match.isBye && !match.voided);
  if (!current.length) return { ...state, lastError: 'Der er ingen kampe at offentliggøre.' };
  if (current.some(match => !state.activeLanes.includes(match.laneNumber))) return { ...state, lastError: 'Alle kampe skal have en aktiv bane.' };
  return withAudit({ ...state, roundPublished: true, lastError: '' }, 'round_published', { phase: state.phase, round: state.stageRound });
}

export function hideChampionshipRound(state) {
  if (getCurrentMatches(state).some(isMatchResolved)) return { ...state, lastError: 'Runden kan ikke skjules efter et resultat er registreret.' };
  return withAudit({ ...state, roundPublished: false, lastError: '' }, 'round_hidden', { phase: state.phase, round: state.stageRound });
}

export function setChampionshipWinner(state, matchId, winnerId, reason = '') {
  const id = Number(matchId);
  const winner = Number(winnerId);
  const match = state.matches.find(item => item.id === id);
  if (!match) return state;
  if (match.isMultiTeamTieBreak) return { ...state, lastError: 'Vælg kvalificerede hold i tie-break feltet.' };
  if (!state.roundPublished && state.activeMatchIds.includes(id)) return { ...state, lastError: 'Offentliggør runden før resultater registreres.' };
  if (![match.team1Id, match.team2Id].includes(winner)) return { ...state, lastError: 'Ugyldig vinder.' };
  if (!match.winnerId && getChampionshipMatchStatus(state, id) === 'queued') return { ...state, lastError: 'Kampen står i kø.' };
  const previousWinnerId = match.winnerId || null;
  return withAudit({
    ...state,
    matches: state.matches.map(item => item.id === id ? { ...item, winnerId: winner } : item),
    lastError: ''
  }, previousWinnerId ? 'match_result_corrected' : 'match_result_added', { matchId: id, previousWinnerId, winnerId: winner, reason });
}

export function setChampionshipTieBreakQualifiers(state, matchId, qualifierIds, reason = '') {
  const id = Number(matchId);
  const match = state.matches.find(item => item.id === id);
  if (!match?.isMultiTeamTieBreak) return { ...state, lastError: 'Tie-break begivenheden blev ikke fundet.' };
  if (!state.roundPublished && state.activeMatchIds.includes(id)) return { ...state, lastError: 'Offentliggør runden før resultatet registreres.' };
  if (state.activeMatchIds.includes(id) && getChampionshipMatchStatus(state, id) === 'queued') return { ...state, lastError: 'Tie-break begivenheden står i kø.' };
  const participants = new Set(match.participantIds);
  const selected = [...new Set((Array.isArray(qualifierIds) ? qualifierIds : []).map(Number))].filter(teamId => participants.has(teamId));
  if (selected.length > match.qualifierCount) return { ...state, lastError: `Vælg højst ${match.qualifierCount} kvalificerede hold.` };
  const previousQualifierIds = match.qualifierIds;
  return withAudit({
    ...state,
    matches: state.matches.map(item => item.id === id ? { ...item, qualifierIds: selected } : item),
    lastError: ''
  }, previousQualifierIds.length === match.qualifierCount ? 'tiebreak_result_corrected' : 'tiebreak_result_updated', {
    matchId: id,
    previousQualifierIds,
    qualifierIds: selected,
    reason
  });
}

export function completeChampionshipRound(state) {
  const current = getCurrentMatches(state).filter(match => !match.isBye && !match.voided);
  if (!current.length || current.some(match => !isMatchResolved(match))) return { ...state, lastError: 'Alle aktuelle kampe og tie-breaks skal være afgjort.' };
  if (GROUP_PHASES.has(state.phase)) return completeGroupRound(state);
  if (state.phase === 'playoffs') return completePlayoffWave(state);
  return state;
}

export function generateRequiredTieBreaks(state) {
  if (!state.stageComplete || !GROUP_PHASES.has(state.phase)) return { ...state, lastError: 'Gruppestadiet skal være afsluttet først.' };
  const groups = state.groups.filter(group => isCurrentPhaseGroup(state.phase, group));
  const ties = groups.flatMap(group => {
    const count = qualifierCountForGroup(state, group);
    const boundaryTie = getBoundaryTie(state, group.id, count);
    return boundaryTie.teamIds.length > 1
      ? [{ group, ...boundaryTie }]
      : [];
  });
  if (!ties.length) return { ...state, lastError: 'Der er ingen uløste kvalifikationsties.' };
  let matches = [...state.matches];
  let id = nextMatchId(matches);
  const created = [];
  const existingOpenTieBreak = matches.some(match => match.isMultiTeamTieBreak && !isMatchResolved(match) && groups.some(group => group.id === match.groupId));
  if (existingOpenTieBreak) return { ...state, lastError: 'Den aktuelle tie-break skal afgøres først.' };
  const firstTieRound = Math.max(state.stageRound, ...matches.filter(match => match.isTieBreak).map(match => Number(match.round) || 0)) + 1;
  ties.forEach(({ group, teamIds, qualifierCount }) => {
    const match = {
      id: id++, stage: 'tiebreak', groupId: group.id, division: group.division,
      round: firstTieRound, team1Id: teamIds[0] || null, team2Id: teamIds[1] || null,
      participantIds: teamIds, qualifierCount, qualifierIds: [],
      winnerId: null, isTieBreak: true, isMultiTeamTieBreak: true, tieBreakCycle: Date.now(), laneNumber: null, lanePosition: null,
      published: false, voided: false, isBye: false, matchType: 'multi_tiebreak'
    };
    matches.push(match);
    created.push(match.id);
  });
  const firstActiveIds = matches.filter(match => created.includes(match.id) && match.round === firstTieRound).map(match => match.id);
  const assigned = assignLanesToMatches(matches, firstActiveIds, state.activeLanes);
  return withAudit({
    ...state,
    matches: assigned,
    activeMatchIds: firstActiveIds,
    stageRound: firstTieRound,
    stageComplete: false,
    roundPublished: false,
    lastError: ''
  }, 'tiebreaks_generated', { matchCount: created.length });
}

export function hasRequiredChampionshipTieBreaks(state) {
  if (!state.stageComplete || !GROUP_PHASES.has(state.phase)) return false;
  return state.groups
    .filter(group => isCurrentPhaseGroup(state.phase, group))
    .some(group => getBoundaryTieTeamIds(state, group.id, qualifierCountForGroup(state, group)).length > 1);
}

export function advanceToABGroups(state) {
  if (state.phase !== 'initial_groups' || !state.stageComplete) return { ...state, lastError: 'Det første gruppespil er ikke afsluttet.' };
  const initialGroups = state.groups.filter(group => group.division === 'INITIAL');
  if (initialGroups.some(group => getBoundaryTieTeamIds(state, group.id, state.config.initialAQualifiersPerGroup).length > 1)) {
    return { ...state, lastError: 'Generer og spil tie-break kampe for de uløste kvalifikationsplaceringer.' };
  }
  const aEntries = [];
  const bEntries = [];
  initialGroups.forEach(group => {
    const standings = getGroupStandings(state, group.id);
    standings.forEach((entry, index) => {
      const target = index < state.config.initialAQualifiersPerGroup ? aEntries : bEntries;
      target.push({ teamId: entry.teamId, placement: index + 1, points: entry.points, sourceGroupId: group.id });
    });
  });
  const aGroups = createSeededStageGroups(aEntries, state.config.aGroupCount, 'A');
  const bGroups = createSeededStageGroups(bEntries, state.config.bGroupCount, 'B');
  const previousGroups = state.groups;
  let matches = [...state.matches];
  matches = scheduleGroups(matches, aGroups, 'a_group', nextMatchId(matches)).matches;
  matches = scheduleGroups(matches, bGroups, 'b_group', nextMatchId(matches)).matches;
  let next = {
    ...state,
    phase: 'ab_groups',
    groups: [...previousGroups, ...aGroups, ...bGroups],
    matches,
    stageRound: 1,
    stageComplete: false,
    roundPublished: false,
    activeMatchIds: [],
    teams: state.teams.map(team => {
      const source = [...aEntries, ...bEntries].find(entry => entry.teamId === team.id);
      return source ? { ...team, sourceGroupId: source.sourceGroupId } : team;
    }),
    lastError: ''
  };
  next = activateGroupRound(next, 1);
  return withAudit(next, 'ab_groups_created', { aGroups: aGroups.length, bGroups: bGroups.length });
}

export function setPlayoffSeedOrder(state, division, teamIds) {
  const key = division === 'B' ? 'B' : 'A';
  return { ...state, manualPlayoffSeeds: { ...state.manualPlayoffSeeds, [key]: teamIds.map(Number) }, lastError: '' };
}

export function generateChampionshipPlayoffs(state) {
  if (state.phase !== 'ab_groups' || !state.stageComplete) return { ...state, lastError: 'A/B-gruppespillet er ikke afsluttet.' };
  const divisions = ['A', 'B'];
  for (const division of divisions) {
    const groups = state.groups.filter(group => group.division === division);
    const count = division === 'A' ? state.config.aPlayoffQualifiersPerGroup : state.config.bPlayoffQualifiersPerGroup;
    if (groups.some(group => getBoundaryTieTeamIds(state, group.id, count).length > 1)) {
      return { ...state, lastError: `Der er uløste kvalifikationsties i ${division}-grupperne.` };
    }
  }
  let matches = [...state.matches];
  let nextId = nextMatchId(matches);
  const brackets = { A: null, B: null };
  const activeIds = [];
  divisions.forEach(division => {
    const qualifiers = getDivisionQualifiers(state, division);
    if (qualifiers.length < 4) return;
    const mode = division === 'A' ? state.config.aPlayoffDrawMode : state.config.bPlayoffDrawMode;
    const ordered = orderPlayoffTeams(state, division, qualifiers, mode);
    const generated = createBracketFirstRound(division, ordered, nextId);
    nextId = generated.nextId;
    matches.push(...generated.matches);
    activeIds.push(...generated.matches.filter(match => !match.isBye).map(match => match.id));
    brackets[division] = generated.bracket;
  });
  if (!brackets.A || !brackets.B) return { ...state, lastError: 'Både A- og B-slutspillet kræver mindst 4 kvalificerede hold for semifinaler og kamp om 3. pladsen.' };
  matches = assignLanesToMatches(matches, activeIds, state.activeLanes);
  return withAudit({
    ...state,
    phase: 'playoffs',
    brackets,
    matches,
    activeMatchIds: activeIds,
    stageRound: 1,
    stageComplete: false,
    roundPublished: false,
    lastError: ''
  }, 'playoffs_created', { aTeams: brackets.A?.seedTeamIds.length || 0, bTeams: brackets.B?.seedTeamIds.length || 0 });
}

export function replacePlayoffTeam(state, division, oldTeamId, newTeamId) {
  if (state.phase !== 'playoffs') return { ...state, lastError: 'Slutspillet er ikke startet.' };
  const key = division === 'B' ? 'B' : 'A';
  const oldId = Number(oldTeamId);
  const replacementId = Number(newTeamId);
  const related = state.matches.filter(match => match.bracketDivision === key && (match.team1Id === oldId || match.team2Id === oldId));
  if (related.some(match => !match.isBye && match.winnerId)) {
    return { ...state, lastError: 'Holdet kan ikke erstattes efter sin første spillede kamp.' };
  }
  const bracket = state.brackets[key];
  return withAudit({
    ...state,
    matches: state.matches.map(match => match.bracketDivision === key ? {
      ...match,
      team1Id: match.team1Id === oldId ? replacementId : match.team1Id,
      team2Id: match.team2Id === oldId ? replacementId : match.team2Id,
      winnerId: match.winnerId === oldId ? replacementId : match.winnerId
    } : match),
    brackets: {
      ...state.brackets,
      [key]: bracket ? { ...bracket, seedTeamIds: bracket.seedTeamIds.map(id => id === oldId ? replacementId : id) } : bracket
    },
    lastError: ''
  }, 'playoff_team_replaced', { division: key, oldTeamId: oldId, newTeamId: replacementId });
}

export function withdrawChampionshipTeam(state, teamId, resultPolicy = 'keep') {
  const id = Number(teamId);
  const policy = resultPolicy === 'void' ? 'void' : 'keep';
  const matches = state.matches.map(match => {
    if (match.isMultiTeamTieBreak && match.participantIds.includes(id)) {
      const participantIds = match.participantIds.filter(teamId => teamId !== id);
      const qualifierIds = match.qualifierIds.filter(teamId => teamId !== id);
      return { ...match, participantIds, qualifierIds, qualifierCount: Math.min(match.qualifierCount, Math.max(0, participantIds.length - 1)) };
    }
    if (match.team1Id !== id && match.team2Id !== id) return match;
    if (policy === 'void') return { ...match, voided: true, winnerId: null };
    if (match.winnerId) return match;
    const opponentId = match.team1Id === id ? match.team2Id : match.team1Id;
    return { ...match, winnerId: opponentId || null, walkover: true };
  });
  return withAudit({
    ...state,
    teams: state.teams.map(team => team.id === id ? { ...team, active: false, withdrawn: true } : team),
    matches,
    lastError: ''
  }, 'team_withdrawn', { teamId: id, resultPolicy: policy });
}

export function addPointsAdjustment(state, teamId, groupId, points, reason) {
  const value = Number(points);
  const text = String(reason || '').trim();
  if (!Number.isFinite(value) || !text) return { ...state, lastError: 'Pointjustering kræver både værdi og begrundelse.' };
  const adjustment = { id: nextNumericId(state.adjustments), teamId: Number(teamId), groupId, points: value, reason: text, createdAt: new Date().toISOString() };
  return withAudit({ ...state, adjustments: [...state.adjustments, adjustment], lastError: '' }, 'points_adjusted', adjustment);
}

export function getDivisionBracket(state, division) {
  const key = division === 'B' ? 'B' : 'A';
  const bracket = state.brackets[key];
  if (!bracket) return null;
  return {
    ...bracket,
    rounds: Array.from({ length: bracket.currentRound || 1 }, (_, index) => ({
      number: index + 1,
      matches: state.matches.filter(match => match.bracketDivision === key && match.bracketRound === index + 1).sort((a, b) => (a.bracketSlot || 0) - (b.bracketSlot || 0))
    }))
  };
}

function completeGroupRound(state) {
  const currentMatches = getCurrentMatches(state);
  const completedTieBreak = currentMatches.some(match => match.isTieBreak);
  if (completedTieBreak) {
    const futureTieRounds = state.matches.filter(match => match.isTieBreak && !match.winnerId && match.round > state.stageRound).map(match => match.round);
    if (futureTieRounds.length) {
      const nextRound = Math.min(...futureTieRounds);
      const activeMatchIds = state.matches.filter(match => match.isTieBreak && !match.winnerId && match.round === nextRound).map(match => match.id);
      return withAudit({
        ...state,
        activeMatchIds,
        matches: assignLanesToMatches(state.matches, activeMatchIds, state.activeLanes),
        stageRound: nextRound,
        stageComplete: false,
        roundPublished: false,
        lastError: ''
      }, 'tiebreak_round_completed', { round: state.stageRound });
    }
    return withAudit({ ...state, activeMatchIds: [], stageComplete: true, roundPublished: false, lastError: '' }, 'tiebreak_round_completed', { round: state.stageRound });
  }
  const stages = state.phase === 'initial_groups' ? ['initial'] : ['a_group', 'b_group'];
  const futureRounds = state.matches
    .filter(match => stages.includes(match.stage) && !match.voided && match.round > state.stageRound)
    .map(match => match.round);
  if (!futureRounds.length) {
    return withAudit({ ...state, activeMatchIds: [], stageComplete: true, roundPublished: false, lastError: '' }, 'group_stage_completed', { phase: state.phase });
  }
  const nextRound = Math.min(...futureRounds);
  let next = { ...state, stageRound: nextRound, roundPublished: false, lastError: '' };
  next = activateGroupRound(next, nextRound);
  return withAudit(next, 'group_round_completed', { phase: state.phase, round: state.stageRound });
}

function completePlayoffWave(state) {
  let matches = [...state.matches];
  const brackets = { ...state.brackets };
  const nextActive = [];
  let nextId = nextMatchId(matches);
  ['A', 'B'].forEach(division => {
    const bracket = brackets[division];
    if (!bracket || bracket.complete) return;
    const current = matches.filter(match => match.bracketDivision === division && match.bracketRound === bracket.currentRound).sort((a, b) => a.bracketSlot - b.bracketSlot);
    if (current.some(match => !match.winnerId)) return;
    if (current.some(match => match.matchType === 'final')) {
      const final = current.find(match => match.matchType === 'final');
      const third = current.find(match => match.matchType === 'third');
      const runnerUpId = final.team1Id === final.winnerId ? final.team2Id : final.team1Id;
      brackets[division] = { ...bracket, complete: true, championId: final.winnerId, runnerUpId, thirdId: third?.winnerId || null };
      return;
    }
    const winners = current.map(match => match.winnerId);
    const nextRound = bracket.currentRound + 1;
    const generated = [];
    if (winners.length === 2) {
      const losers = current.map(match => match.team1Id === match.winnerId ? match.team2Id : match.team1Id).filter(Boolean);
      generated.push(createBracketMatch(nextId++, division, nextRound, 1, winners[0], winners[1], 'final'));
      if (losers.length === 2) generated.push(createBracketMatch(nextId++, division, nextRound, 2, losers[0], losers[1], 'third'));
    } else {
      for (let index = 0; index < winners.length; index += 2) {
        generated.push(createBracketMatch(nextId++, division, nextRound, index / 2 + 1, winners[index], winners[index + 1], winners.length === 4 ? 'semifinal' : 'bracket'));
      }
    }
    matches.push(...generated);
    nextActive.push(...generated.map(match => match.id));
    brackets[division] = { ...bracket, currentRound: nextRound };
  });
  const allComplete = ['A', 'B'].every(division => brackets[division]?.complete);
  matches = assignLanesToMatches(matches, nextActive, state.activeLanes);
  return withAudit({
    ...state,
    matches,
    brackets,
    activeMatchIds: nextActive,
    stageRound: state.stageRound + 1,
    stageComplete: allComplete,
    phase: allComplete ? 'finished' : 'playoffs',
    roundPublished: false,
    lastError: ''
  }, allComplete ? 'championship_completed' : 'playoff_round_completed', { round: state.stageRound });
}

function activateGroupRound(state, round) {
  const stages = state.phase === 'initial_groups' ? ['initial'] : ['a_group', 'b_group'];
  const activeMatchIds = state.matches.filter(match => stages.includes(match.stage) && match.round === round && !match.voided && !match.winnerId).map(match => match.id);
  return {
    ...state,
    activeMatchIds,
    matches: assignLanesToMatches(state.matches, activeMatchIds, state.activeLanes),
    roundPublished: false,
    stageComplete: activeMatchIds.length === 0
  };
}

function addTeamToActiveGroup(state, teamId, requestedGroupId) {
  const available = state.groups.filter(group => isCurrentPhaseGroup(state.phase, group));
  const group = available.find(item => item.id === requestedGroupId) || available.sort((a, b) => a.teamIds.length - b.teamIds.length)[0];
  if (!group) return { ...state, teams: state.teams.filter(team => team.id !== teamId), lastError: 'Vælg en gyldig gruppe.' };
  const opponents = group.teamIds;
  const stage = group.division === 'INITIAL' ? 'initial' : group.division === 'A' ? 'a_group' : 'b_group';
  let id = nextMatchId(state.matches);
  let round = Math.max(0, ...state.matches.filter(match => match.groupId === group.id).map(match => match.round)) + 1;
  const additions = opponents.map(opponentId => ({
    id: id++, stage, groupId: group.id, division: group.division, round: round++,
    team1Id: teamId, team2Id: opponentId, winnerId: null, laneNumber: null, lanePosition: null,
    published: false, voided: false, isBye: false, isTieBreak: false, matchType: 'group'
  }));
  let next = {
    ...state,
    groups: state.groups.map(item => item.id === group.id ? { ...item, teamIds: [...item.teamIds, teamId] } : item),
    matches: [...state.matches, ...additions],
    stageComplete: false,
    lastError: ''
  };
  if (!state.activeMatchIds.length && additions.length) {
    next = { ...next, stageRound: additions[0].round };
    next = activateGroupRound(next, additions[0].round);
  }
  return next;
}

function scheduleGroups(existingMatches, groups, stage, startingId) {
  let matches = [...existingMatches];
  let id = startingId;
  groups.forEach(group => {
    roundRobin(group.teamIds).forEach((roundMatches, roundIndex) => {
      roundMatches.forEach(([team1Id, team2Id]) => {
        matches.push({
          id: id++, stage, groupId: group.id, division: group.division, round: roundIndex + 1,
          team1Id, team2Id, winnerId: null, laneNumber: null, lanePosition: null,
          published: false, voided: false, isBye: false, isTieBreak: false, matchType: 'group'
        });
      });
    });
  });
  return { matches, nextId: id };
}

function roundRobin(teamIds) {
  const list = [...teamIds];
  if (list.length % 2 === 1) list.push(null);
  if (list.length < 2) return [];
  const rounds = [];
  const rotating = [...list];
  for (let round = 0; round < rotating.length - 1; round += 1) {
    const pairs = [];
    for (let index = 0; index < rotating.length / 2; index += 1) {
      const left = rotating[index];
      const right = rotating[rotating.length - 1 - index];
      if (left != null && right != null) pairs.push(round % 2 === 0 ? [left, right] : [right, left]);
    }
    rounds.push(pairs);
    rotating.splice(1, 0, rotating.pop());
  }
  return rounds;
}

function createSeededStageGroups(entries, requestedCount, division) {
  if (!entries.length) return [];
  const count = Math.max(1, Math.min(Number(requestedCount) || 1, Math.max(1, Math.floor(entries.length / 2))));
  const ordered = [...entries].sort((a, b) => a.placement - b.placement || b.points - a.points || a.teamId - b.teamId);
  const buckets = Array.from({ length: count }, () => []);
  ordered.forEach((entry, index) => {
    const snakeIndex = snakeBucketIndex(index, count);
    const candidates = buckets.map((bucket, bucketIndex) => ({ bucket, bucketIndex }))
      .filter(item => item.bucket.length <= buckets[snakeIndex].length && !item.bucket.some(existing => existing.sourceGroupId === entry.sourceGroupId));
    const target = candidates.find(item => item.bucketIndex === snakeIndex) || candidates[0] || { bucket: buckets[snakeIndex] };
    target.bucket.push(entry);
  });
  return buckets.map((bucket, index) => ({ id: `${division}${index + 1}`, division, name: `${division}-gruppe ${index + 1}`, teamIds: bucket.map(entry => entry.teamId) }));
}

function getDivisionQualifiers(state, division) {
  const count = division === 'A' ? state.config.aPlayoffQualifiersPerGroup : state.config.bPlayoffQualifiersPerGroup;
  return state.groups.filter(group => group.division === division).flatMap(group => getGroupStandings(state, group.id).slice(0, count).map(entry => ({ ...entry, groupId: group.id })));
}

function orderPlayoffTeams(state, division, qualifiers, mode) {
  const seeded = [...qualifiers].sort((a, b) => a.rank - b.rank || b.points - a.points || a.teamId - b.teamId).map(entry => entry.teamId);
  if (mode === 'random') return shuffle(seeded);
  if (mode === 'manual') {
    const manual = state.manualPlayoffSeeds[division] || [];
    if (manual.length === seeded.length && manual.every(id => seeded.includes(id))) return manual;
  }
  return seeded;
}

function createBracketFirstRound(division, teamIds, startingId) {
  const size = nextPowerOfTwo(Math.max(2, teamIds.length));
  const positions = seedPositions(size);
  const slots = positions.map(seed => teamIds[seed - 1] || null);
  const matches = [];
  let id = startingId;
  for (let index = 0; index < slots.length; index += 2) {
    const team1Id = slots[index];
    const team2Id = slots[index + 1];
    const isBye = !team1Id || !team2Id;
    matches.push({
      ...createBracketMatch(id++, division, 1, index / 2 + 1, team1Id, team2Id, size === 2 ? 'final' : size === 4 ? 'semifinal' : 'bracket'),
      isBye,
      winnerId: isBye ? (team1Id || team2Id) : null
    });
  }
  return {
    matches,
    nextId: id,
    bracket: { division, seedTeamIds: teamIds, bracketSize: size, currentRound: 1, complete: false, championId: null, runnerUpId: null, thirdId: null }
  };
}

function createBracketMatch(id, division, round, slot, team1Id, team2Id, matchType) {
  return {
    id, stage: `${division.toLowerCase()}_playoff`, groupId: null, division,
    bracketDivision: division, bracketRound: round, bracketSlot: slot, round,
    team1Id: team1Id || null, team2Id: team2Id || null, winnerId: null,
    laneNumber: null, lanePosition: null, published: false, voided: false,
    isBye: false, isTieBreak: false, matchType
  };
}

function getBoundaryTieTeamIds(state, groupId, qualifierCount) {
  return getBoundaryTie(state, groupId, qualifierCount).teamIds;
}

function getBoundaryTie(state, groupId, qualifierCount) {
  const standings = getGroupStandings(state, groupId);
  const index = Number(qualifierCount) - 1;
  if (index < 0 || index >= standings.length - 1) return { teamIds: [], qualifierCount: 0 };
  const boundary = standings[index];
  const same = standings.filter(item => item.points === boundary.points && item.miniWins === boundary.miniWins && item.multiTieBreakScore === boundary.multiTieBreakScore && item.tieBreakWins === boundary.tieBreakWins);
  const positions = same.map(item => standings.findIndex(entry => entry.teamId === item.teamId));
  const firstPosition = Math.min(...positions);
  if (firstPosition > index || Math.max(...positions) <= index) return { teamIds: [], qualifierCount: 0 };
  return {
    teamIds: same.map(item => item.teamId),
    qualifierCount: index - firstPosition + 1
  };
}

function qualifierCountForGroup(state, group) {
  if (group.division === 'INITIAL') return state.config.initialAQualifiersPerGroup;
  return group.division === 'A' ? state.config.aPlayoffQualifiersPerGroup : state.config.bPlayoffQualifiersPerGroup;
}

function isStageMatch(state, match) {
  if (state.phase === 'initial_groups') return match.stage === 'initial' || match.isTieBreak && state.groups.find(group => group.id === match.groupId)?.division === 'INITIAL';
  if (state.phase === 'ab_groups') return ['a_group', 'b_group'].includes(match.stage) || match.isTieBreak && ['A', 'B'].includes(state.groups.find(group => group.id === match.groupId)?.division);
  return false;
}

function isCurrentPhaseGroup(phase, group) {
  return phase === 'initial_groups' ? group.division === 'INITIAL' : phase === 'ab_groups' ? ['A', 'B'].includes(group.division) : false;
}

function assignLanesToMatches(matches, matchIds, activeLanes) {
  const ids = new Set(matchIds);
  const lanes = activeLanes.length ? activeLanes : [1];
  let index = 0;
  return matches.map(match => {
    if (!ids.has(match.id) || match.isBye || match.voided || isMatchResolved(match)) return match;
    const assigned = { ...match, laneNumber: lanes[index % lanes.length], lanePosition: Math.floor(index / lanes.length) + 1 };
    index += 1;
    return assigned;
  });
}

function normalizeLaneQueues(matches, activeIds = null) {
  const ids = activeIds || new Set(matches.map(match => match.id));
  const positions = new Map();
  [...new Set(matches.filter(match => ids.has(match.id)).map(match => match.laneNumber).filter(Number.isInteger))].forEach(lane => {
    matches.filter(match => ids.has(match.id) && match.laneNumber === lane).sort((a, b) => (a.lanePosition || 999) - (b.lanePosition || 999) || a.id - b.id).forEach((match, index) => positions.set(match.id, index + 1));
  });
  return matches.map(match => ids.has(match.id) ? { ...match, lanePosition: Number.isInteger(match.laneNumber) ? positions.get(match.id) : null } : match);
}

function allocateSnake(entries, count) {
  const buckets = Array.from({ length: count }, () => []);
  entries.forEach((entry, index) => buckets[snakeBucketIndex(index, count)].push(entry));
  return buckets;
}

function snakeBucketIndex(index, count) {
  const row = Math.floor(index / count);
  const position = index % count;
  return row % 2 === 0 ? position : count - 1 - position;
}

function orderTeams(teams, mode) {
  const ordered = [...teams];
  if (mode === 'random') return shuffle(ordered);
  if (mode === 'manual') return ordered.sort((a, b) => a.id - b.id);
  return ordered.sort((a, b) => a.seed - b.seed || a.id - b.id);
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function seedPositions(size) {
  let positions = [1, 2];
  while (positions.length < size) {
    const nextSize = positions.length * 2;
    positions = positions.flatMap(seed => [seed, nextSize + 1 - seed]);
  }
  return positions;
}

function nextPowerOfTwo(value) {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

function normalizeConfig(config) {
  return {
    initialGroupCount: clamp(config.initialGroupCount, 1, 32, 2),
    initialAQualifiersPerGroup: clamp(config.initialAQualifiersPerGroup, 1, 32, 2),
    aGroupCount: clamp(config.aGroupCount, 1, 32, 2),
    bGroupCount: clamp(config.bGroupCount, 1, 32, 2),
    aPlayoffQualifiersPerGroup: clamp(config.aPlayoffQualifiersPerGroup, 1, 32, 2),
    bPlayoffQualifiersPerGroup: clamp(config.bPlayoffQualifiersPerGroup, 1, 32, 2),
    allocationMode: ['seeded', 'random', 'manual'].includes(config.allocationMode) ? config.allocationMode : 'seeded',
    aPlayoffDrawMode: ['seeded', 'random', 'manual'].includes(config.aPlayoffDrawMode) ? config.aPlayoffDrawMode : 'seeded',
    bPlayoffDrawMode: ['seeded', 'random', 'manual'].includes(config.bPlayoffDrawMode) ? config.bPlayoffDrawMode : 'seeded',
    laneCount: clamp(config.laneCount, 1, 32, 4)
  };
}

function normalizeTeam(team) {
  if (!team || !Number.isInteger(Number(team.id))) return null;
  return {
    id: Number(team.id), memberOne: String(team.memberOne || ''), memberTwo: String(team.memberTwo || ''),
    name: String(team.name || `${team.memberOne || ''} / ${team.memberTwo || ''}`), seed: Number(team.seed) || Number(team.id),
    active: team.active !== false, withdrawn: !!team.withdrawn, sourceGroupId: team.sourceGroupId || null
  };
}

function normalizeGroup(group) {
  if (!group?.id) return null;
  return { id: String(group.id), division: group.division || 'INITIAL', name: String(group.name || group.id), teamIds: Array.isArray(group.teamIds) ? group.teamIds.map(Number).filter(Number.isInteger) : [] };
}

function normalizeMatch(match) {
  if (!Number.isInteger(Number(match?.id))) return null;
  return {
    ...match,
    id: Number(match.id), round: Number(match.round) || 1,
    team1Id: Number.isInteger(Number(match.team1Id)) ? Number(match.team1Id) : null,
    team2Id: Number.isInteger(Number(match.team2Id)) ? Number(match.team2Id) : null,
    winnerId: Number.isInteger(Number(match.winnerId)) ? Number(match.winnerId) : null,
    participantIds: Array.isArray(match.participantIds) ? [...new Set(match.participantIds.map(Number).filter(Number.isInteger))] : [],
    qualifierIds: Array.isArray(match.qualifierIds) ? [...new Set(match.qualifierIds.map(Number).filter(Number.isInteger))] : [],
    qualifierCount: Math.max(0, Number(match.qualifierCount) || 0),
    laneNumber: Number.isInteger(Number(match.laneNumber)) ? Number(match.laneNumber) : null,
    lanePosition: Number.isInteger(Number(match.lanePosition)) ? Number(match.lanePosition) : null,
    voided: !!match.voided, isBye: !!match.isBye, isTieBreak: !!match.isTieBreak, isMultiTeamTieBreak: !!match.isMultiTeamTieBreak
  };
}

function isMatchResolved(match) {
  if (match?.isMultiTeamTieBreak) return match.qualifierCount > 0 && match.qualifierIds.length === match.qualifierCount;
  return !!match?.winnerId;
}

function withAudit(state, action, details) {
  return {
    ...state,
    auditLog: [...(state.auditLog || []), { id: nextNumericId(state.auditLog || []), action, details, createdAt: new Date().toISOString() }]
  };
}

function nextNumericId(items) {
  return Math.max(0, ...items.map(item => Number(item.id) || 0)) + 1;
}

function nextMatchId(matches) {
  return nextNumericId(matches);
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}
