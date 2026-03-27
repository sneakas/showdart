function getEntries(state) {
  if (!state || typeof state !== 'object') {
    return [];
  }

  return state.teammateMode === 'fixed'
    ? (Array.isArray(state.fixedTeams) ? state.fixedTeams : [])
    : (Array.isArray(state.players) ? state.players : []);
}

function getEliminationSortValue(value) {
  if (value === 'final') {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function sortStandings(entries) {
  return [...entries].sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1;
    }

    if (left.active && right.active && left.losses !== right.losses) {
      return left.losses - right.losses;
    }

    if (!left.active && !right.active) {
      return getEliminationSortValue(right.eliminationRound) - getEliminationSortValue(left.eliminationRound);
    }

    return (left.id || 0) - (right.id || 0);
  });
}

function buildFinalPlacements(entries, finalResults) {
  if (!Array.isArray(finalResults) || finalResults.length === 0) {
    return [];
  }

  const finalistIds = new Set(finalResults.map(entry => entry.id));
  const placements = finalResults.map((entry, index) => ({
    ...entry,
    place: index + 1
  }));

  const eliminatedGroups = new Map();

  entries
    .filter(entry => !finalistIds.has(entry.id))
    .forEach(entry => {
      const roundKey = entry.eliminationRound ?? 'unknown';
      const existing = eliminatedGroups.get(roundKey) || [];
      existing.push(entry);
      eliminatedGroups.set(roundKey, existing);
    });

  let nextPlace = placements.length + 1;

  [...eliminatedGroups.entries()]
    .sort(([leftRound], [rightRound]) => {
      const roundDiff = getEliminationSortValue(rightRound) - getEliminationSortValue(leftRound);
      if (roundDiff !== 0) {
        return roundDiff;
      }
      return String(leftRound).localeCompare(String(rightRound));
    })
    .forEach(([, groupedEntries]) => {
      groupedEntries
        .sort((left, right) => (left.id || 0) - (right.id || 0))
        .forEach(entry => {
          placements.push({
            ...entry,
            place: nextPlace
          });
        });

      nextPlace += groupedEntries.length;
    });

  return placements;
}

export function buildScreenState(state) {
  const entries = getEntries(state);
  const entryMap = new Map(entries.map(entry => [entry.id, entry]));
  const isFixedTeams = state?.teammateMode === 'fixed';
  const tournamentName = typeof state?.tournamentName === 'string' ? state.tournamentName.trim() : '';

  const matches = Array.isArray(state?.matches)
    ? state.matches.map(match => {
        if ((match.mode === 'fixed' || isFixedTeams) && Number.isInteger(match.team1TeamId) && Number.isInteger(match.team2TeamId)) {
          const team1 = entryMap.get(match.team1TeamId);
          const team2 = entryMap.get(match.team2TeamId);
          return {
            id: match.id,
            winner: match.winner ?? null,
            team1Label: team1?.name || match.team1Label || 'Team 1',
            team2Label: team2?.name || match.team2Label || 'Team 2'
          };
        }

        const team1 = Array.isArray(match.team1PlayerIds) ? match.team1PlayerIds.map(id => entryMap.get(id)).filter(Boolean) : [];
        const team2 = Array.isArray(match.team2PlayerIds) ? match.team2PlayerIds.map(id => entryMap.get(id)).filter(Boolean) : [];

        return {
          id: match.id,
          winner: match.winner ?? null,
          team1Label: team1.map(player => player.name).join(', '),
          team2Label: team2.map(player => player.name).join(', '),
          isOneVOne: team1.length === 1 && team2.length === 1
        };
      })
    : [];

  const skippedIds = isFixedTeams
    ? (Array.isArray(state?.skippedTeamIds) ? state.skippedTeamIds : [])
    : (Array.isArray(state?.skippedPlayerIds) ? state.skippedPlayerIds : []);

  const skippedEntries = skippedIds.map(id => entryMap.get(id)).filter(Boolean);

  const finalIds = isFixedTeams
    ? (Array.isArray(state?.finalResultTeamIds) ? state.finalResultTeamIds : [])
    : (Array.isArray(state?.finalResultPlayerIds) ? state.finalResultPlayerIds : []);

  const finalResults = finalIds.map(id => entryMap.get(id)).filter(Boolean);
  const finalPlacements = buildFinalPlacements(entries, finalResults);

  let phase = 'waiting';
  if (finalResults.length > 0) {
    phase = 'final';
  } else if (state?.started && (matches.length > 0 || skippedEntries.length > 0)) {
    phase = 'round';
  } else if (state?.started) {
    phase = 'standings';
  } else if (entries.length > 0) {
    phase = 'registration';
  }

  return {
    isFixedTeams,
    tournamentName,
    entries,
    standings: sortStandings(entries),
    matches,
    skippedEntries,
    finalResults,
    finalPlacements,
    phase,
    currentRound: Number.isFinite(Number(state?.currentRound)) ? Number(state.currentRound) : 0,
    maxLosses: Number.isFinite(Number(state?.maxLosses)) ? Number(state.maxLosses) : 0,
    started: !!state?.started
  };
}
