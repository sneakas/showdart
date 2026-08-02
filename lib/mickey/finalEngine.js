import { MICKEY_TARGETS, getMickeyMpr, getMickeyTargetLabel, isMickeyPlayerFinished } from './engine.js';

export function createFinalMickeyState(options = {}) {
  const participants = normalizeParticipants(options.participants);
  const order = normalizeOrder(participants, options.throwOrderPlayerIds);
  const byId = new Map(participants.map(player => [player.id, player]));
  return {
    version: 1,
    mode: 'individual-final',
    status: 'setup',
    players: order.map(id => createFinalPlayer(byId.get(id))),
    throwOrderPlayerIds: order,
    placements: [],
    visits: [],
    message: '',
    updatedAt: new Date().toISOString()
  };
}

export function startFinalMickeyGame(options = {}) {
  return { ...createFinalMickeyState(options), status: 'playing', updatedAt: new Date().toISOString() };
}

export function normalizeFinalMickeyState(input) {
  if (!input || typeof input !== 'object') return createFinalMickeyState();
  const players = Array.isArray(input.players) ? input.players.slice(0, 4).map(normalizeFinalPlayer).filter(Boolean) : [];
  const validIds = new Set(players.map(player => player.id));
  const placements = Array.isArray(input.placements)
    ? input.placements.map(item => ({ playerId: Number(item.playerId), place: Number(item.place) }))
      .filter(item => validIds.has(item.playerId) && Number.isInteger(item.place) && item.place >= 1 && item.place <= players.length)
      .sort((left, right) => left.place - right.place)
    : [];
  const placeById = new Map(placements.map(item => [item.playerId, item.place]));
  return {
    version: 1,
    mode: 'individual-final',
    status: ['setup', 'playing', 'finished'].includes(input.status) ? input.status : 'setup',
    players: players.map(player => ({ ...player, place: placeById.get(player.id) || null })),
    throwOrderPlayerIds: players.map(player => player.id),
    placements,
    visits: Array.isArray(input.visits) ? input.visits.map(normalizeFinalVisit).filter(Boolean) : [],
    message: typeof input.message === 'string' ? input.message : '',
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString()
  };
}

export function markFinalMickeyTarget(input, playerIndex, targetIndex, marks = 1) {
  const next = normalizeFinalMickeyState(input);
  if (next.status !== 'playing') return next;
  if (!Number.isInteger(playerIndex) || !next.players[playerIndex] || next.players[playerIndex].place) return next;
  if (!MICKEY_TARGETS[targetIndex]) return next;

  const player = { ...next.players[playerIndex], marks: [...next.players[playerIndex].marks] };
  const previousMarks = player.marks[targetIndex] || 0;
  if (previousMarks >= 3) return next;
  const rawMarks = clampInteger(marks, 0, 3);
  if (!rawMarks) return next;
  const effectiveMarks = Math.min(rawMarks, 3 - previousMarks);
  player.marks[targetIndex] = Math.min(3, previousMarks + rawMarks);
  player.rawMarks += rawMarks;
  player.dartsThrown += 1;
  next.players[playerIndex] = player;
  next.visits = [...next.visits, {
    visitNumber: next.visits.length + 1,
    playerId: player.id,
    playerIndex,
    targetIndex,
    targetLabel: getMickeyTargetLabel(targetIndex),
    rawMarks,
    effectiveMarks
  }];

  if (isMickeyPlayerFinished(player)) assignNextPlace(next, player.id);
  const unfinished = next.players.filter(item => !item.place);
  if (next.placements.length > 0 && unfinished.length === 1) {
    assignNextPlace(next, unfinished[0].id);
    next.status = 'finished';
    next.message = 'Finalens placeringer er klar til godkendelse.';
  } else if (player.place) {
    next.message = `${player.name} sluttede som nr. ${player.place}.`;
  } else {
    next.message = `${player.name} markerede ${getMickeyTargetLabel(targetIndex)} (${player.marks[targetIndex]}/3).`;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function undoFinalMickeyVisit(input) {
  const current = normalizeFinalMickeyState(input);
  const visits = current.visits.slice(0, -1);
  let rebuilt = startFinalMickeyGame({
    participants: current.players.map(player => ({ id: player.id, name: player.name })),
    throwOrderPlayerIds: current.throwOrderPlayerIds
  });
  for (const visit of visits) {
    const playerIndex = rebuilt.players.findIndex(player => player.id === visit.playerId);
    rebuilt = markFinalMickeyTarget(rebuilt, playerIndex, visit.targetIndex, visit.rawMarks);
  }
  if (rebuilt.status === 'finished' && visits.length < current.visits.length) {
    // Replaying can only finish when an earlier visit already decided every placement.
    return rebuilt;
  }
  rebuilt.message = visits.length ? 'Sidste indtastning blev fortrudt.' : '';
  rebuilt.updatedAt = new Date().toISOString();
  return rebuilt;
}

export function buildFinalMickeyResult(input, metadata = {}) {
  const state = normalizeFinalMickeyState(input);
  if (state.status !== 'finished' || state.placements.length !== state.players.length) return null;
  const orderedPlayerIds = [...state.placements].sort((left, right) => left.place - right.place).map(item => item.playerId);
  return {
    game: 'mickey-final',
    mode: 'individual-final',
    orderedPlayerIds,
    throwOrderPlayerIds: state.throwOrderPlayerIds,
    placements: state.placements.map(item => ({ ...item })),
    players: state.players.map(player => ({
      id: player.id,
      name: player.name,
      place: player.place,
      closedTargets: player.marks.filter(mark => mark >= 3).length,
      rawMarks: player.rawMarks,
      dartsThrown: player.dartsThrown,
      mpr: getMickeyMpr(player)
    })),
    visits: state.visits.length,
    metadata: { ...metadata },
    completedAt: state.updatedAt
  };
}

function assignNextPlace(state, playerId) {
  if (state.placements.some(item => item.playerId === playerId)) return;
  const place = state.placements.length + 1;
  state.placements = [...state.placements, { playerId, place }];
  state.players = state.players.map(player => player.id === playerId ? { ...player, place } : player);
}

function createFinalPlayer(player) {
  return { id: player.id, name: player.name, marks: Array(MICKEY_TARGETS.length).fill(0), dartsThrown: 0, rawMarks: 0, place: null };
}

function normalizeFinalPlayer(player) {
  const id = Number(player?.id);
  if (!Number.isInteger(id)) return null;
  const marks = Array.isArray(player.marks) ? player.marks.slice(0, MICKEY_TARGETS.length).map(mark => clampInteger(mark, 0, 3)) : [];
  while (marks.length < MICKEY_TARGETS.length) marks.push(0);
  return {
    id,
    name: String(player.name || id).trim() || String(id),
    marks,
    dartsThrown: Math.max(0, Math.floor(Number(player.dartsThrown) || 0)),
    rawMarks: Math.max(0, Math.floor(Number(player.rawMarks) || 0)),
    place: Number.isInteger(Number(player.place)) ? Number(player.place) : null
  };
}

function normalizeParticipants(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map(player => ({ id: Number(player?.id), name: String(player?.name || '').trim() }))
    .filter(player => Number.isInteger(player.id) && player.name && !seen.has(player.id) && seen.add(player.id))
    .slice(0, 4);
}

function normalizeOrder(participants, value) {
  const ids = participants.map(player => player.id);
  const allowed = new Set(ids);
  const selected = [...new Set((Array.isArray(value) ? value : []).map(Number).filter(id => allowed.has(id)))];
  return [...selected, ...ids.filter(id => !selected.includes(id))];
}

function normalizeFinalVisit(visit, index) {
  const playerId = Number(visit?.playerId);
  const targetIndex = Number(visit?.targetIndex);
  if (!Number.isInteger(playerId) || !MICKEY_TARGETS[targetIndex]) return null;
  return {
    visitNumber: Math.max(1, Number(visit.visitNumber) || index + 1),
    playerId,
    playerIndex: Number.isInteger(Number(visit.playerIndex)) ? Number(visit.playerIndex) : 0,
    targetIndex,
    targetLabel: String(visit.targetLabel || getMickeyTargetLabel(targetIndex)),
    rawMarks: clampInteger(visit.rawMarks, 0, 3),
    effectiveMarks: clampInteger(visit.effectiveMarks, 0, 3)
  };
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
}
