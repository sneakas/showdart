'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ExternalLink, Eye, EyeOff, History, Medal, Plus, RefreshCw, RotateCcw, Trophy, UsersRound, X } from 'lucide-react';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';
import {
  addChampionshipTeam,
  addPointsAdjustment,
  advanceToABGroups,
  allocateInitialGroups,
  assignChampionshipMatchLane,
  completeChampionshipRound,
  configureChampionship,
  createDefaultChampionshipState,
  generateChampionshipPlayoffs,
  generateRequiredTieBreaks,
  getChampionshipMatchStatus,
  getCurrentMatches,
  getDivisionBracket,
  getGroupStandings,
  hideChampionshipRound,
  moveChampionshipMatchInQueue,
  normalizeChampionshipState,
  publishChampionshipRound,
  replacePlayoffTeam,
  setChampionshipActiveLane,
  setChampionshipWinner,
  setPlayoffSeedOrder,
  swapTeamsBetweenGroups,
  updateChampionshipQualificationSettings,
  withdrawChampionshipTeam
} from '../../lib/championship/engine';
import '../dashboard.css';
import './championship.css';

const TOURNAMENT_ID = 'showdart-championship';
const LANGUAGE_STORAGE_KEY = 'showdart-language';

const texts = {
  da: {
    loading: 'Indlæser mesterskab...', login: 'Log ind på forsiden for at fortsætte', championship: 'Mesterskab', tournament: 'Turnering', admin: 'Admin', logout: 'Log ud',
    setup: 'Mesterskabsopsætning', name: 'Navn', initialGroups: 'Første grupper', aQualifiers: 'Til A pr. gruppe', aGroups: 'A-grupper', bGroups: 'B-grupper',
    aPlayoff: 'A-slutspil pr. gruppe', bPlayoff: 'B-slutspil pr. gruppe', allocation: 'Fordeling', seeded: 'Seedet', random: 'Tilfældig', manual: 'Manuel', lanes: 'Baner',
    teams: 'Hold', memberOne: 'Spiller 1', memberTwo: 'Spiller 2', seed: 'Seed', addTeam: 'Tilføj hold', createGroups: 'Opret første grupper',
    spectator: 'Publikumsskærm', openScreen: 'Åbn publikumsskærm', copyLink: 'Kopier link', copied: 'Link kopieret',
    registration: 'Registrering', initialStage: 'Første gruppespil', abStage: 'A/B-gruppespil', playoffs: 'Slutspil', finished: 'Afsluttet',
    currentRound: 'Aktuel spillerunde', publish: 'Offentliggør runde', hide: 'Skjul runde', completeRound: 'Afslut spillerunde', draft: 'Kladde', live: 'Offentliggjort',
    playing: 'Spiller nu', queued: 'Næste kamp', completed: 'Afsluttet', waitingLane: 'Venter på bane', winner: 'Vinder', round: 'Runde', match: 'Kamp',
    standings: 'Stilling', played: 'Spillet', wins: 'Sejre', losses: 'Nederlag', points: 'Point', adjustment: 'Justering',
    swapTeams: 'Byt hold mellem grupper', firstTeam: 'Første hold', secondTeam: 'Andet hold', swap: 'Byt hold',
    stageActions: 'Stadiehandlinger', createAB: 'Opret A/B-grupper', createPlayoffs: 'Opret A/B-slutspil', tieBreak: 'Generer tie-break kampe',
    qualification: 'Slutspilskvalifikation', drawMode: 'Lodtrækning', update: 'Opdater',
    corrections: 'Resultater og korrektioner', correctionReason: 'Begrundelse for korrektion', showSchedule: 'Vis alle kampe', hideSchedule: 'Skjul alle kampe',
    addAdjustment: 'Tilføj pointjustering', reason: 'Begrundelse', value: 'Point +/-', group: 'Gruppe', team: 'Hold',
    withdraw: 'Træk hold', keepResults: 'Behold færdige resultater', voidResults: 'Annuller alle resultater', cancel: 'Annuller',
    withdrawQuestion: 'Hvordan skal allerede spillede resultater behandles?', activeLanes: 'Aktive baner', audit: 'Ændringslog',
    aBracket: 'A-slutspil', bBracket: 'B-slutspil', champion: 'Mester', third: '3. plads', replace: 'Erstat hold', noMatches: 'Ingen aktuelle kampe',
    confirm: 'Bekræft handling', publishConfirm: 'Offentliggør kampe og baner på publikumsskærmen?', completeConfirm: 'Afslut spillerunden og gå videre?', reset: 'Nulstil mesterskab', resetConfirm: 'Nulstil hele mesterskabet og slet alle hold og resultater?'
  },
  en: {
    loading: 'Loading championship...', login: 'Log in on the front page to continue', championship: 'Championship', tournament: 'Tournament', admin: 'Admin', logout: 'Logout',
    setup: 'Championship setup', name: 'Name', initialGroups: 'Initial groups', aQualifiers: 'To A per group', aGroups: 'A groups', bGroups: 'B groups',
    aPlayoff: 'A playoff per group', bPlayoff: 'B playoff per group', allocation: 'Allocation', seeded: 'Seeded', random: 'Random', manual: 'Manual', lanes: 'Lanes',
    teams: 'Teams', memberOne: 'Player 1', memberTwo: 'Player 2', seed: 'Seed', addTeam: 'Add team', createGroups: 'Create initial groups',
    spectator: 'Spectator screen', openScreen: 'Open spectator screen', copyLink: 'Copy link', copied: 'Link copied',
    registration: 'Registration', initialStage: 'Initial groups', abStage: 'A/B groups', playoffs: 'Playoffs', finished: 'Finished',
    currentRound: 'Current round', publish: 'Publish round', hide: 'Hide round', completeRound: 'Complete round', draft: 'Draft', live: 'Published',
    playing: 'Playing now', queued: 'Next match', completed: 'Completed', waitingLane: 'Waiting for lane', winner: 'Winner', round: 'Round', match: 'Match',
    standings: 'Standings', played: 'Played', wins: 'Wins', losses: 'Losses', points: 'Points', adjustment: 'Adjustment',
    swapTeams: 'Swap teams between groups', firstTeam: 'First team', secondTeam: 'Second team', swap: 'Swap teams',
    stageActions: 'Stage actions', createAB: 'Create A/B groups', createPlayoffs: 'Create A/B playoffs', tieBreak: 'Generate tie-break matches',
    qualification: 'Playoff qualification', drawMode: 'Draw mode', update: 'Update',
    corrections: 'Results and corrections', correctionReason: 'Correction reason', showSchedule: 'Show all matches', hideSchedule: 'Hide all matches',
    addAdjustment: 'Add points adjustment', reason: 'Reason', value: 'Points +/-', group: 'Group', team: 'Team',
    withdraw: 'Withdraw team', keepResults: 'Keep completed results', voidResults: 'Void all results', cancel: 'Cancel',
    withdrawQuestion: 'How should completed results be handled?', activeLanes: 'Active lanes', audit: 'Audit log',
    aBracket: 'A playoffs', bBracket: 'B playoffs', champion: 'Champion', third: '3rd place', replace: 'Replace team', noMatches: 'No current matches',
    confirm: 'Confirm action', publishConfirm: 'Publish matches and lanes to spectator screens?', completeConfirm: 'Complete this round and continue?', reset: 'Reset championship', resetConfirm: 'Reset the championship and delete all teams and results?'
  }
};

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'da';
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'en' ? 'en' : 'da';
}

export default function ChampionshipPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [lang, setLang] = useState('da');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState('user');
  const [email, setEmail] = useState('');
  const [state, setState] = useState(() => createDefaultChampionshipState());
  const [screenInfo, setScreenInfo] = useState(null);
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState(null);
  const [withdrawTeam, setWithdrawTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ memberOne: '', memberTwo: '', seed: 1, groupId: '' });
  const [swapForm, setSwapForm] = useState({ first: '', second: '' });
  const [adjustmentForm, setAdjustmentForm] = useState({ teamId: '', groupId: '', points: 0, reason: '' });
  const [correctionReason, setCorrectionReason] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [manualSeeds, setManualSeeds] = useState({ A: [], B: [] });
  const [replacementForm, setReplacementForm] = useState({ division: 'A', oldTeamId: '', newTeamId: '' });
  const [showAudit, setShowAudit] = useState(false);
  const channelRef = useRef(null);
  const t = texts[lang] || texts.da;

  const teamsById = useMemo(() => new Map(state.teams.map(team => [team.id, team])), [state.teams]);
  const currentMatches = useMemo(() => getCurrentMatches(state), [state]);
  const currentGroups = useMemo(() => state.groups.filter(group => state.phase === 'initial_groups' ? group.division === 'INITIAL' : state.phase === 'ab_groups' ? ['A', 'B'].includes(group.division) : ['A', 'B'].includes(group.division)), [state.groups, state.phase]);

  useEffect(() => {
    const initial = getInitialLanguage();
    setLang(initial);
    document.documentElement.lang = initial;
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session || null);
      setEmail(data.session?.user?.email || '');
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setEmail(nextSession?.user?.email || '');
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/profile/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(response => response.json().then(payload => ({ response, payload })))
      .then(({ response, payload }) => {
        if (response.ok) {
          setRole(payload.role || 'user');
          setEmail(payload.email || session.user?.email || '');
        }
      });
  }, [session]);

  useEffect(() => {
    if (!session?.access_token) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/tournament-state?id=${TOURNAMENT_ID}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
      fetch(`/api/tournament-screen?id=${TOURNAMENT_ID}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
    ]).then(async ([stateResponse, screenResponse]) => {
      const statePayload = await stateResponse.json();
      const screenPayload = await screenResponse.json();
      if (cancelled) return;
      if (stateResponse.ok) setState(normalizeChampionshipState(statePayload.state));
      if (screenResponse.ok) setScreenInfo(screenPayload);
    });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!supabase || !screenInfo?.realtimeChannel) return undefined;
    const channel = supabase.channel(screenInfo.realtimeChannel, { config: { broadcast: { self: false } } });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [screenInfo, supabase]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (state.phase !== 'ab_groups' || !state.stageComplete) return;
    const next = { A: [], B: [] };
    ['A', 'B'].forEach(division => {
      const count = division === 'A' ? state.config.aPlayoffQualifiersPerGroup : state.config.bPlayoffQualifiersPerGroup;
      next[division] = state.groups.filter(group => group.division === division).flatMap(group => getGroupStandings(state, group.id).slice(0, count).map(entry => entry.teamId));
    });
    setManualSeeds(next);
  }, [state.phase, state.stageComplete, state.config.aPlayoffQualifiersPerGroup, state.config.bPlayoffQualifiersPerGroup, state.groups, state.matches]);

  async function persist(next) {
    if (!session?.access_token) return;
    const updatedAt = new Date().toISOString();
    const response = await fetch('/api/tournament-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: TOURNAMENT_ID, state: next })
    });
    if (!response.ok) throw new Error('Kunne ikke gemme mesterskabet.');
    await channelRef.current?.send({ type: 'broadcast', event: 'tournament-state', payload: { tournamentId: TOURNAMENT_ID, state: next, updatedAt } });
  }

  function commit(updater) {
    setState(previous => {
      const next = normalizeChampionshipState(typeof updater === 'function' ? updater(previous) : updater);
      if (next.lastError) setDialog({ message: next.lastError, confirm: null });
      persist(next).catch(error => setDialog({ message: error.message, confirm: null }));
      return next;
    });
  }

  function confirm(messageText, action) {
    setDialog({ message: messageText, confirm: action });
  }

  function changeLanguage(next) {
    setLang(next);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    document.documentElement.lang = next;
  }

  async function logout() {
    await supabase?.auth.signOut();
    window.location.href = '/';
  }

  function handleAddTeam(event) {
    event.preventDefault();
    commit(previous => addChampionshipTeam(previous, teamForm.memberOne, teamForm.memberTwo, { seed: teamForm.seed, groupId: teamForm.groupId || undefined }));
    setTeamForm(previous => ({ ...previous, memberOne: '', memberTwo: '', seed: state.teams.length + 2 }));
  }

  function handleGeneratePlayoffs() {
    commit(previous => {
      let next = previous;
      if (previous.config.aPlayoffDrawMode === 'manual') next = setPlayoffSeedOrder(next, 'A', manualSeeds.A);
      if (previous.config.bPlayoffDrawMode === 'manual') next = setPlayoffSeedOrder(next, 'B', manualSeeds.B);
      return generateChampionshipPlayoffs(next);
    });
  }

  function moveSeed(division, index, direction) {
    setManualSeeds(previous => {
      const list = [...previous[division]];
      const target = index + direction;
      if (target < 0 || target >= list.length) return previous;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...previous, [division]: list };
    });
  }

  if (loading) return <main className="sd-page ch-center">{t.loading}</main>;
  if (!session) return <main className="sd-page ch-center"><a className="sd-button gold" href="/">{t.login}</a></main>;

  const phaseLabel = state.phase === 'registration' ? t.registration : state.phase === 'initial_groups' ? t.initialStage : state.phase === 'ab_groups' ? t.abStage : state.phase === 'playoffs' ? t.playoffs : t.finished;

  return (
    <main className="sd-page ch-page">
      <header className="sd-topbar">
        <div className="sd-brand"><div className="sd-logo-mark" /><div><div className="sd-brand-title">Showdart</div><div className="sd-brand-subtitle">Turnering</div></div></div>
        <nav className="sd-nav">
          <button type="button" onClick={() => { window.location.href = '/'; }}><Trophy size={20} />{t.tournament}</button>
          <button type="button" className="is-active"><Medal size={20} />{t.championship}</button>
          {role === 'admin' ? <button type="button" onClick={() => { window.location.href = '/admin'; }}><UsersRound size={20} />{t.admin}</button> : null}
        </nav>
        <div className="sd-userbar">
          <span>{email} ({role})</span>
          <button type="button" aria-label="Dansk" className={`sd-flag ${lang === 'da' ? 'is-active' : ''}`} style={{ backgroundImage: "url('https://flagcdn.com/w40/dk.png')" }} onClick={() => changeLanguage('da')} />
          <button type="button" aria-label="English" className={`sd-flag ${lang === 'en' ? 'is-active' : ''}`} style={{ backgroundImage: "url('https://flagcdn.com/w40/gb.png')" }} onClick={() => changeLanguage('en')} />
          <button type="button" className="sd-logout" onClick={logout}>{t.logout}</button>
        </div>
      </header>

      <section className="ch-hero">
        <div><span>{phaseLabel}</span><h1>{state.tournamentName || t.championship}</h1><p>{state.teams.filter(team => !team.withdrawn).length} {t.teams} · {state.activeLanes.length} {t.lanes}</p></div>
        <div className="ch-hero-actions">
          <button type="button" className="sd-button gold" disabled={!screenInfo?.screenUrl} onClick={() => window.open(screenInfo.screenUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /> {t.openScreen}</button>
          <button type="button" className="sd-button" disabled={!screenInfo?.screenUrl} onClick={async () => { await navigator.clipboard.writeText(screenInfo.screenUrl); setMessage(t.copied); }}>{t.copyLink}</button>
          <button type="button" className="sd-button danger" onClick={() => confirm(t.resetConfirm, () => commit(createDefaultChampionshipState()))}><RotateCcw size={16} /> {t.reset}</button>
        </div>
      </section>

      {message ? <div className="ch-toast">{message}</div> : null}

      <section className="ch-workspace">
        <aside className="ch-column">
          <Card title={t.setup}>
            <div className="ch-form">
              <Field label={t.name}><input className="sd-input" value={state.tournamentName} disabled={state.started} onChange={event => commit(previous => configureChampionship(previous, { tournamentName: event.target.value }))} /></Field>
              <Field label={t.initialGroups}><NumberInput value={state.config.initialGroupCount} disabled={state.started} onChange={value => commit(previous => configureChampionship(previous, { initialGroupCount: value }))} /></Field>
              <Field label={t.aQualifiers}><NumberInput value={state.config.initialAQualifiersPerGroup} disabled={state.started} onChange={value => commit(previous => configureChampionship(previous, { initialAQualifiersPerGroup: value }))} /></Field>
              <Field label={t.aGroups}><NumberInput value={state.config.aGroupCount} disabled={state.started} onChange={value => commit(previous => configureChampionship(previous, { aGroupCount: value }))} /></Field>
              <Field label={t.bGroups}><NumberInput value={state.config.bGroupCount} disabled={state.started} onChange={value => commit(previous => configureChampionship(previous, { bGroupCount: value }))} /></Field>
              <Field label={t.aPlayoff}><NumberInput value={state.config.aPlayoffQualifiersPerGroup} disabled={['playoffs', 'finished'].includes(state.phase)} onChange={value => commit(previous => state.started ? updateChampionshipQualificationSettings(previous, { aPlayoffQualifiersPerGroup: value }) : configureChampionship(previous, { aPlayoffQualifiersPerGroup: value }))} /></Field>
              <Field label={t.bPlayoff}><NumberInput value={state.config.bPlayoffQualifiersPerGroup} disabled={['playoffs', 'finished'].includes(state.phase)} onChange={value => commit(previous => state.started ? updateChampionshipQualificationSettings(previous, { bPlayoffQualifiersPerGroup: value }) : configureChampionship(previous, { bPlayoffQualifiersPerGroup: value }))} /></Field>
              <Field label={t.allocation}><select className="sd-select" value={state.config.allocationMode} disabled={state.started} onChange={event => commit(previous => configureChampionship(previous, { allocationMode: event.target.value }))}><option value="seeded">{t.seeded}</option><option value="random">{t.random}</option><option value="manual">{t.manual}</option></select></Field>
              <Field label={t.lanes}><NumberInput value={state.config.laneCount} disabled={state.started} onChange={value => commit(previous => configureChampionship(previous, { laneCount: value }))} /></Field>
            </div>
          </Card>

          <Card title={`${t.teams} (${state.teams.length})`}>
            <form className="ch-form" onSubmit={handleAddTeam}>
              <input className="sd-input" placeholder={t.memberOne} value={teamForm.memberOne} onChange={event => setTeamForm(previous => ({ ...previous, memberOne: event.target.value }))} />
              <input className="sd-input" placeholder={t.memberTwo} value={teamForm.memberTwo} onChange={event => setTeamForm(previous => ({ ...previous, memberTwo: event.target.value }))} />
              <input className="sd-input" type="number" min="1" placeholder={t.seed} value={teamForm.seed} onChange={event => setTeamForm(previous => ({ ...previous, seed: Number(event.target.value) }))} />
              {state.started && GROUP_PHASE_OPTIONS(state).length ? <select className="sd-select" value={teamForm.groupId} onChange={event => setTeamForm(previous => ({ ...previous, groupId: event.target.value }))}><option value="">{t.group}</option>{GROUP_PHASE_OPTIONS(state).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select> : null}
              <button type="submit" className="sd-button gold"><Plus size={16} /> {t.addTeam}</button>
            </form>
            <div className="ch-team-list">
              {state.teams.map(team => <div key={team.id} className={`ch-team-row ${team.withdrawn ? 'is-out' : ''}`}><span className="sd-seed">{team.seed}</span><strong>{team.name}</strong><button type="button" className="sd-button" disabled={team.withdrawn} onClick={() => setWithdrawTeam(team)}><X size={14} /> {t.withdraw}</button></div>)}
            </div>
            {!state.started ? <button type="button" className="sd-button gold full" onClick={() => commit(previous => allocateInitialGroups(previous, previous.config.allocationMode))}>{t.createGroups}</button> : null}
          </Card>

          {state.started && GROUP_PHASE_OPTIONS(state).length ? <Card title={t.swapTeams}>
            <div className="ch-form"><select className="sd-select" value={swapForm.first} onChange={event => setSwapForm(previous => ({ ...previous, first: event.target.value }))}><option value="">{t.firstTeam}</option>{GROUP_PHASE_OPTIONS(state).flatMap(group => group.teamIds.map(id => <option key={`${group.id}-${id}`} value={id}>{group.name}: {teamsById.get(id)?.name}</option>))}</select><select className="sd-select" value={swapForm.second} onChange={event => setSwapForm(previous => ({ ...previous, second: event.target.value }))}><option value="">{t.secondTeam}</option>{GROUP_PHASE_OPTIONS(state).flatMap(group => group.teamIds.map(id => <option key={`${group.id}-${id}`} value={id}>{group.name}: {teamsById.get(id)?.name}</option>))}</select><button type="button" className="sd-button" onClick={() => commit(previous => swapTeamsBetweenGroups(previous, Number(swapForm.first), Number(swapForm.second)))}>{t.swap}</button></div>
          </Card> : null}

          <Card title={t.activeLanes}><div className="ch-lanes">{Array.from({ length: state.config.laneCount }, (_, index) => index + 1).map(lane => <button type="button" key={lane} className={`sd-lane-toggle ${state.activeLanes.includes(lane) ? 'is-active' : 'is-inactive'}`} onClick={() => commit(previous => setChampionshipActiveLane(previous, lane, !previous.activeLanes.includes(lane)))}><span className="sd-mini-board" /><span><strong>Bane {lane}</strong><small>{state.activeLanes.includes(lane) ? 'Aktiv' : 'Inaktiv'}</small></span></button>)}</div></Card>
        </aside>

        <div className="ch-main">
          {currentGroups.length ? <section className="ch-group-grid">{currentGroups.map(group => <GroupCard key={group.id} group={group} standings={getGroupStandings(state, group.id)} t={t} />)}</section> : null}

          {state.started && !['finished'].includes(state.phase) ? <Card title={`${t.currentRound} ${state.stageRound || ''}`} action={<span className={`ch-status ${state.roundPublished ? 'is-live' : ''}`}>{state.roundPublished ? t.live : t.draft}</span>}>
            <div className="ch-round-actions">
              {!state.roundPublished && currentMatches.length ? <button type="button" className="sd-button gold" onClick={() => confirm(t.publishConfirm, () => commit(publishChampionshipRound))}><Eye size={16} /> {t.publish}</button> : null}
              {state.roundPublished && !currentMatches.some(match => match.winnerId) ? <button type="button" className="sd-button" onClick={() => commit(hideChampionshipRound)}><EyeOff size={16} /> {t.hide}</button> : null}
              {currentMatches.length ? <button type="button" className="sd-button gold" disabled={!state.roundPublished} onClick={() => confirm(t.completeConfirm, () => commit(completeChampionshipRound))}><Check size={16} /> {t.completeRound}</button> : <span className="sd-small-label">{t.noMatches}</span>}
            </div>
            <div className="ch-match-grid">{currentMatches.map(match => <ChampionshipMatch key={match.id} match={match} state={state} teamsById={teamsById} t={t} onWinner={winnerId => commit(previous => setChampionshipWinner(previous, match.id, winnerId))} onLane={lane => commit(previous => assignChampionshipMatchLane(previous, match.id, lane))} onMove={direction => commit(previous => moveChampionshipMatchInQueue(previous, match.id, direction))} />)}</div>
          </Card> : null}

          {state.stageComplete && state.phase !== 'finished' ? <Card title={t.stageActions}>
            <div className="ch-action-row">
              <button type="button" className="sd-button" onClick={() => commit(generateRequiredTieBreaks)}>{t.tieBreak}</button>
              {state.phase === 'initial_groups' ? <button type="button" className="sd-button gold" onClick={() => commit(advanceToABGroups)}>{t.createAB}</button> : null}
              {state.phase === 'ab_groups' ? <button type="button" className="sd-button gold" onClick={handleGeneratePlayoffs}>{t.createPlayoffs}</button> : null}
            </div>
            {state.phase === 'ab_groups' ? <div className="ch-qualification">
              {['A', 'B'].map(division => <div key={division}><h3>{division}-{t.qualification}</h3><Field label={t.drawMode}><select className="sd-select" value={division === 'A' ? state.config.aPlayoffDrawMode : state.config.bPlayoffDrawMode} onChange={event => commit(previous => updateChampionshipQualificationSettings(previous, division === 'A' ? { aPlayoffDrawMode: event.target.value } : { bPlayoffDrawMode: event.target.value }))}><option value="seeded">{t.seeded}</option><option value="random">{t.random}</option><option value="manual">{t.manual}</option></select></Field>{(division === 'A' ? state.config.aPlayoffDrawMode : state.config.bPlayoffDrawMode) === 'manual' ? <div className="ch-seeds">{manualSeeds[division].map((id, index) => <div key={id}><span>{index + 1}. {teamsById.get(id)?.name}</span><button className="sd-button" disabled={!index} onClick={() => moveSeed(division, index, -1)}><ArrowUp size={13} /></button><button className="sd-button" disabled={index === manualSeeds[division].length - 1} onClick={() => moveSeed(division, index, 1)}><ArrowDown size={13} /></button></div>)}</div> : null}</div>)}
            </div> : null}
          </Card> : null}

          {['playoffs', 'finished'].includes(state.phase) ? <section className="ch-brackets"><BracketCard bracket={getDivisionBracket(state, 'A')} teamsById={teamsById} title={t.aBracket} t={t} /><BracketCard bracket={getDivisionBracket(state, 'B')} teamsById={teamsById} title={t.bBracket} t={t} /></section> : null}

          {state.phase === 'playoffs' ? <Card title={t.replace}>
            <div className="ch-replacement">
              <select className="sd-select" value={replacementForm.division} onChange={event => setReplacementForm(previous => ({ ...previous, division: event.target.value, oldTeamId: '' }))}><option value="A">A</option><option value="B">B</option></select>
              <select className="sd-select" value={replacementForm.oldTeamId} onChange={event => setReplacementForm(previous => ({ ...previous, oldTeamId: event.target.value }))}><option value="">{t.team}</option>{(state.brackets[replacementForm.division]?.seedTeamIds || []).map(id => <option key={id} value={id}>{teamsById.get(id)?.name}</option>)}</select>
              <select className="sd-select" value={replacementForm.newTeamId} onChange={event => setReplacementForm(previous => ({ ...previous, newTeamId: event.target.value }))}><option value="">{t.replace}</option>{state.teams.filter(team => !team.withdrawn && !(state.brackets[replacementForm.division]?.seedTeamIds || []).includes(team.id)).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
              <button type="button" className="sd-button" onClick={() => commit(previous => replacePlayoffTeam(previous, replacementForm.division, Number(replacementForm.oldTeamId), Number(replacementForm.newTeamId)))}>{t.replace}</button>
            </div>
          </Card> : null}

          {state.started ? <Card title={t.corrections} action={<button type="button" className="sd-button" onClick={() => setShowSchedule(value => !value)}><History size={15} /> {showSchedule ? t.hideSchedule : t.showSchedule}</button>}>
            <div className="ch-corrections"><input className="sd-input" placeholder={t.correctionReason} value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} /><div className="ch-adjustment"><select className="sd-select" value={adjustmentForm.groupId} onChange={event => setAdjustmentForm(previous => ({ ...previous, groupId: event.target.value }))}><option value="">{t.group}</option>{state.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><select className="sd-select" value={adjustmentForm.teamId} onChange={event => setAdjustmentForm(previous => ({ ...previous, teamId: event.target.value }))}><option value="">{t.team}</option>{state.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select><input className="sd-input" type="number" value={adjustmentForm.points} onChange={event => setAdjustmentForm(previous => ({ ...previous, points: Number(event.target.value) }))} /><input className="sd-input" placeholder={t.reason} value={adjustmentForm.reason} onChange={event => setAdjustmentForm(previous => ({ ...previous, reason: event.target.value }))} /><button type="button" className="sd-button" onClick={() => commit(previous => addPointsAdjustment(previous, Number(adjustmentForm.teamId), adjustmentForm.groupId, adjustmentForm.points, adjustmentForm.reason))}>{t.addAdjustment}</button></div></div>
            {showSchedule ? <div className="ch-schedule"><table className="sd-table"><thead><tr><th>{t.round}</th><th>{t.group}</th><th>{t.match}</th><th>{t.winner}</th></tr></thead><tbody>{state.matches.filter(match => !match.isBye).map(match => <tr key={match.id}><td>{match.round}</td><td>{match.groupId || match.bracketDivision || '-'}</td><td>{teamsById.get(match.team1Id)?.name || '-'} VS {teamsById.get(match.team2Id)?.name || '-'}</td><td><select className="sd-select" value={match.winnerId || ''} disabled={!correctionReason.trim()} onChange={event => commit(previous => setChampionshipWinner(previous, match.id, Number(event.target.value), correctionReason))}><option value="">-</option>{[match.team1Id, match.team2Id].filter(Boolean).map(id => <option key={id} value={id}>{teamsById.get(id)?.name}</option>)}</select></td></tr>)}</tbody></table></div> : null}
            <button type="button" className="sd-button ch-audit-toggle" onClick={() => setShowAudit(value => !value)}>{t.audit} ({state.auditLog.length})</button>
            {showAudit ? <div className="ch-audit-list">{[...state.auditLog].reverse().map(entry => <div key={entry.id}><time>{new Date(entry.createdAt).toLocaleString(lang === 'da' ? 'da-DK' : 'en-GB')}</time><strong>{entry.action}</strong><span>{JSON.stringify(entry.details)}</span></div>)}</div> : null}
          </Card> : null}
        </div>
      </section>

      <footer className="sd-bottom"><Bottom label={t.championship} value={phaseLabel} /><Bottom label={t.teams} value={state.teams.filter(team => !team.withdrawn).length} /><Bottom label={t.round} value={state.stageRound || 0} /><Bottom label={t.match} value={state.matches.filter(match => match.winnerId && !match.isBye).length} /><Bottom label={t.lanes} value={`${state.activeLanes.length}/${state.config.laneCount}`} /><Bottom label={t.audit} value={state.auditLog.length} /></footer>

      {withdrawTeam ? <div className="sd-dialog-backdrop"><div className="sd-dialog ch-dialog"><div className="sd-dialog-mark">!</div><div><h2 className="sd-dialog-title">{t.withdraw}: {withdrawTeam.name}</h2><p className="sd-dialog-message">{t.withdrawQuestion}</p></div><div className="sd-dialog-actions"><button className="sd-button" onClick={() => setWithdrawTeam(null)}>{t.cancel}</button><button className="sd-button" onClick={() => { commit(previous => withdrawChampionshipTeam(previous, withdrawTeam.id, 'keep')); setWithdrawTeam(null); }}>{t.keepResults}</button><button className="sd-button danger" onClick={() => { commit(previous => withdrawChampionshipTeam(previous, withdrawTeam.id, 'void')); setWithdrawTeam(null); }}>{t.voidResults}</button></div></div></div> : null}
      {dialog ? <div className="sd-dialog-backdrop"><div className="sd-dialog ch-dialog"><div className="sd-dialog-mark">!</div><div><h2 className="sd-dialog-title">{t.confirm}</h2><p className="sd-dialog-message">{dialog.message}</p></div><div className="sd-dialog-actions">{dialog.confirm ? <button className="sd-button" onClick={() => setDialog(null)}>{t.cancel}</button> : null}<button className="sd-button gold" onClick={() => { const action = dialog.confirm; setDialog(null); action?.(); }}>{dialog.confirm ? t.confirm : 'OK'}</button></div></div></div> : null}
    </main>
  );
}

function GROUP_PHASE_OPTIONS(state) {
  return state.groups.filter(group => state.phase === 'initial_groups' ? group.division === 'INITIAL' : state.phase === 'ab_groups' ? ['A', 'B'].includes(group.division) : false);
}

function Card({ title, action, children }) {
  return <section className="sd-card sd-panel ch-card"><div className="ch-card-head"><h2 className="sd-panel-title">{title}</h2>{action}</div>{children}</section>;
}

function Field({ label, children }) {
  return <label className="ch-field"><span>{label}</span>{children}</label>;
}

function NumberInput({ value, disabled, onChange }) {
  return <input className="sd-input" type="number" min="1" max="32" value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))} />;
}

function GroupCard({ group, standings, t }) {
  return <Card title={group.name}><div className="ch-table-wrap"><table className="sd-table"><thead><tr><th>#</th><th>{t.team}</th><th>{t.played}</th><th>{t.wins}</th><th>{t.losses}</th><th>{t.points}</th></tr></thead><tbody>{standings.map(entry => <tr key={entry.teamId} className={entry.unresolvedTie ? 'is-tied' : ''}><td><span className="sd-seed">{entry.rank}</span></td><td>{entry.name}</td><td>{entry.played}</td><td>{entry.wins}</td><td>{entry.losses}</td><td><strong>{entry.points}</strong>{entry.adjustment ? <small> ({entry.adjustment > 0 ? '+' : ''}{entry.adjustment})</small> : null}</td></tr>)}</tbody></table></div></Card>;
}

function ChampionshipMatch({ match, state, teamsById, t, onWinner, onLane, onMove }) {
  const status = getChampionshipMatchStatus(state, match.id);
  const label = status === 'current' ? t.playing : status === 'queued' ? t.queued : status === 'completed' ? t.completed : t.waitingLane;
  const canScore = state.roundPublished && ['current', 'completed'].includes(status);
  const queue = getCurrentMatches(state).filter(item => item.laneNumber === match.laneNumber);
  const index = queue.findIndex(item => item.id === match.id);
  return <article className={`ch-match is-${status}`}><div className="ch-match-head"><strong>{label}</strong><span>Bane {match.laneNumber || '-'} · #{match.lanePosition || '-'}</span></div><div className="ch-versus"><button type="button" disabled={!canScore} className={match.winnerId === match.team1Id ? 'is-winner' : ''} onClick={() => onWinner(match.team1Id)}>{teamsById.get(match.team1Id)?.name || '-'}</button><b>VS</b><button type="button" disabled={!canScore} className={match.winnerId === match.team2Id ? 'is-winner' : ''} onClick={() => onWinner(match.team2Id)}>{teamsById.get(match.team2Id)?.name || '-'}</button></div><div className="ch-match-controls"><select className="sd-select" value={match.laneNumber || ''} disabled={!!match.winnerId} onChange={event => onLane(Number(event.target.value))}>{state.activeLanes.map(lane => <option key={lane} value={lane}>Bane {lane}</option>)}</select><button className="sd-button" disabled={index <= 0 || !!match.winnerId} onClick={() => onMove(-1)}><ArrowUp size={14} /></button><button className="sd-button" disabled={index < 0 || index >= queue.length - 1 || !!match.winnerId} onClick={() => onMove(1)}><ArrowDown size={14} /></button></div></article>;
}

function BracketCard({ bracket, teamsById, title, t }) {
  if (!bracket) return <Card title={title}><p>-</p></Card>;
  return <Card title={title}><div className="ch-bracket-rounds">{bracket.rounds.map(round => <div key={round.number}><h3>{t.round} {round.number}</h3>{round.matches.map(match => <div className={`ch-bracket-match ${match.matchType}`} key={match.id}><span>{teamsById.get(match.team1Id)?.name || 'BYE'}</span><b>{match.matchType === 'third' ? t.third : 'VS'}</b><span>{teamsById.get(match.team2Id)?.name || 'BYE'}</span>{match.winnerId ? <em>✓ {teamsById.get(match.winnerId)?.name}</em> : null}</div>)}</div>)}</div>{bracket.complete ? <div className="ch-podium"><strong>{t.champion}: {teamsById.get(bracket.championId)?.name}</strong><span>{t.third}: {teamsById.get(bracket.thirdId)?.name || '-'}</span></div> : null}</Card>;
}

function Bottom({ label, value }) {
  return <div className="sd-bottom-item"><span>{label}</span><strong>{value}</strong></div>;
}
