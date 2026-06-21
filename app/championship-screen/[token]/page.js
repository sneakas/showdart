'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../lib/supabaseBrowser';
import { getCurrentMatches, getDivisionBracket, getGroupStandings, normalizeChampionshipState } from '../../../lib/championship/engine';
import './screen.css';

const texts = {
  da: {
    loading: 'Indlæser mesterskabsskærm...', invalid: 'Ugyldigt skærmlink', live: 'Live', polling: 'Backup-opdatering', delayed: 'Forbindelse forsinket',
    registration: 'Registrering', initial: 'Første gruppespil', ab: 'A/B-gruppespil', playoffs: 'Slutspil', finished: 'Mesterskabet er afsluttet',
    teams: 'Hold', groups: 'Grupper', lanes: 'Baner', round: 'Runde', currentMatches: 'Aktuelle kampe', betweenRounds: 'Mellem spillerunder',
    playing: 'Spiller nu', queued: 'Næste kamp', completed: 'Afsluttet', lane: 'Bane', queue: 'Køplads', winner: 'Vinder',
    standings: 'Stilling', played: 'Spillet', wins: 'Sejre', losses: 'Nederlag', points: 'Point', page: 'Side',
    aPlayoffs: 'A-slutspil', bPlayoffs: 'B-slutspil', champion: 'Mester', runnerUp: '2. plads', third: '3. plads', waiting: 'Venter på næste offentliggjorte spillerunde', tieBreak: 'Tie-break', advancing: 'går videre', qualifyingPlaces: 'pladser'
  },
  en: {
    loading: 'Loading championship screen...', invalid: 'Invalid screen link', live: 'Live', polling: 'Backup updates', delayed: 'Connection delayed',
    registration: 'Registration', initial: 'Initial groups', ab: 'A/B groups', playoffs: 'Playoffs', finished: 'Championship completed',
    teams: 'Teams', groups: 'Groups', lanes: 'Lanes', round: 'Round', currentMatches: 'Current matches', betweenRounds: 'Between rounds',
    playing: 'Playing now', queued: 'Next match', completed: 'Completed', lane: 'Lane', queue: 'Queue position', winner: 'Winner',
    standings: 'Standings', played: 'Played', wins: 'Wins', losses: 'Losses', points: 'Points', page: 'Page',
    aPlayoffs: 'A playoffs', bPlayoffs: 'B playoffs', champion: 'Champion', runnerUp: 'Runner-up', third: '3rd place', waiting: 'Waiting for the next published round', tieBreak: 'Tie-break', advancing: 'advancing', qualifyingPlaces: 'places'
  }
};

export default function ChampionshipScreenPage() {
  const params = useParams();
  const token = decodeURIComponent(Array.isArray(params?.token) ? params.token[0] : params?.token || '');
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, setState] = useState(() => normalizeChampionshipState(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [connection, setConnection] = useState('polling');
  const [lang, setLang] = useState('da');
  const [groupPage, setGroupPage] = useState(0);
  const [matchPage, setMatchPage] = useState(0);
  const t = texts[lang] || texts.da;

  const currentMatches = useMemo(() => state.roundPublished ? getCurrentMatches(state) : [], [state]);
  const visibleGroups = useMemo(() => state.groups.filter(group => state.phase === 'initial_groups' ? group.division === 'INITIAL' : ['ab_groups', 'playoffs', 'finished'].includes(state.phase) ? ['A', 'B'].includes(group.division) : false), [state.groups, state.phase]);
  const teamsById = useMemo(() => new Map(state.teams.map(team => [team.id, team])), [state.teams]);
  const groupPages = useMemo(() => chunk(visibleGroups, 4), [visibleGroups]);
  const matchPages = useMemo(() => chunk(orderMatches(currentMatches), 10), [currentMatches]);

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
    setGroupPage(0);
    if (groupPages.length <= 1) return undefined;
    const interval = window.setInterval(() => setGroupPage(page => (page + 1) % groupPages.length), 10000);
    return () => window.clearInterval(interval);
  }, [groupPages.length, state.phase, state.stageRound]);

  useEffect(() => {
    setMatchPage(0);
    if (matchPages.length <= 1) return undefined;
    const interval = window.setInterval(() => setMatchPage(page => (page + 1) % matchPages.length), 10000);
    return () => window.clearInterval(interval);
  }, [matchPages.length, state.stageRound]);

  if (loading) return <main className="chs-page chs-center">{t.loading}</main>;
  if (error) return <main className="chs-page chs-center"><section className="chs-card"><h1>{t.invalid}</h1><p>{error}</p></section></main>;

  const phaseLabel = state.phase === 'registration' ? t.registration : state.phase === 'initial_groups' ? t.initial : state.phase === 'ab_groups' ? t.ab : state.phase === 'playoffs' ? t.playoffs : t.finished;
  const currentGroupPage = groupPages[groupPage] || [];
  const currentMatchPage = matchPages[matchPage] || [];
  const aBracket = getDivisionBracket(state, 'A');
  const bBracket = getDivisionBracket(state, 'B');

  return <main className="chs-page">
    <header className="chs-header">
      <div className="chs-brand"><img src="/assets/small-logo.png" alt="Showdart" /><div><strong>Showdart</strong><span>Championship</span></div></div>
      <div className={`chs-connection is-${connection}`}><i />{connection === 'live' ? t.live : connection === 'polling' ? t.polling : t.delayed} · {formatTime(updatedAt)}</div>
      <div className="chs-flags"><button aria-label="Dansk" onClick={() => { setLang('da'); localStorage.setItem('showdart-language', 'da'); }}>🇩🇰</button><button aria-label="English" onClick={() => { setLang('en'); localStorage.setItem('showdart-language', 'en'); }}>🇬🇧</button></div>
    </header>

    <section className="chs-hero">
      <div><span>{phaseLabel}</span><h1>{state.tournamentName || t.initial}</h1><p>{state.teams.filter(team => !team.withdrawn).length} {t.teams} · {visibleGroups.length} {t.groups} · {state.activeLanes.length} {t.lanes}</p></div>
      <strong>{t.round} {state.stageRound || 0}</strong>
    </section>

    <section className="chs-content">
      {state.phase === 'finished' ? <section className="chs-podium-grid"><Podium bracket={aBracket} teamsById={teamsById} title={t.aPlayoffs} t={t} /><Podium bracket={bBracket} teamsById={teamsById} title={t.bPlayoffs} t={t} /></section> : null}

      {currentMatches.length ? <section><SectionTitle title={t.currentMatches} page={matchPages.length > 1 ? `${t.page} ${matchPage + 1}/${matchPages.length}` : ''} /><div className="chs-match-grid">{currentMatchPage.map(match => <MatchCard key={match.id} match={match} allMatches={currentMatches} teamsById={teamsById} t={t} />)}</div></section> : state.started && state.phase !== 'finished' ? <section className="chs-waiting"><span>{t.betweenRounds}</span><h2>{t.waiting}</h2></section> : null}

      {currentGroupPage.length ? <section><SectionTitle title={t.standings} page={groupPages.length > 1 ? `${t.page} ${groupPage + 1}/${groupPages.length}` : ''} /><div className="chs-group-grid">{currentGroupPage.map(group => <GroupTable key={group.id} group={group} standings={getGroupStandings(state, group.id)} t={t} />)}</div></section> : null}

      {state.phase === 'playoffs' ? <section className="chs-bracket-grid"><Bracket bracket={aBracket} teamsById={teamsById} title={t.aPlayoffs} t={t} /><Bracket bracket={bBracket} teamsById={teamsById} title={t.bPlayoffs} t={t} /></section> : null}
    </section>
  </main>;
}

function MatchCard({ match, allMatches, teamsById, t }) {
  const unfinished = allMatches.filter(item => item.laneNumber === match.laneNumber && !isResolved(item) && !item.voided).sort((a, b) => (a.lanePosition || 999) - (b.lanePosition || 999));
  const queueIndex = unfinished.findIndex(item => item.id === match.id);
  const status = isResolved(match) ? 'completed' : queueIndex === 0 ? 'current' : 'queued';
  const label = status === 'current' ? t.playing : status === 'queued' ? t.queued : t.completed;
  const displayQueue = queueIndex >= 0 ? queueIndex + 1 : null;
  return <article className={`chs-match is-${status} ${match.isMultiTeamTieBreak ? 'is-multi-tiebreak' : ''}`}><div className="chs-match-head"><strong>{match.isMultiTeamTieBreak ? `${t.tieBreak} · ${label}` : label}</strong><span>{t.lane} {match.laneNumber || '-'}{displayQueue ? ` · ${t.queue} ${displayQueue}` : ''}</span></div>{match.isMultiTeamTieBreak ? <div className="chs-multi-tiebreak"><p><strong>{match.qualifierIds.length}/{match.qualifierCount}</strong> {t.qualifyingPlaces} {t.advancing}</p><div>{match.participantIds.map(teamId => <div key={teamId} className={match.qualifierIds.includes(teamId) ? 'is-winner' : isResolved(match) ? 'is-loser' : ''}><span>{match.qualifierIds.includes(teamId) ? '✓' : ''}</span>{teamsById.get(teamId)?.name || '-'}</div>)}</div></div> : <div className="chs-teams"><div className={match.winnerId === match.team1Id ? 'is-winner' : match.winnerId ? 'is-loser' : ''}>{match.winnerId === match.team1Id ? '✓ ' : ''}{teamsById.get(match.team1Id)?.name || '-'}</div><b>VS</b><div className={match.winnerId === match.team2Id ? 'is-winner' : match.winnerId ? 'is-loser' : ''}>{match.winnerId === match.team2Id ? '✓ ' : ''}{teamsById.get(match.team2Id)?.name || '-'}</div></div>}</article>;
}

function GroupTable({ group, standings, t }) {
  return <section className="chs-card"><h2>{group.name}</h2><table><thead><tr><th>#</th><th>{t.teams}</th><th>{t.played}</th><th>{t.wins}</th><th>{t.losses}</th><th>{t.points}</th></tr></thead><tbody>{standings.map(entry => <tr key={entry.teamId}><td>{entry.rank}</td><td>{entry.name}</td><td>{entry.played}</td><td>{entry.wins}</td><td>{entry.losses}</td><td><strong>{entry.points}</strong></td></tr>)}</tbody></table></section>;
}

function Bracket({ bracket, teamsById, title, t }) {
  if (!bracket) return null;
  return <section className="chs-card chs-bracket"><h2>{title}</h2><div>{bracket.rounds.map(round => <section key={round.number}><h3>{t.round} {round.number}</h3>{round.matches.map(match => <div className="chs-bracket-match" key={match.id}><span>{teamsById.get(match.team1Id)?.name || 'BYE'}</span><b>{match.matchType === 'third' ? t.third : 'VS'}</b><span>{teamsById.get(match.team2Id)?.name || 'BYE'}</span>{match.winnerId ? <em>✓ {teamsById.get(match.winnerId)?.name}</em> : null}</div>)}</section>)}</div></section>;
}

function Podium({ bracket, teamsById, title, t }) {
  if (!bracket) return null;
  return <section className="chs-card chs-podium"><h2>{title}</h2><div className="first"><span>1</span><strong>{teamsById.get(bracket.championId)?.name || '-'}</strong><small>{t.champion}</small></div><div><span>2</span><strong>{teamsById.get(bracket.runnerUpId)?.name || '-'}</strong><small>{t.runnerUp}</small></div><div><span>3</span><strong>{teamsById.get(bracket.thirdId)?.name || '-'}</strong><small>{t.third}</small></div></section>;
}

function SectionTitle({ title, page }) {
  return <div className="chs-section-title"><h2>{title}</h2>{page ? <span>{page}</span> : null}</div>;
}

function chunk(items, size) {
  const pages = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages.length ? pages : [[]];
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
