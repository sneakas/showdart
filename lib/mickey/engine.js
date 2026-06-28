export const MICKEY_TARGETS = [
  { key: '20', label: '20', scoreValue: 20 },
  { key: '19', label: '19', scoreValue: 19 },
  { key: '18', label: '18', scoreValue: 18 },
  { key: '17', label: '17', scoreValue: 17 },
  { key: '16', label: '16', scoreValue: 16 },
  { key: '15', label: '15', scoreValue: 15 },
  { key: 'any-double', label: 'Any D', shortLabel: 'D', requiredRing: 'double', scoreValue: 0 },
  { key: 'any-triple', label: 'Any T', shortLabel: 'T', requiredRing: 'triple', scoreValue: 0 },
  { key: 'bull', label: 'Bull', shortLabel: 'B', bull: true, scoreValue: 25 }
];

export const MICKEY_RULES = [
  'Spil som Cricket Close-Out pa 20-15 og bull, men med to ekstra mal: Any Double og Any Triple.',
  'Alle standardfelter kraever 3 marks. Single giver 1 mark, double giver 2 marks og triple giver 3 marks.',
  'Bull: outer bull giver 1 mark, bullseye giver 2 marks.',
  'Any Double kraever 3 hits pa valgfri doubler. Any Triple kraever 3 hits pa valgfri tripler.',
  'Point ignoreres. Spilleren vinder forst, nar alle 9 felter star pa 3 marks.',
  'I hurtig Mickey-tavle trykker du direkte pa feltet for at give 1 mark. Brug ring-knapperne i setup/udvidet logik senere, hvis hvert dartkast skal registreres mere detaljeret.'
];

const AI_ROUTES = [
  ['20', '19', '18', '17', '16', '15', 'bull', 'any-triple', 'any-double'],
  ['20', '18', 'bull', '15', '17', '19', '16', 'any-triple', 'any-double'],
  ['bull', '20', '19', '18', '17', '16', '15', 'any-double', 'any-triple'],
  ['18', '20', '19', 'bull', '17', '15', '16', 'any-triple', 'any-double'],
  ['any-triple', '20', '18', '19', 'bull', '16', '15', '17', 'any-double'],
  ['15', '16', '17', '18', '19', '20', 'bull', 'any-double', 'any-triple'],
  ['20', 'any-triple', '18', 'bull', '16', 'any-double', '15', '19', '17'],
  ['bull', 'any-double', '20', '18', 'any-triple', '15', '17', '19', '16'],
  ['17', '19', 'any-triple', '20', '16', 'bull', 'any-double', '18', '15']
];

export function createMickeyPlayer(name = 'Spiller') {
  return {
    name,
    marks: Array(MICKEY_TARGETS.length).fill(0),
    dartsThrown: 0,
    rawMarks: 0
  };
}

export function createMickeyState(options = {}) {
  const opponentMode = options.opponentMode === 'ai' ? 'ai' : 'human';
  return {
    version: 1,
    status: 'setup',
    opponentMode,
    aiAverageMarks: clampNumber(options.aiAverageMarks ?? 3, 0.25, 5),
    players: [
      createMickeyPlayer(cleanName(options.playerOneName, 'Spiller 1')),
      createMickeyPlayer(opponentMode === 'ai' ? 'AI' : cleanName(options.playerTwoName, 'Spiller 2'))
    ],
    winnerIndex: null,
    selectedTargetIndex: 0,
    visits: [],
    message: '',
    updatedAt: new Date().toISOString()
  };
}

export function startMickeyGame(options = {}) {
  return {
    ...createMickeyState(options),
    status: 'playing',
    updatedAt: new Date().toISOString()
  };
}

export function normalizeMickeyState(state) {
  if (!state || typeof state !== 'object') return createMickeyState();
  const opponentMode = state.opponentMode === 'ai' ? 'ai' : 'human';
  const players = Array.isArray(state.players) ? state.players.slice(0, 2) : [];
  while (players.length < 2) players.push(createMickeyPlayer(`Spiller ${players.length + 1}`));

  return {
    version: 1,
    status: ['setup', 'playing', 'finished'].includes(state.status) ? state.status : 'setup',
    opponentMode,
    aiAverageMarks: clampNumber(state.aiAverageMarks ?? 3, 0.25, 5),
    players: players.map((player, index) => normalizeMickeyPlayer(player, opponentMode === 'ai' && index === 1 ? 'AI' : `Spiller ${index + 1}`)),
    winnerIndex: state.winnerIndex === 0 || state.winnerIndex === 1 ? state.winnerIndex : null,
    selectedTargetIndex: clampInteger(state.selectedTargetIndex ?? 0, 0, MICKEY_TARGETS.length - 1),
    visits: Array.isArray(state.visits) ? state.visits.map(normalizeVisit).filter(Boolean) : [],
    message: typeof state.message === 'string' ? state.message : '',
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : new Date().toISOString()
  };
}

export function markMickeyTarget(state, playerIndex, targetIndex, marks = 1) {
  const next = normalizeMickeyState(state);
  if (next.status !== 'playing') return next;
  if (playerIndex !== 0 && playerIndex !== 1) return next;
  if (!MICKEY_TARGETS[targetIndex]) return next;
  if (next.opponentMode === 'ai' && playerIndex === 1) return next;
  if (next.winnerIndex !== null) return next;

  const player = clonePlayer(next.players[playerIndex]);
  const previousMarks = player.marks[targetIndex] || 0;
  if (previousMarks >= 3) return next;

  const rawMarks = clampInteger(marks, 0, 3);
  const effectiveMarks = Math.min(rawMarks, Math.max(0, 3 - previousMarks));
  if (effectiveMarks <= 0) return next;

  player.marks[targetIndex] = Math.min(3, previousMarks + rawMarks);
  player.rawMarks += rawMarks;
  player.dartsThrown += 1;
  next.players[playerIndex] = player;
  next.selectedTargetIndex = targetIndex;
  next.visits = [
    ...next.visits,
    createVisit({
      visitNumber: next.visits.length + 1,
      playerIndex,
      targetIndex,
      rawMarks,
      effectiveMarks,
      source: 'manual'
    })
  ];

  if (isMickeyPlayerFinished(player)) {
    next.status = 'finished';
    next.winnerIndex = playerIndex;
    next.message = `${player.name} lukkede Mickey-boardet.`;
  } else {
    next.message = `${player.name} markerede ${getMickeyTargetLabel(targetIndex)} (${player.marks[targetIndex]}/3).`;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function runMickeyAiTurn(state, random = Math.random) {
  const next = normalizeMickeyState(state);
  if (next.status !== 'playing' || next.opponentMode !== 'ai' || next.winnerIndex !== null) return next;

  const playerIndex = 1;
  const player = clonePlayer(next.players[playerIndex]);
  if (isMickeyPlayerFinished(player)) return next;

  const route = getAiRoute(next.visits.filter(visit => visit.playerIndex === 1).length, random);
  let remainingBudget = getAiVisitBudget(next.aiAverageMarks, random);
  const entries = [];
  let rawTotal = 0;
  let effectiveTotal = 0;
  let lastTargetIndex = next.selectedTargetIndex;

  for (let dartIndex = 0; dartIndex < 3; dartIndex += 1) {
    const targetIndex = getAiOpenTargetIndex(player, route, random);
    if (targetIndex < 0) break;
    const target = MICKEY_TARGETS[targetIndex];
    const ring = getAiRingForTarget(target, remainingBudget, next.aiAverageMarks, random);
    const rawMarks = getMickeyMarksValue(target, ring);
    const previousMarks = player.marks[targetIndex] || 0;
    const effectiveMarks = Math.min(rawMarks, Math.max(0, 3 - previousMarks));

    player.dartsThrown += 1;
    if (rawMarks > 0) {
      player.marks[targetIndex] = Math.min(3, previousMarks + rawMarks);
      player.rawMarks += rawMarks;
      rawTotal += rawMarks;
      effectiveTotal += effectiveMarks;
      lastTargetIndex = targetIndex;
    }
    remainingBudget -= rawMarks;
    entries.push({
      dartInVisit: dartIndex + 1,
      targetIndex,
      targetLabel: target.label,
      ring,
      rawMarks,
      effectiveMarks
    });
  }

  if (!entries.length) return next;

  next.players[playerIndex] = player;
  next.selectedTargetIndex = lastTargetIndex;
  next.visits = [
    ...next.visits,
    {
      visitNumber: next.visits.length + 1,
      playerIndex,
      targetIndex: lastTargetIndex,
      targetLabel: getMickeyTargetLabel(lastTargetIndex),
      rawMarks: rawTotal,
      effectiveMarks: effectiveTotal,
      entries,
      source: 'ai'
    }
  ];

  if (isMickeyPlayerFinished(player)) {
    next.status = 'finished';
    next.winnerIndex = playerIndex;
    next.message = 'AI lukkede Mickey-boardet.';
  } else {
    next.message = `AI markerede ${effectiveTotal} mark${effectiveTotal === 1 ? '' : 's'}.`;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function undoMickeyVisit(state) {
  const next = normalizeMickeyState(state);
  const visits = next.visits.slice(0, -1);
  const rebuilt = createMickeyState({
    opponentMode: next.opponentMode,
    aiAverageMarks: next.aiAverageMarks,
    playerOneName: next.players[0]?.name,
    playerTwoName: next.players[1]?.name
  });
  rebuilt.status = visits.length ? 'playing' : next.status === 'setup' ? 'setup' : 'playing';

  for (const visit of visits) {
    const player = rebuilt.players[visit.playerIndex];
    if (!player) continue;
    const entries = Array.isArray(visit.entries) && visit.entries.length ? visit.entries : [visit];
    for (const entry of entries) {
      const targetIndex = entry.targetIndex;
      if (!MICKEY_TARGETS[targetIndex]) continue;
      const rawMarks = clampInteger(entry.rawMarks ?? 0, 0, 3);
      const before = player.marks[targetIndex] || 0;
      player.marks[targetIndex] = Math.min(3, before + rawMarks);
      player.rawMarks += rawMarks;
      player.dartsThrown += 1;
    }
  }

  rebuilt.visits = visits;
  rebuilt.winnerIndex = rebuilt.players.findIndex(isMickeyPlayerFinished);
  if (rebuilt.winnerIndex >= 0) {
    rebuilt.status = 'finished';
    rebuilt.message = `${rebuilt.players[rebuilt.winnerIndex].name} lukkede Mickey-boardet.`;
  } else {
    rebuilt.winnerIndex = null;
    rebuilt.status = next.status === 'setup' ? 'setup' : 'playing';
    rebuilt.message = visits.length ? 'Sidste markering blev fortrudt.' : '';
  }
  rebuilt.updatedAt = new Date().toISOString();
  return rebuilt;
}

export function getMickeyTargetLabel(targetIndex) {
  const target = MICKEY_TARGETS[targetIndex];
  return target?.shortLabel || target?.label || '-';
}

export function getMickeyMarksValue(target, ring) {
  if (!target || ring === 'miss') return 0;
  if (target.requiredRing) return ring === target.requiredRing ? 1 : 0;
  if (target.bull) return ring === 'double' ? 2 : ring === 'single' ? 1 : 0;
  return ring === 'triple' ? 3 : ring === 'double' ? 2 : ring === 'single' ? 1 : 0;
}

export function isMickeyPlayerFinished(player) {
  return Boolean(player?.marks?.length) && MICKEY_TARGETS.every((_, index) => (player.marks[index] || 0) >= 3);
}

export function getMickeyMpr(player) {
  if (!player?.dartsThrown) return '0,00';
  return ((player.rawMarks / player.dartsThrown) * 3).toFixed(2).replace('.', ',');
}

export function buildMickeyTournamentResult(state, metadata = {}) {
  const normalized = normalizeMickeyState(state);
  if (normalized.status !== 'finished' || normalized.winnerIndex === null) return null;
  const loserIndex = normalized.winnerIndex === 0 ? 1 : 0;
  return {
    game: 'mickey',
    winnerName: normalized.players[normalized.winnerIndex].name,
    loserName: normalized.players[loserIndex].name,
    winnerIndex: normalized.winnerIndex,
    players: normalized.players.map(player => ({
      name: player.name,
      closedTargets: player.marks.filter(mark => mark >= 3).length,
      rawMarks: player.rawMarks,
      dartsThrown: player.dartsThrown,
      mpr: getMickeyMpr(player)
    })),
    visits: normalized.visits.length,
    metadata: { ...metadata },
    completedAt: normalized.updatedAt
  };
}

function normalizeMickeyPlayer(player, fallbackName) {
  const marks = Array.isArray(player?.marks) ? player.marks.slice(0, MICKEY_TARGETS.length) : [];
  while (marks.length < MICKEY_TARGETS.length) marks.push(0);
  return {
    name: cleanName(player?.name, fallbackName),
    marks: marks.map(mark => clampInteger(mark, 0, 3)),
    dartsThrown: Math.max(0, Math.floor(Number(player?.dartsThrown) || 0)),
    rawMarks: Math.max(0, Math.floor(Number(player?.rawMarks) || 0))
  };
}

function clonePlayer(player) {
  return {
    ...player,
    marks: [...player.marks]
  };
}

function createVisit({ visitNumber, playerIndex, targetIndex, rawMarks, effectiveMarks, source }) {
  const target = MICKEY_TARGETS[targetIndex];
  return {
    visitNumber,
    playerIndex,
    targetIndex,
    targetLabel: target?.label || '-',
    rawMarks,
    effectiveMarks,
    entries: [{
      dartInVisit: 1,
      targetIndex,
      targetLabel: target?.label || '-',
      ring: target?.requiredRing || (target?.bull ? 'single' : 'single'),
      rawMarks,
      effectiveMarks
    }],
    source
  };
}

function normalizeVisit(visit, index) {
  if (!visit || (visit.playerIndex !== 0 && visit.playerIndex !== 1)) return null;
  const targetIndex = clampInteger(visit.targetIndex ?? 0, 0, MICKEY_TARGETS.length - 1);
  return {
    visitNumber: Math.max(1, Math.floor(Number(visit.visitNumber) || index + 1)),
    playerIndex: visit.playerIndex,
    targetIndex,
    targetLabel: typeof visit.targetLabel === 'string' ? visit.targetLabel : getMickeyTargetLabel(targetIndex),
    rawMarks: Math.max(0, Math.floor(Number(visit.rawMarks) || 0)),
    effectiveMarks: Math.max(0, Math.floor(Number(visit.effectiveMarks) || 0)),
    entries: Array.isArray(visit.entries) ? visit.entries.map(entry => ({
      dartInVisit: clampInteger(entry.dartInVisit ?? 1, 1, 3),
      targetIndex: clampInteger(entry.targetIndex ?? targetIndex, 0, MICKEY_TARGETS.length - 1),
      targetLabel: typeof entry.targetLabel === 'string' ? entry.targetLabel : getMickeyTargetLabel(entry.targetIndex ?? targetIndex),
      ring: ['single', 'double', 'triple', 'miss'].includes(entry.ring) ? entry.ring : 'single',
      rawMarks: Math.max(0, Math.floor(Number(entry.rawMarks) || 0)),
      effectiveMarks: Math.max(0, Math.floor(Number(entry.effectiveMarks) || 0))
    })) : [],
    source: visit.source === 'ai' ? 'ai' : 'manual'
  };
}

function getAiRoute(visitNumber, random) {
  if (random() < 0.35) {
    return AI_ROUTES[Math.floor(random() * AI_ROUTES.length)] || AI_ROUTES[0];
  }
  return AI_ROUTES[visitNumber % AI_ROUTES.length] || AI_ROUTES[0];
}

function getAiVisitBudget(averageMarks, random) {
  const roll = random();
  const variance = roll < 0.08 ? -1.5 : roll < 0.22 ? -1 : roll < 0.38 ? -0.5 : roll < 0.72 ? 0 : roll < 0.9 ? 0.5 : 1;
  return clampNumber(averageMarks + variance, 0, 9);
}

function getAiOpenTargetIndex(player, route, random) {
  const routeIndexes = route.map(key => MICKEY_TARGETS.findIndex(target => target.key === key)).filter(index => index >= 0 && player.marks[index] < 3);
  const specialIndexes = routeIndexes.filter(index => MICKEY_TARGETS[index]?.requiredRing);
  if (specialIndexes.length && random() < 0.28) {
    return specialIndexes[Math.floor(random() * specialIndexes.length)] || specialIndexes[0];
  }
  return routeIndexes[0] ?? MICKEY_TARGETS.findIndex((_, index) => player.marks[index] < 3);
}

function getAiRingForTarget(target, remainingBudget, strength, random) {
  if (remainingBudget <= 0) return 'miss';
  if (remainingBudget < 1 && random() > remainingBudget) return 'miss';
  const missChance = Math.max(0.04, 0.32 - strength * 0.04);
  if (random() < missChance) return 'miss';
  if (target.requiredRing) return target.requiredRing;
  if (target.bull) {
    const doubleChance = Math.min(0.55, 0.12 + strength * 0.08);
    return remainingBudget >= 1.75 && random() < doubleChance ? 'double' : 'single';
  }
  const tripleChance = Math.min(0.48, Math.max(0.04, 0.04 + strength * 0.085));
  const doubleChance = Math.min(0.38, Math.max(0.08, 0.1 + strength * 0.055));
  const roll = random();
  if (remainingBudget >= 2.75 && roll < tripleChance) return 'triple';
  if (remainingBudget >= 1.75 && roll < tripleChance + doubleChance) return 'double';
  return 'single';
}

function cleanName(value, fallback) {
  const cleaned = String(value || '').trim();
  return cleaned || fallback;
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
