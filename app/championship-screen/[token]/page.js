'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../lib/supabaseBrowser';
import { getCurrentMatches, getDivisionBracket, getGroupStandings, normalizeChampionshipState } from '../../../lib/championship/engine';
import './screen.css';

const DEFAULT_PUBLIC_SCREENS = {
  screen1: { label: 'Skærm 1', mode: 'auto', rowsPerPage: 12, matchesPerPage: 8, groupsPerPage: 2, rotationSeconds: 10, announcement: '', hideHeader: false, hideHero: false, hideConnection: false, hidePageIndicator: false, hideLaneInfo: false, hideFooter: false, lanes: [] },
  screen2: { label: 'Skærm 2', mode: 'auto', rowsPerPage: 12, matchesPerPage: 8, groupsPerPage: 2, rotationSeconds: 10, announcement: '', hideHeader: false, hideHero: false, hideConnection: false, hidePageIndicator: false, hideLaneInfo: false, hideFooter: false, lanes: [] }
};

const texts = {
  da: {
    loading: 'Indlæser mesterskabsskærm...', invalid: 'Ugyldigt skærmlink', live: 'Live', polling: 'Backup-opdatering', delayed: 'Forbindelse forsinket',
    registration: 'Registrering', initial: 'Første gruppespil', ab: 'A/B-gruppespil', playoffs: 'Slutspil', finished: 'Mesterskabet er afsluttet',
    teams: 'Hold', groups: 'Grupper', lanes: 'Baner', round: 'Runde', currentMatches: 'Aktuelle kampe', betweenRounds: 'Mellem spillerunder',
    playing: 'Spiller nu', queued: 'Næste kamp', completed: 'Afsluttet', lane: 'Bane', queue: 'Køplads', winner: 'Vinder',
    standings: 'Stilling', played: 'Spillet', wins: 'Sejre', losses: 'Nederlag', points: 'Point', page: 'Side',
    aPlayoffs: 'A-slutspil', bPlayoffs: 'B-slutspil', champion: 'Mester', runnerUp: '2. plads', third: '3. plads', waiting: 'Venter på næste offentliggjorte spillerunde', tieBreak: 'Tie-break', advancing: 'går videre', qualifyingPlaces: 'pladser', quarterFinal: 'Kvartfinale', semiFinal: 'Semifinale', final: 'Finale', awaitingTeams: 'Afventer hold', registeredTeams: 'Tilmeldte hold', announcement: 'Besked fra arrangør', updated: 'Senest opdateret'
  },
  en: {
    loading: 'Loading championship screen...', invalid: 'Invalid screen link', live: 'Live', polling: 'Backup updates', delayed: 'Connection delayed',
    registration: 'Registration', initial: 'Initial groups', ab: 'A/B groups', playoffs: 'Playoffs', finished: 'Championship completed',
    teams: 'Teams', groups: 'Groups', lanes: 'Lanes', round: 'Round', currentMatches: 'Current matches', betweenRounds: 'Between rounds',
    playing: 'Playing now', queued: 'Next match', completed: 'Completed', lane: 'Lane', queue: 'Queue position', winner: 'Winner',
    standings: 'Standings', played: 'Played', wins: 'Wins', losses: 'Losses', points: 'Points', page: 'Page',
    aPlayoffs: 'A playoffs', bPlayoffs: 'B playoffs', champion: 'Champion', runnerUp: 'Runner-up', third: '3rd place', waiting: 'Waiting for the next published round', tieBreak: 'Tie-break', advancing: 'advancing', qualifyingPlaces: 'places', quarterFinal: 'Quarter-final', semiFinal: 'Semi-final', final: 'Final', awaitingTeams: 'Awaiting teams', registeredTeams: 'Registered teams', announcement: 'Organizer message', updated: 'Last updated'
  }
};

export default function ChampionshipScreenPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = decodeURIComponent(Array.isArray(params?.token) ? params.token[0] : params?.token || '');
  const screenKey = searchParams.get('view') === 'screen2' ? 'screen2' : 'screen1';
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, setState] = useState(() => normalizeChampionshipState(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [connection, setConnection] = useState('polling');
  const [lang, setLang] = useState('da');
  const [frameIndex, setFrameIndex] = useState(0);
  const t = texts[lang] || texts.da;

  const screenConfig = useMemo(() => normalizePublicScreenConfig(state.publicScreens?.[screenKey], screenKey), [screenKey, state.publicScreens]);
  const currentMatches = useMemo(() => {
    if (!state.roundPublished) return [];
    const lanes = screenConfig.lanes.length ? new Set(screenConfig.lanes) : null;
    return getCurrentMatches(state).filter(match => !lanes || lanes.has(match.laneNumber));
  }, [screenConfig.lanes, state]);
  const teamsById = useMemo(() => new Map(state.teams.map(team => [team.id, team])), [state.teams]);
  const automaticViews = useMemo(() => getAutomaticViews(state, currentMatches.length), [currentMatches.length, state]);
  const requestedViews = screenConfig.mode === 'auto' ? automaticViews : [screenConfig.mode];
  const frames = useMemo(() => buildDisplayFrames({ state, views: requestedViews, currentMatches, screenConfig }), [currentMatches, requestedViews.join('|'), screenConfig, state]);
  const frame = frames[frameIndex % Math.max(1, frames.length)] || { view: 'announcement', page: 0, pages: 1 };

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/tournament-screen/public?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Invalid link');
      setMeta(payload);
      setState(normalizeChampionshipState(payload.state));
      setUpdatedAt(payload.updatedAt || new Date().toISOString());
      setConnection(previous => previous === 'live' ? 'live' : 'polling');
      setError('');
    } catch (loadError) {
      if (!silent) setError(loadError instanceof Error ? loadError.message : 'Invalid link');
      setConnection('delayed');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const saved = localStorage.getItem('showdart-language');
    setLang(saved === 'en' ? 'en' : 'da');
    load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => load({ silent: true }), 8000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!supabase || !meta?.realtimeChannel) return undefined;
    const channel = supabase.channel(meta.realtimeChannel, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'tournament-state' }, ({ payload }) => {
        if (!payload?.state) return;
        setState(normalizeChampionshipState(payload.state));
        setUpdatedAt(payload.updatedAt || new Date().toISOString());
        setConnection('live');
      });
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') setConnection('live');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnection('polling');
    });
    return () => { supabase.removeChannel(channel); };
  }, [meta?.realtimeChannel, supabase]);

  useEffect(() => {
    setFrameIndex(0);
    if (frames.length <= 1) return undefined;
    const interval = window.setInterval(() => setFrameIndex(index => (index + 1) % frames.length), screenConfig.rotationSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [frames.length, screenConfig.mode, screenConfig.rotationSeconds, screenKey, state.phase, state.stageRound]);

  if (loading) return <main className="chs-page chs-center">{t.loading}</main>;
  if (error) return <main className="chs-page chs-center"><section className="chs-card"><h1>{t.invalid}</h1><p>{error}</p></section></main>;

  const phaseLabel = state.phase === 'registration' ? t.registration : state.phase === 'initial_groups' ? t.initial : state.phase === 'ab_groups' ? t.ab : state.phase === 'playoffs' ? t.playoffs : t.finished;
  const aBracket = getDivisionBracket(state, 'A');
  const bBracket = getDivisionBracket(state, 'B');

  const pageIndicator = !screenConfig.hidePageIndicator && frame.pages > 1 ? `${t.page} ${frame.page + 1}/${frame.pages}` : '';
  const activeGroupCount = state.groups.filter(group => state.phase === 'initial_groups' ? group.division === 'INITIAL' : ['A', 'B'].includes(group.division)).length;

  return <main className={`chs-page ${screenConfig.hideFooter ? '' : 'has-footer'}`}>
    {!screenConfig.hideHeader ? <header className="chs-header">
      <div className="chs-brand"><img src="/assets/small-logo.png" alt="Showdart" /><div><strong>Showdart</strong><span>Championship</span></div></div>
      {!screenConfig.hideConnection ? <div className={`chs-connection is-${connection}`}><i />{connection === 'live' ? t.live : connection === 'polling' ? t.polling : t.delayed} · {formatTime(updatedAt)}</div> : null}
      <div className="chs-flags"><button aria-label="Dansk" onClick={() => { setLang('da'); localStorage.setItem('showdart-language', 'da'); }}>🇩🇰</button><button aria-label="English" onClick={() => { setLang('en'); localStorage.setItem('showdart-language', 'en'); }}>🇬🇧</button></div>
    </header> : null}

    {!screenConfig.hideHero ? <section className="chs-hero">
      <div><span>{phaseLabel}</span><h1>{state.tournamentName || t.initial}</h1><p>{state.teams.filter(team => !team.withdrawn).length} {t.teams} · {activeGroupCount} {t.groups} · {state.activeLanes.length} {t.lanes}</p></div>
      <strong>{t.round} {state.stageRound || 0}</strong>
    </section> : null}

    <section className="chs-content">
      {screenConfig.announcement && frame.view !== 'announcement' ? <AnnouncementPanel message={screenConfig.announcement} t={t} /> : null}
      {frame.view === 'announcement' ? <AnnouncementPanel message={screenConfig.announcement || '-'} t={t} full /> : null}
      {frame.view === 'registration' ? <section><SectionTitle title={t.registeredTeams} page={pageIndicator} /><div className="chs-registration-grid">{frame.items.map((team, index) => <div className="chs-registration-team" key={team.id}><span>{frame.startIndex + index + 1}</span><strong>{team.name}</strong></div>)}</div></section> : null}
      {frame.view === 'matches' ? frame.items.length ? <section><SectionTitle title={t.currentMatches} page={pageIndicator} /><div className="chs-match-grid">{frame.items.map(match => <MatchCard key={match.id} match={match} allMatches={currentMatches} teamsById={teamsById} t={t} hideLaneInfo={screenConfig.hideLaneInfo} />)}</div></section> : <section className="chs-waiting"><span>{t.betweenRounds}</span><h2>{t.waiting}</h2></section> : null}
      {['initialStandings', 'aStandings', 'bStandings'].includes(frame.view) ? <section><SectionTitle title={t.standings} page={pageIndicator} /><div className="chs-group-grid">{frame.groups.map(item => <GroupTable key={item.group.id} group={item.group} standings={item.standings} t={t} />)}</div></section> : null}
      {['aBracket', 'bBracket', 'brackets'].includes(frame.view) ? <section className="chs-bracket-grid">{frame.view !== 'bBracket' ? <Bracket bracket={aBracket} teamsById={teamsById} title={t.aPlayoffs} t={t} /> : null}{frame.view !== 'aBracket' ? <Bracket bracket={bBracket} teamsById={teamsById} title={t.bPlayoffs} t={t} /> : null}</section> : null}
      {frame.view === 'podium' ? <section className="chs-podium-grid"><Podium bracket={aBracket} teamsById={teamsById} title={t.aPlayoffs} t={t} /><Podium bracket={bBracket} teamsById={teamsById} title={t.bPlayoffs} t={t} /></section> : null}
    </section>
    {!screenConfig.hideFooter ? <footer className="chs-footer"><span>{screenConfig.label}</span><strong>{phaseLabel}</strong><span>{pageIndicator || `${t.round} ${state.stageRound || 0}`}</span><span>{t.updated}: {formatTime(updatedAt)}</span></footer> : null}
  </main>;
}

function MatchCard({ match, allMatches, teamsById, t, hideLaneInfo }) {
  const unfinished = allMatches.filter(item => item.laneNumber === match.laneNumber && !isResolved(item) && !item.voided).sort((a, b) => (a.lanePosition || 999) - (b.lanePosition || 999));
  const queueIndex = unfinished.findIndex(item => item.id === match.id);
  const status = isResolved(match) ? 'completed' : queueIndex === 0 ? 'current' : 'queued';
  const label = status === 'current' ? t.playing : status === 'queued' ? t.queued : t.completed;
  const displayQueue = queueIndex >= 0 ? queueIndex + 1 : null;
  return <article className={`chs-match is-${status} ${match.isMultiTeamTieBreak ? 'is-multi-tiebreak' : ''}`}><div className="chs-match-head"><strong>{match.isMultiTeamTieBreak ? `${t.tieBreak} · ${label}` : label}</strong>{!hideLaneInfo ? <span>{t.lane} {match.laneNumber || '-'}{displayQueue ? ` · ${t.queue} ${displayQueue}` : ''}</span> : null}</div>{match.isMultiTeamTieBreak ? <div className="chs-multi-tiebreak"><p><strong>{match.qualifierIds.length}/{match.qualifierCount}</strong> {t.qualifyingPlaces} {t.advancing}</p><div>{match.participantIds.map(teamId => <div key={teamId} className={match.qualifierIds.includes(teamId) ? 'is-winner' : isResolved(match) ? 'is-loser' : ''}><span>{match.qualifierIds.includes(teamId) ? '✓' : ''}</span>{teamsById.get(teamId)?.name || '-'}</div>)}</div></div> : <div className="chs-teams"><div className={match.winnerId === match.team1Id ? 'is-winner' : match.winnerId ? 'is-loser' : ''}>{match.winnerId === match.team1Id ? '✓ ' : ''}{teamsById.get(match.team1Id)?.name || '-'}</div><b>VS</b><div className={match.winnerId === match.team2Id ? 'is-winner' : match.winnerId ? 'is-loser' : ''}>{match.winnerId === match.team2Id ? '✓ ' : ''}{teamsById.get(match.team2Id)?.name || '-'}</div></div>}</article>;
}

function GroupTable({ group, standings, t }) {
  return <section className="chs-card"><h2>{group.name}</h2><table><thead><tr><th>#</th><th>{t.teams}</th><th>{t.played}</th><th>{t.wins}</th><th>{t.losses}</th><th>{t.points}</th></tr></thead><tbody>{standings.map(entry => <tr key={entry.teamId}><td>{entry.rank}</td><td>{entry.name}</td><td>{entry.played}</td><td>{entry.wins}</td><td>{entry.losses}</td><td><strong>{entry.points}</strong></td></tr>)}</tbody></table></section>;
}

function Bracket({ bracket, teamsById, title, t }) {
  if (!bracket) return null;
  const totalRounds = Math.max(1, Math.log2(bracket.bracketSize || 2));
  const firstRoundMatches = Math.max(1, (bracket.bracketSize || 2) / 2);
  const unit = 104;
  const treeHeight = firstRoundMatches * unit;
  const rounds = Array.from({ length: totalRounds }, (_, index) => {
    const number = index + 1;
    const expectedMatches = Math.max(1, firstRoundMatches / (2 ** index));
    const existing = bracket.rounds.find(round => round.number === number)?.matches.filter(match => match.matchType !== 'third') || [];
    return {
      number,
      matches: Array.from({ length: expectedMatches }, (_, slotIndex) => existing.find(match => match.bracketSlot === slotIndex + 1) || { id: `placeholder-${number}-${slotIndex}`, bracketSlot: slotIndex + 1, placeholder: true })
    };
  });
  const thirdPlaceMatch = bracket.rounds.flatMap(round => round.matches).find(match => match.matchType === 'third');
  const treeWidth = totalRounds * 224 + Math.max(0, totalRounds - 1) * 48;
  return <section className="chs-card chs-bracket"><h2>{title}</h2><div className="chs-tree-scroll"><div className="chs-bracket-tree" style={{ '--tree-height': `${treeHeight + 46}px`, minWidth: `${treeWidth}px`, gridTemplateColumns: `repeat(${totalRounds}, minmax(224px, 1fr))` }}>{rounds.map((round, roundIndex) => <section className="chs-tree-round" key={round.number}><h3>{bracketRoundLabel(round.number, totalRounds, t)}</h3>{round.matches.map(match => {
    const center = 46 + (match.bracketSlot - 0.5) * unit * (2 ** roundIndex);
    const connectorHeight = unit * (2 ** Math.max(0, roundIndex - 1));
    return <div className={`chs-tree-match ${match.placeholder ? 'is-placeholder' : ''}`} style={{ top: `${center}px`, '--connector-height': `${connectorHeight}px` }} key={match.id}>{roundIndex > 0 ? <i /> : null}<BracketTeam teamId={match.team1Id} winnerId={match.winnerId} teamsById={teamsById} placeholder={match.placeholder} t={t} /><b>VS</b><BracketTeam teamId={match.team2Id} winnerId={match.winnerId} teamsById={teamsById} placeholder={match.placeholder} t={t} /></div>;
  })}</section>)}</div></div>{thirdPlaceMatch ? <div className="chs-third-place"><h3>{t.third}</h3><div className="chs-tree-match is-third"><BracketTeam teamId={thirdPlaceMatch.team1Id} winnerId={thirdPlaceMatch.winnerId} teamsById={teamsById} t={t} /><b>VS</b><BracketTeam teamId={thirdPlaceMatch.team2Id} winnerId={thirdPlaceMatch.winnerId} teamsById={teamsById} t={t} /></div></div> : null}</section>;
}

function BracketTeam({ teamId, winnerId, teamsById, placeholder, t }) {
  const name = teamId ? teamsById.get(teamId)?.name : placeholder ? t.awaitingTeams : 'BYE';
  return <span className={winnerId === teamId ? 'is-winner' : winnerId && teamId ? 'is-loser' : ''}>{winnerId === teamId ? '✓ ' : ''}{name || '-'}</span>;
}

function bracketRoundLabel(number, totalRounds, t) {
  const remaining = totalRounds - number;
  if (remaining === 0) return t.final;
  if (remaining === 1) return t.semiFinal;
  if (remaining === 2) return t.quarterFinal;
  return `${t.round} ${number}`;
}

function Podium({ bracket, teamsById, title, t }) {
  if (!bracket) return null;
  return <section className="chs-card chs-podium"><h2>{title}</h2><div className="first"><span>1</span><strong>{teamsById.get(bracket.championId)?.name || '-'}</strong><small>{t.champion}</small></div><div><span>2</span><strong>{teamsById.get(bracket.runnerUpId)?.name || '-'}</strong><small>{t.runnerUp}</small></div><div><span>3</span><strong>{teamsById.get(bracket.thirdId)?.name || '-'}</strong><small>{t.third}</small></div></section>;
}

function SectionTitle({ title, page }) {
  return <div className="chs-section-title"><h2>{title}</h2>{page ? <span>{page}</span> : null}</div>;
}

function AnnouncementPanel({ message, t, full = false }) {
  return <section className={`chs-announcement ${full ? 'is-full' : ''}`}><span>{t.announcement}</span><strong>{message}</strong></section>;
}

function getAutomaticViews(state, currentMatchCount) {
  if (state.phase === 'registration') return ['registration'];
  if (state.phase === 'initial_groups') return currentMatchCount ? ['matches', 'initialStandings'] : ['initialStandings'];
  if (state.phase === 'ab_groups') return currentMatchCount ? ['matches', 'aStandings', 'bStandings'] : ['aStandings', 'bStandings'];
  if (state.phase === 'playoffs') return currentMatchCount ? ['matches', 'brackets'] : ['brackets'];
  return ['podium'];
}

function buildDisplayFrames({ state, views, currentMatches, screenConfig }) {
  const frames = [];
  for (const view of views) {
    let viewFrames = [];
    if (view === 'registration') {
      viewFrames = chunk(state.teams.filter(team => !team.withdrawn), screenConfig.rowsPerPage).map((items, page) => ({ view, items, startIndex: page * screenConfig.rowsPerPage }));
    } else if (view === 'matches') {
      viewFrames = chunk(orderMatches(currentMatches), screenConfig.matchesPerPage).map(items => ({ view, items }));
    } else if (['initialStandings', 'aStandings', 'bStandings'].includes(view)) {
      const division = view === 'initialStandings' ? 'INITIAL' : view === 'aStandings' ? 'A' : 'B';
      const groups = state.groups.filter(group => group.division === division);
      for (const groupChunk of chunk(groups, screenConfig.groupsPerPage)) {
        const standings = groupChunk.map(group => ({ group, standings: getGroupStandings(state, group.id) }));
        const rowPageCount = Math.max(1, ...standings.map(item => Math.ceil(item.standings.length / screenConfig.rowsPerPage)));
        for (let rowPage = 0; rowPage < rowPageCount; rowPage += 1) {
          viewFrames.push({
            view,
            groups: standings.map(item => ({ ...item, standings: item.standings.slice(rowPage * screenConfig.rowsPerPage, (rowPage + 1) * screenConfig.rowsPerPage) }))
          });
        }
      }
    } else {
      viewFrames = [{ view }];
    }
    if (!viewFrames.length) viewFrames = [{ view, items: [], groups: [] }];
    frames.push(...viewFrames.map((item, page) => ({ ...item, page, pages: viewFrames.length })));
  }
  return frames.length ? frames : [{ view: 'announcement', page: 0, pages: 1 }];
}

function normalizePublicScreenConfig(value, screenKey) {
  const defaults = DEFAULT_PUBLIC_SCREENS[screenKey] || DEFAULT_PUBLIC_SCREENS.screen1;
  const configured = value && typeof value === 'object' ? value : {};
  return {
    ...defaults,
    ...configured,
    rowsPerPage: clampNumber(configured.rowsPerPage, 4, 24, defaults.rowsPerPage),
    matchesPerPage: clampNumber(configured.matchesPerPage, 1, 24, defaults.matchesPerPage),
    groupsPerPage: clampNumber(configured.groupsPerPage, 1, 6, defaults.groupsPerPage),
    rotationSeconds: clampNumber(configured.rotationSeconds, 5, 120, defaults.rotationSeconds),
    announcement: String(configured.announcement || '').trim().slice(0, 240),
    lanes: Array.isArray(configured.lanes) ? configured.lanes.map(Number).filter(Number.isInteger) : []
  };
}

function chunk(items, size) {
  const pages = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages.length ? pages : [[]];
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

function orderMatches(matches) {
  return [...matches].sort((left, right) => {
    const leftStatus = isResolved(left) ? 2 : 0;
    const rightStatus = isResolved(right) ? 2 : 0;
    return leftStatus - rightStatus || (left.lanePosition || 999) - (right.lanePosition || 999) || (left.laneNumber || 999) - (right.laneNumber || 999);
  });
}

function isResolved(match) {
  return match.isMultiTeamTieBreak
    ? match.qualifierCount > 0 && match.qualifierIds.length === match.qualifierCount
    : !!match.winnerId;
}

function formatTime(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleTimeString('da-DK');
}
