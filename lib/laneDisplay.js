// Compact screen projection. Scoring history and UI-only fields stay on the tablet.
export function buildLaneDisplayBoard({ state, finalState, linkedMatch }) {
  const game = linkedMatch?.isFinal ? finalState : state;
  if (!game || game.status === 'setup' || !Array.isArray(game.players)) return null;
  const players = game.players.map((player, index) => ({
    participantKey: linkedMatch?.isFinal ? `player:${player.id}` : `side:${index}`,
    playerId: linkedMatch?.isFinal ? String(player.id) : null,
    name: String(player.name).slice(0, 100),
    marks: player.marks.slice(0, 9)
  }));
  return {
    mode: 'mickey', players,
    stage: game.status === 'finished' ? 'pending' : 'playing',
    matchLabel: String(linkedMatch?.roundLabel || 'Mickey').slice(0, 120)
  };
}

export function parseLaneDisplayBoard(value, { approved = false } = {}) {
  if (!value || value.mode !== 'mickey' || !['playing', 'pending', ...(approved ? ['approved'] : [])].includes(value.stage)) throw new Error('Ugyldig skærmstatus.');
  if (!Array.isArray(value.players) || value.players.length < 2 || value.players.length > 4) throw new Error('Vælg to til fire spillere.');
  const players = value.players.map(player => {
    if (typeof player.participantKey !== 'string' || !/^[\w:-]{1,100}$/.test(player.participantKey)
      || typeof player.name !== 'string' || !player.name.trim() || player.name.length > 100
      || !Array.isArray(player.marks) || player.marks.length !== 9
      || player.marks.some(mark => !Number.isInteger(mark) || mark < 0 || mark > 3)) throw new Error('Ugyldigt Mickey-board.');
    return { participantKey: player.participantKey, playerId: typeof player.playerId === 'string' ? player.playerId.slice(0, 100) : null, name: player.name.trim(), marks: [...player.marks] };
  });
  if (new Set(players.map(player => player.participantKey)).size !== players.length) throw new Error('Spillerne skal være forskellige.');
  return { mode: 'mickey', stage: value.stage, matchLabel: String(value.matchLabel || 'Mickey').slice(0, 120), players };
}

export function approveLaneDisplayBoard(board, gameResult, isFinal) {
  const parsed = parseLaneDisplayBoard(board);
  if (parsed.stage !== 'pending') throw new Error('Spillet er ikke afsluttet.');
  const ordered = isFinal
    ? gameResult.orderedPlayerIds.map(id => parsed.players.find(player => player.playerId === String(id))?.participantKey)
    : [parsed.players[gameResult.winnerIndex]?.participantKey, parsed.players[1 - gameResult.winnerIndex]?.participantKey];
  if (ordered.length !== parsed.players.length || ordered.some(key => !key) || new Set(ordered).size !== ordered.length) throw new Error('Resultatet passer ikke til skærmens spillere.');
  return { ...parsed, stage: 'approved', placements: ordered };
}
