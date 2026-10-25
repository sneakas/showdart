import { buildLaneMatchSnapshot, CHAMPIONSHIP_KEY } from './laneMatch.js';
import { getCurrentMatches, getChampionshipMatchStatus, normalizeChampionshipState } from './championship/engine.js';

const label = (value, limit = 120) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);

// The same competition and lane selection as the scoring page. Draft rounds
// never enter the public projection. Empty lanes explicitly clear old pairings.
export function buildLaneAnnouncements(statesByKey, lanes) {
  return [...new Set(lanes)].sort((a, b) => a - b).map(lane => {
    const snapshot = buildLaneMatchSnapshot(statesByKey, lane);
    let match = snapshot.match;
    let names = match?.participants?.length
      ? match.participants.map(player => player.name)
      : match ? [match.side1Label, match.side2Label] : [];

    // Championship qualification ties are announced even though the two-side
    // scoring page does not play these multi-team matches.
    if (!match && snapshot.competition?.key === CHAMPIONSHIP_KEY && snapshot.status === 'waiting_for_match') {
      const state = normalizeChampionshipState(statesByKey[CHAMPIONSHIP_KEY]);
      const tie = state.roundPublished && getCurrentMatches(state).find(item => item.isMultiTeamTieBreak
        && !item.voided && !item.winnerId && item.laneNumber === lane && getChampionshipMatchStatus(state, item.id) === 'current');
      if (tie) {
        match = { key: `${CHAMPIONSHIP_KEY}:${state.competitionInstanceId}:${tie.id}`, roundLabel: `Tie-break · Runde ${state.stageRound}` };
        names = tie.participantIds.map(id => state.teams.find(team => team.id === id)?.name || 'Hold');
      }
    }
    if (!match) return { lane, board: null };
    names = names.map(name => label(name, 100));
    if (names.length < 2 || names.length > 32 || names.some(name => !name)) throw new Error('Ugyldige navne til baneskærmen.');
    const competitionName = label(snapshot.competition.label);
    const roundLabel = label(match.roundLabel || snapshot.competition.roundLabel);
    return { lane, board: {
      mode: 'template', template: 'announcement', laneNumber: lane,
      // Protocol-v1 fallback for screens still running the previous client.
      title: names.length > 4 ? 'Spillere på banen' : names.join(' · '), message: `${competitionName} · ${roundLabel}`, imageUrl: null,
      showdartPairing: { matchKey: match.key, competitionName, roundLabel, names }
    } };
  });
}
