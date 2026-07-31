import {
  getMatchLabel,
  getMatchLaneStatus,
  normalizeTournamentState,
  selectWinner
} from './tournament/reactEngine.js';
import {
  getChampionshipMatchStatus,
  getCurrentMatches,
  normalizeChampionshipState,
  setChampionshipWinner
} from './championship/engine.js';

export const TOURNAMENT_KEY = 'showdart-default';
export const CHAMPIONSHIP_KEY = 'showdart-championship';
export const COMPETITION_KEYS = [TOURNAMENT_KEY, CHAMPIONSHIP_KEY];

export class LaneMatchError extends Error {
  constructor(message, code = 'lane_match_error', status = 400) {
    super(message);
    this.name = 'LaneMatchError';
    this.code = code;
    this.status = status;
  }
}

export function buildLaneMatchSnapshot(statesByKey, laneValue = null) {
  const candidates = [
    buildTournamentCandidate(statesByKey?.[TOURNAMENT_KEY]),
    buildChampionshipCandidate(statesByKey?.[CHAMPIONSHIP_KEY])
  ].filter(Boolean).sort((left, right) => right.priority - left.priority);
  const competition = candidates[0] || null;
  const lane = normalizeLane(laneValue);

  if (!competition) {
    return {
      competition: null,
      lane,
      laneCount: 0,
      activeLanes: [],
      match: null,
      status: 'no_competition'
    };
  }

  const base = {
    competition: {
      key: competition.key,
      type: competition.type,
      label: competition.label,
      roundLabel: competition.roundLabel
    },
    lane,
    laneCount: competition.laneCount,
    activeLanes: competition.activeLanes,
    match: null,
    status: competition.status
  };

  if (!lane) return { ...base, status: 'choose_lane' };
  if (lane > competition.laneCount || !competition.activeLanes.includes(lane)) {
    return { ...base, status: 'inactive_lane' };
  }
  if (!competition.roundPublished) return { ...base, status: 'round_not_published' };

  const match = competition.matches.find(item => item.laneNumber === lane && item.status === 'current');
  if (!match) return { ...base, status: 'waiting_for_match' };

  return {
    ...base,
    status: 'match_ready',
    match: {
      id: match.id,
      key: `${competition.key}:${match.id}`,
      laneNumber: match.laneNumber,
      lanePosition: match.lanePosition,
      side1Label: match.side1Label,
      side2Label: match.side2Label,
      roundLabel: match.roundLabel || competition.roundLabel
    }
  };
}

export function applyLaneMatchResult({ competitionKey, state, matchId, lane, winnerIndex, gameResult }) {
  const normalizedWinnerIndex = Number(winnerIndex);
  if (normalizedWinnerIndex !== 0 && normalizedWinnerIndex !== 1) {
    throw new LaneMatchError('Vælg en gyldig vinder.', 'invalid_winner');
  }

  if (competitionKey === TOURNAMENT_KEY) {
    const normalized = normalizeTournamentState(state);
    const match = normalized.matches.find(item => item.id === Number(matchId));
    validateTournamentMatch(normalized, match, lane);
    const winner = normalizedWinnerIndex + 1;
    if (match.winner && match.winner !== winner) {
      throw new LaneMatchError('Kampen har allerede fået en anden vinder.', 'winner_conflict', 409);
    }
    if (match.winner === winner) return normalized;
    const updated = selectWinner(normalized, match.id, winner);
    if (updated.lastGenerationError) {
      throw new LaneMatchError(updated.lastGenerationError, 'result_rejected', 409);
    }
    return {
      ...updated,
      matches: updated.matches.map(item => item.id === match.id
        ? { ...item, gameResult: sanitizeGameResult(gameResult) }
        : item)
    };
  }

  if (competitionKey === CHAMPIONSHIP_KEY) {
    const normalized = normalizeChampionshipState(state);
    const match = normalized.matches.find(item => item.id === Number(matchId));
    validateChampionshipMatch(normalized, match, lane);
    const winnerId = normalizedWinnerIndex === 0 ? match.team1Id : match.team2Id;
    if (match.winnerId && match.winnerId !== winnerId) {
      throw new LaneMatchError('Kampen har allerede fået en anden vinder.', 'winner_conflict', 409);
    }
    if (match.winnerId === winnerId) return normalized;
    const updated = setChampionshipWinner(normalized, match.id, winnerId, 'Automatisk resultat fra Spil');
    if (updated.lastError) {
      throw new LaneMatchError(updated.lastError, 'result_rejected', 409);
    }
    return {
      ...updated,
      matches: updated.matches.map(item => item.id === match.id
        ? { ...item, gameResult: sanitizeGameResult(gameResult) }
        : item)
    };
  }

  throw new LaneMatchError('Den aktive turnering blev ikke fundet.', 'competition_not_found', 404);
}

function buildTournamentCandidate(input) {
  if (!input || typeof input !== 'object') return null;
  const state = normalizeTournamentState(input);
  const isRunning = state.started && !state.finalResults;
  const hasPublishedMatches = state.roundPublished && state.matches.some(match => !match.winner);
  const matches = state.matches
    .filter(match => !match.winner)
    .map(match => ({
      id: match.id,
      laneNumber: match.laneNumber,
      lanePosition: match.lanePosition,
      side1Label: getMatchLabel(state, match, 1),
      side2Label: getMatchLabel(state, match, 2),
      roundLabel: `Runde ${state.currentRound || 1}`,
      status: getMatchLaneStatus(state, match.id)
    }));
  return {
    key: TOURNAMENT_KEY,
    type: 'tournament',
    label: state.tournamentName || 'Turnering',
    roundLabel: `Runde ${state.currentRound || 1}`,
    laneCount: state.laneCount,
    activeLanes: state.activeLanes,
    roundPublished: state.roundPublished,
    matches,
    status: isRunning ? 'waiting_for_match' : 'no_competition',
    priority: hasPublishedMatches ? 40 : isRunning ? 30 : state.started ? 10 : 0
  };
}

function buildChampionshipCandidate(input) {
  if (!input || typeof input !== 'object') return null;
  const state = normalizeChampionshipState(input);
  const isRunning = state.started && state.phase !== 'finished';
  const currentMatches = getCurrentMatches(state).filter(match => !match.isBye && !match.voided && !match.winnerId);
  const hasPublishedMatches = state.roundPublished && currentMatches.length > 0;
  const teams = new Map(state.teams.map(team => [team.id, team]));
  const matches = currentMatches
    .filter(match => !match.isMultiTeamTieBreak)
    .map(match => ({
      id: match.id,
      laneNumber: match.laneNumber,
      lanePosition: match.lanePosition,
      side1Label: teams.get(match.team1Id)?.name || 'Hold 1',
      side2Label: teams.get(match.team2Id)?.name || 'Hold 2',
      roundLabel: getChampionshipRoundLabel(state, match),
      status: getChampionshipMatchStatus(state, match.id)
    }));
  return {
    key: CHAMPIONSHIP_KEY,
    type: 'championship',
    label: state.tournamentName || 'Mesterskab',
    roundLabel: `Runde ${state.stageRound || 1}`,
    laneCount: state.config.laneCount,
    activeLanes: state.activeLanes,
    roundPublished: state.roundPublished,
    matches,
    status: isRunning ? 'waiting_for_match' : 'no_competition',
    priority: hasPublishedMatches ? 40 : isRunning ? 30 : state.started ? 10 : 0
  };
}

function validateTournamentMatch(state, match, laneValue) {
  if (!match) throw new LaneMatchError('Kampen blev ikke fundet.', 'match_not_found', 404);
  if (normalizeLane(laneValue) !== match.laneNumber) throw new LaneMatchError('Kampen er flyttet til en anden bane.', 'lane_changed', 409);
  if (!state.roundPublished) throw new LaneMatchError('Runden er ikke offentliggjort.', 'round_not_published', 409);
  if (!match.winner && getMatchLaneStatus(state, match.id) !== 'current') throw new LaneMatchError('Kampen er ikke den næste kamp på banen.', 'match_not_current', 409);
}

function validateChampionshipMatch(state, match, laneValue) {
  if (!match) throw new LaneMatchError('Kampen blev ikke fundet.', 'match_not_found', 404);
  if (match.isMultiTeamTieBreak) throw new LaneMatchError('Denne tie-break skal registreres fra Mesterskab-siden.', 'unsupported_match', 409);
  if (normalizeLane(laneValue) !== match.laneNumber) throw new LaneMatchError('Kampen er flyttet til en anden bane.', 'lane_changed', 409);
  if (!state.roundPublished) throw new LaneMatchError('Runden er ikke offentliggjort.', 'round_not_published', 409);
  if (!match.winnerId && getChampionshipMatchStatus(state, match.id) !== 'current') throw new LaneMatchError('Kampen er ikke den næste kamp på banen.', 'match_not_current', 409);
}

function getChampionshipRoundLabel(state, match) {
  const group = match.groupId ? state.groups.find(item => item.id === match.groupId) : null;
  if (group) return `${group.name} · Runde ${match.round || state.stageRound || 1}`;
  if (match.bracketDivision) {
    const division = match.bracketDivision === 'A' ? 'A-slutspil' : match.bracketDivision === 'B' ? 'B-slutspil' : match.bracketDivision;
    const round = match.matchType === 'third' ? '3. plads' : `Runde ${match.bracketRound || match.round || 1}`;
    return `${division} · ${round}`;
  }
  return `Runde ${match.round || state.stageRound || 1}`;
}

function sanitizeGameResult(value) {
  if (!value || typeof value !== 'object') return null;
  return JSON.parse(JSON.stringify(value));
}

function normalizeLane(value) {
  const lane = Number(value);
  return Number.isInteger(lane) && lane > 0 ? lane : null;
}
