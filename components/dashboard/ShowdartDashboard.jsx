'use client';

import { CalendarDays, ClipboardList, Copy, ExternalLink, GitBranch, MoreVertical, Plus, RefreshCw, ShieldCheck, Trophy, Upload, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addFixedTeam,
  addPlayer,
  assignMatchLane,
  completeRound,
  configureTournament,
  generateMatches,
  getActiveEntries,
  getEntries,
  getMatchLabel,
  getSkippedEntries,
  normalizeTournamentState,
  removeEntry,
  resetTournament,
  selectWinner,
  setActiveLane,
  showStandingsOverride,
  startTournament,
  updateEntryLosses
} from '../../lib/tournament/reactEngine';

const texts = {
  da: {
    registration: 'Registrering',
    tournament: 'Turnering',
    admin: 'Admin',
    rules: 'Regler',
    logout: 'Log ud',
    brandSub: 'Turnering',
    setup: 'Turneringsopsætning',
    quick: 'Hurtige handlinger',
    participants: 'Deltagere',
    lanes: 'Baner',
    currentRound: 'Aktuel runde',
    nextRound: 'Næste runde',
    addParticipant: 'Tilføj deltager',
    importParticipants: 'Importer deltagere',
    bracket: 'Se turneringstræ',
    editSetup: 'Redigér opsætning',
    spectator: 'Publikumsskærm',
    openSpectator: 'Åbn publikumsskærm',
    copy: 'Kopier link',
    liveActive: 'Live opdateringer aktive',
    tournamentName: 'Turneringsnavn',
    format: 'Turneringsformat',
    participantsCount: 'Antal deltagere',
    lanesCount: 'Antal baner',
    losses: 'Nederlag',
    status: 'Status',
    started: 'I gang',
    waiting: 'Venter',
    active: 'I spil',
    start: 'Start turnering',
    generate: 'Generer næste runde',
    complete: 'Afslut runde',
    reset: 'Nulstil turnering',
    showStandings: 'Vis stilling 30 sek.',
    changing: 'Skiftende makkere',
    fixed: 'Faste makkere',
    name: 'Navn',
    roleStatus: 'Status',
    seed: 'Seed',
    all: 'Alle',
    search: 'Søg deltagere...',
    playerName: 'Spillernavn',
    memberOne: 'Spiller 1',
    memberTwo: 'Spiller 2',
    add: 'Tilføj',
    round: 'Runde',
    match: 'Kamp',
    ready: 'Klar til kamp',
    winner: 'Vinder',
    selectWinner: 'Markér vinder',
    sitOver: 'Sidder over',
    noMatches: 'Ingen kampe genereret endnu',
    statusLabel: 'Turneringsstatus',
    current: 'Aktuel runde',
    matchesPlayed: 'Kampe spillet',
    lanesInUse: 'Baner i brug',
    lastUpdate: 'Sidste opdatering'
  },
  en: {
    registration: 'Registration',
    tournament: 'Tournament',
    admin: 'Admin',
    rules: 'Rules',
    logout: 'Logout',
    brandSub: 'Tournament',
    setup: 'Tournament setup',
    quick: 'Quick actions',
    participants: 'Participants',
    lanes: 'Lanes',
    currentRound: 'Current round',
    nextRound: 'Next round',
    addParticipant: 'Add participant',
    importParticipants: 'Import participants',
    bracket: 'View bracket',
    editSetup: 'Edit setup',
    spectator: 'Spectator screen',
    openSpectator: 'Open spectator screen',
    copy: 'Copy link',
    liveActive: 'Live updates active',
    tournamentName: 'Tournament name',
    format: 'Tournament format',
    participantsCount: 'Participants',
    lanesCount: 'Lanes',
    losses: 'Losses',
    status: 'Status',
    started: 'In progress',
    waiting: 'Waiting',
    active: 'In play',
    start: 'Start tournament',
    generate: 'Generate next round',
    complete: 'Complete round',
    reset: 'Reset tournament',
    showStandings: 'Show standings 30 sec.',
    changing: 'Changing teammates',
    fixed: 'Fixed teammates',
    name: 'Name',
    roleStatus: 'Status',
    seed: 'Seed',
    all: 'All',
    search: 'Search participants...',
    playerName: 'Player name',
    memberOne: 'Player 1',
    memberTwo: 'Player 2',
    add: 'Add',
    round: 'Round',
    match: 'Match',
    ready: 'Ready to play',
    winner: 'Winner',
    selectWinner: 'Select winner',
    sitOver: 'Sitting out',
    noMatches: 'No matches generated yet',
    statusLabel: 'Tournament status',
    current: 'Current round',
    matchesPlayed: 'Matches played',
    lanesInUse: 'Lanes in use',
    lastUpdate: 'Last update'
  }
};

export function ShowdartDashboard({
  lang,
  role,
  email,
  session,
  screenInfo,
  screenNotice,
  screenError,
  onCopyScreenLink,
  onOpenAdmin,
  onOpenRules,
  onLogout,
  onLanguageChange,
  onStateSync
}) {
  const t = texts[lang] || texts.da;
  const [state, setState] = useState(() => normalizeTournamentState(null));
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    tournamentName: '',
    teammateMode: 'changing',
    maxLosses: 2,
    laneCount: 4
  });
  const [playerName, setPlayerName] = useState('');
  const [memberOne, setMemberOne] = useState('');
  const [memberTwo, setMemberTwo] = useState('');
  const [search, setSearch] = useState('');

  const token = session?.access_token;
  const entries = useMemo(() => getEntries(state), [state]);
  const activeEntries = useMemo(() => getActiveEntries(state), [state]);
  const skippedEntries = useMemo(() => getSkippedEntries(state), [state]);
  const isRoundActive = state.matches.length > 0 || skippedEntries.length > 0;
  const matchesPlayed = state.roundHistory?.reduce((total, round) => total + (round.matches?.length || 0), 0) || 0;

  const persist = useCallback(async nextState => {
    if (!token) return;
    await fetch('/api/tournament-state', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ id: 'showdart-default', state: nextState })
    });
    onStateSync?.({
      tournamentId: 'showdart-default',
      state: nextState,
      updatedAt: new Date().toISOString()
    });
  }, [onStateSync, token]);

  const commit = useCallback(updater => {
    setState(previous => {
      const next = normalizeTournamentState(typeof updater === 'function' ? updater(previous) : updater);
      persist(next).catch(error => setNotice(error instanceof Error ? error.message : 'Save failed'));
      return next;
    });
  }, [persist]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      const response = await fetch('/api/tournament-state?id=showdart-default', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (cancelled) return;
      if (response.ok) {
        const payload = await response.json();
        const next = normalizeTournamentState(payload.state);
        setState(next);
        setForm({
          tournamentName: next.tournamentName || '',
          teammateMode: next.teammateMode,
          maxLosses: next.maxLosses,
          laneCount: next.laneCount
        });
      }
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function navButton(key, label, Icon, onClick) {
    return (
      <button type="button" className={key === 'tournament' ? 'is-active' : ''} onClick={onClick} aria-current={key === 'tournament' ? 'page' : undefined}>
        <Icon size={20} strokeWidth={1.8} />
        {label}
      </button>
    );
  }

  function handleAddEntry(event) {
    event.preventDefault();
    commit(previous => previous.teammateMode === 'fixed'
      ? addFixedTeam(previous, memberOne, memberTwo)
      : addPlayer(previous, playerName));
    setPlayerName('');
    setMemberOne('');
    setMemberTwo('');
  }

  function handleStart() {
    const nextConfig = {
      tournamentName: form.tournamentName || 'Klubmesterskab 2025',
      teammateMode: form.teammateMode,
      maxLosses: form.maxLosses,
      laneCount: form.laneCount
    };
    setForm(nextConfig);
    commit(previous => startTournament(configureTournament(previous, nextConfig), nextConfig));
  }

  function handleGenerate() {
    commit(previous => generateMatches(previous));
  }

  function handleComplete() {
    if (state.matches.some(match => !match.winner)) {
      setNotice('Marker vinder i alle kampe først.');
      return;
    }
    commit(previous => completeRound(previous));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const visibleEntries = entries.filter(entry => entry.name.toLowerCase().includes(search.toLowerCase()));
  const tournamentTitle = state.tournamentName || form.tournamentName || 'Klubmesterskab 2025';

  return (
    <main className="sd-page">
      <header className="sd-topbar">
        <div className="sd-brand">
          <div className="sd-logo-mark" />
          <div>
            <div className="sd-brand-title">Showdart</div>
            <div className="sd-brand-subtitle">{t.brandSub}</div>
          </div>
        </div>
        <nav className="sd-nav">
          {navButton('registration', t.registration, ClipboardList, () => {})}
          {navButton('tournament', t.tournament, Trophy, () => {})}
          {role === 'admin' ? navButton('admin', t.admin, UsersRound, onOpenAdmin) : null}
          {navButton('rules', t.rules, ShieldCheck, onOpenRules)}
        </nav>
        <div className="sd-userbar">
          <span>{email} ({role})</span>
          <button type="button" aria-label="Dansk" className={`sd-flag ${lang === 'da' ? 'is-active' : ''}`} style={{ backgroundImage: "url('https://flagcdn.com/w40/dk.png')" }} onClick={() => onLanguageChange('da')} />
          <button type="button" aria-label="English" className={`sd-flag ${lang === 'en' ? 'is-active' : ''}`} style={{ backgroundImage: "url('https://flagcdn.com/w40/gb.png')" }} onClick={() => onLanguageChange('en')} />
          <button type="button" className="sd-logout" onClick={onLogout}>{t.logout}</button>
        </div>
      </header>

      <section className="sd-hero">
        <div className="sd-hero-inner">
          <div className="sd-card sd-hero-card">
            <h1 className="sd-title">{tournamentTitle}</h1>
            <div className="sd-meta-row">
              <span><UsersRound size={16} /> {entries.length} {lang === 'da' ? 'deltagere' : 'participants'}</span>
              <span>{state.teammateMode === 'fixed' ? t.fixed : t.changing}</span>
              <span><RefreshCw size={16} /> {state.maxLosses} {t.losses}</span>
              <span><CalendarDays size={16} /> {new Date().toLocaleDateString(lang === 'da' ? 'da-DK' : 'en-US')}</span>
            </div>
          </div>
          <div className="sd-card sd-spectator-card">
            <div className="sd-small-label">{t.spectator}</div>
            <div className="sd-live"><span className="sd-dot" /> {screenInfo?.screenUrl ? t.liveActive : '...'}</div>
            {screenNotice || screenError || notice ? <div className="sd-small-label" style={{ marginTop: 8 }}>{screenNotice || screenError || notice}</div> : null}
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <button type="button" className="sd-button gold full" disabled={!screenInfo?.screenUrl} onClick={() => screenInfo?.screenUrl && window.open(screenInfo.screenUrl, '_blank', 'noopener,noreferrer')}>
                {t.openSpectator} <ExternalLink size={15} />
              </button>
              <button type="button" className="sd-button full" disabled={!screenInfo?.screenUrl} onClick={onCopyScreenLink}>
                {t.copy} <Copy size={15} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="sd-dashboard">
        <div className="sd-stack">
          <Panel title={t.setup}>
            <div className="sd-form-grid">
              <Field label={t.tournamentName}><input className="sd-input" value={form.tournamentName || state.tournamentName || ''} onChange={event => setForm({ ...form, tournamentName: event.target.value })} /></Field>
              <Field label={t.format}>
                <select className="sd-select" value={form.teammateMode} disabled={state.started} onChange={event => setForm({ ...form, teammateMode: event.target.value })}>
                  <option value="changing">{t.changing}</option>
                  <option value="fixed">{t.fixed}</option>
                </select>
              </Field>
              <Field label={t.losses}><input className="sd-input" type="number" min="1" value={form.maxLosses} onChange={event => setForm({ ...form, maxLosses: Number(event.target.value) })} /></Field>
              <Field label={t.lanesCount}><input className="sd-input" type="number" min="1" max="32" value={form.laneCount} disabled={state.started} onChange={event => setForm({ ...form, laneCount: Number(event.target.value) })} /></Field>
              <Field label={t.status}><span className="sd-green-text">{state.started ? t.started : t.waiting}</span></Field>
              {!state.started ? <button type="button" className="sd-button gold full" onClick={handleStart}>{t.start}</button> : null}
            </div>
          </Panel>
          <Panel title={t.quick}>
            <div className="sd-stack">
              <form onSubmit={handleAddEntry} className="sd-stack">
                {state.teammateMode === 'fixed' ? (
                  <>
                    <input className="sd-input" placeholder={t.memberOne} value={memberOne} onChange={event => setMemberOne(event.target.value)} />
                    <input className="sd-input" placeholder={t.memberTwo} value={memberTwo} onChange={event => setMemberTwo(event.target.value)} />
                  </>
                ) : (
                  <input className="sd-input" placeholder={t.playerName} value={playerName} onChange={event => setPlayerName(event.target.value)} />
                )}
                <button type="submit" className="sd-button gold full"><Plus size={17} /> {t.addParticipant}</button>
              </form>
              <button type="button" className="sd-button full"><Upload size={17} /> {t.importParticipants}</button>
              <button type="button" className="sd-button full"><GitBranch size={17} /> {t.bracket}</button>
            </div>
          </Panel>
        </div>

        <Panel title={`${t.participants} (${entries.length})`}>
          <div className="sd-participant-tools">
            <input className="sd-input" placeholder={t.search} value={search} onChange={event => setSearch(event.target.value)} />
            <select className="sd-select" value="all" readOnly><option>{t.all}</option></select>
          </div>
          <div className="sd-table-wrap">
          <table className="sd-table">
            <thead><tr><th></th><th>{t.name}</th><th>{t.roleStatus}</th><th>{t.seed}</th><th></th></tr></thead>
            <tbody>
              {visibleEntries.slice(0, 10).map((entry, index) => (
                <tr key={entry.id}>
                  <td><span className="sd-seed">{index + 1}</span></td>
                  <td>{entry.name}</td>
                  <td>{entry.active ? t.active : 'Ude'}</td>
                  <td><input className="sd-input" style={{ width: 58, padding: 5 }} type="number" min="0" value={entry.losses || 0} onChange={event => commit(previous => updateEntryLosses(previous, entry.id, Number(event.target.value)))} /></td>
                  <td><button type="button" className="sd-button" style={{ minHeight: 32, padding: 5 }} onClick={() => commit(previous => removeEntry(previous, entry.id))}><MoreVertical size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Panel>

        <Panel title={t.lanes}>
          <div className="sd-lane-list">
            {Array.from({ length: state.laneCount }, (_, index) => index + 1).map(lane => {
              const match = state.matches.find(item => item.laneNumber === lane);
              const active = state.activeLanes.includes(lane);
              return (
                <div className="sd-lane-card" key={lane}>
                  <div className="sd-mini-board" />
                  <div>
                    <div className="sd-lane-title">Bane {lane}</div>
                    <div>{match ? `${t.match} #${match.id} - ${t.round} ${state.currentRound}` : active ? t.ready : 'Inaktiv'}</div>
                    <div className="sd-green-text">{match ? getWinnerLine(state, match, t) : active ? t.ready : ''}</div>
                    {!isRoundActive ? <button type="button" className={`sd-button ${active ? 'gold' : ''}`} style={{ minHeight: 32, marginTop: 8 }} onClick={() => commit(previous => setActiveLane(previous, lane, !active))}>Bane {lane}</button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title={t.currentRound} action={!isRoundActive && state.started ? <button type="button" className="sd-button gold" onClick={handleGenerate}>{t.nextRound}</button> : null}>
          <div className="sd-match-list">
            {isRoundActive ? (
              <>
                {state.matches.map(match => (
                  <MatchCard
                    key={match.id}
                    state={state}
                    match={match}
                    t={t}
                    onWinner={winner => commit(previous => selectWinner(previous, match.id, winner))}
                    onLane={lane => commit(previous => assignMatchLane(previous, match.id, lane))}
                  />
                ))}
                {skippedEntries.length ? <div className="sd-lane-card"><div className="sd-mini-board" /><div><div className="sd-lane-title">{t.sitOver}</div><div>{skippedEntries.map(entry => entry.name).join(', ')}</div></div></div> : null}
                <button type="button" className="sd-button" onClick={() => commit(previous => showStandingsOverride(previous))}>{t.showStandings}</button>
                <button type="button" className="sd-button gold" onClick={handleComplete}>{t.complete}</button>
              </>
            ) : (
              <>
                <div className="sd-small-label">{state.started ? t.ready : t.noMatches}</div>
                {state.started ? <button type="button" className="sd-button gold" onClick={handleGenerate}>{t.generate}</button> : null}
              </>
            )}
            <button type="button" className="sd-button danger" onClick={() => commit(resetTournament())}>{t.reset}</button>
          </div>
        </Panel>
      </section>

      <footer className="sd-bottom">
        <BottomItem label={t.statusLabel} value={state.started ? t.started : t.waiting} green />
        <BottomItem label={t.participants} value={`${activeEntries.length} / ${entries.length}`} />
        <BottomItem label={t.current} value={`${state.currentRound || 0}`} />
        <BottomItem label={t.matchesPlayed} value={`${matchesPlayed} / ${matchesPlayed + state.matches.length}`} />
        <BottomItem label={t.lanesInUse} value={`${state.activeLanes.length} / ${state.laneCount}`} />
        <BottomItem label={t.lastUpdate} value={loaded ? new Date().toLocaleTimeString('da-DK') : '...'} />
      </footer>
    </main>
  );
}

function Panel({ title, action, children }) {
  return (
    <div className="sd-card sd-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 className="sd-panel-title">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return <div className="sd-field"><label>{label}</label>{children}</div>;
}

function MatchCard({ state, match, t, onWinner, onLane }) {
  const team1 = getMatchLabel(state, match, 1);
  const team2 = getMatchLabel(state, match, 2);
  return (
    <div className="sd-match-card">
      <div className="sd-match-head">
        <div className="sd-match-title">{t.match} #{match.id} - Bane {match.laneNumber || '-'}</div>
        <span className="sd-pill">{match.winner ? 'Klar' : t.started}</span>
      </div>
      <div className="sd-score-row">
        <div className="sd-match-side"><div className="sd-match-name">{team1}</div><div className="sd-match-sub">Seed {match.id * 2 - 1}</div></div>
        <button className={`sd-score-box ${match.winner === 1 ? 'win' : ''}`} type="button" onClick={() => onWinner(1)}>{match.winner === 1 ? '✓' : '-'}</button>
        <div style={{ textAlign: 'center', fontWeight: 900 }}>VS</div>
        <button className={`sd-score-box ${match.winner === 2 ? 'win' : ''}`} type="button" onClick={() => onWinner(2)}>{match.winner === 2 ? '✓' : '-'}</button>
        <div className="sd-match-side right"><div className="sd-match-name">{team2}</div><div className="sd-match-sub">Seed {match.id * 2}</div></div>
      </div>
      <select className="sd-select" style={{ marginTop: 10 }} value={match.laneNumber || ''} onChange={event => onLane(event.target.value ? Number(event.target.value) : null)}>
        <option value="">Venter</option>
        {Array.from({ length: state.laneCount }, (_, index) => index + 1).map(lane => <option key={lane} value={lane}>Bane {lane}</option>)}
      </select>
    </div>
  );
}

function BottomItem({ label, value, green }) {
  return <div className="sd-bottom-item"><div className="sd-bottom-label">{label}</div><div className={`sd-bottom-value ${green ? 'sd-green-text' : ''}`}>{value}</div></div>;
}

function getWinnerLine(state, match, t) {
  if (!match.winner) return t.ready;
  return `${t.winner}: ${getMatchLabel(state, match, match.winner)}`;
}

