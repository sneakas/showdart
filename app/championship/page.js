'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Eye, EyeOff, Gamepad2, History, LayoutGrid, Medal, Monitor, Plus, RotateCcw, Trophy, UsersRound, X } from 'lucide-react';
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
  hasRequiredChampionshipTieBreaks,
  hideChampionshipRound,
  moveChampionshipMatchInQueue,
  normalizeChampionshipState,
  publishChampionshipRound,
  replacePlayoffTeam,
  setChampionshipActiveLane,
  setChampionshipTieBreakQualifiers,
  setChampionshipWinner,
  setPlayoffSeedOrder,
  swapTeamsBetweenGroups,
  updateChampionshipQualificationSettings,
  updateChampionshipPublicScreen,
  withdrawChampionshipTeam
} from '../../lib/championship/engine';
import '../dashboard.css';
import './championship.css';

const TOURNAMENT_ID = 'showdart-championship';
const LANGUAGE_STORAGE_KEY = 'showdart-language';
const DEFAULT_WORKSPACE_PREFERENCES = {
  hero: true,
  spectator: true,
  publicScreens: true,
  setup: true,
  teams: true,
  swap: true,
  lanes: true,
  standings: true,
  currentRound: true,
  stageActions: true,
  brackets: true,
  corrections: true,
  bottomBar: true
};

const texts = {
  da: {
    loading: 'Indlæser mesterskab...', login: 'Log ind på forsiden for at fortsætte', championship: 'Mesterskab', tournament: 'Turnering', game: 'Spil', admin: 'Admin', logout: 'Log ud',
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
    aBracket: 'A-slutspil', bBracket: 'B-slutspil', champion: 'Mester', third: '3. plads', replace: 'Erstat hold', noMatches: 'Ingen aktuelle kampe', qualifyingPlaces: 'kvalifikationspladser', selectQualifiers: 'Vælg de hold, der går videre',
    confirm: 'Bekræft handling', publishConfirm: 'Offentliggør kampe og baner på publikumsskærmen?', completeConfirm: 'Afslut spillerunden og gå videre?', reset: 'Nulstil mesterskab', resetConfirm: 'Nulstil hele mesterskabet og slet alle hold og resultater?', workspace: 'Arbejdsområde', showAll: 'Vis alle', recommended: 'Anbefalet layout', tournamentBanner: 'Turneringsbanner', spectatorControls: 'Publikumsskærm', teamSwap: 'Holdbytning', bottomBar: 'Statuslinje', publicScreenControl: 'Styring af publikumsskærme', screenOne: 'Skærm 1', screenTwo: 'Skærm 2', displayMode: 'Visning', modeAuto: 'Automatisk', modeRegistration: 'Registrering', modeMatches: 'Aktuelle kampe', modeInitial: 'Første gruppestilling', modeAStandings: 'A-grupper', modeBStandings: 'B-grupper', modeABracket: 'A-slutspil', modeBBracket: 'B-slutspil', modeBrackets: 'Begge slutspil', modePodium: 'Podier', modeAnnouncement: 'Kun besked', rowsPerPage: 'Rækker pr. side', matchesPerPage: 'Kampe pr. side', groupsPerPage: 'Grupper pr. side', rotationSeconds: 'Skift sek.', resumeAuto: 'Genoptag automatisk', announcementPlaceholder: 'Skriv besked til publikum...', publishMessage: 'Vis besked', clearMessage: 'Skjul besked', hideTopBar: 'Skjul topbjælke', hideBanner: 'Skjul banner', hideConnection: 'Skjul forbindelsesstatus', hidePageIndicator: 'Skjul sidetal', hideLaneInfo: 'Skjul baneinfo', hideFooter: 'Skjul statuslinje', laneFilter: 'Banefilter', allLanes: 'Alle baner'
  },
  en: {
    loading: 'Loading championship...', login: 'Log in on the front page to continue', championship: 'Championship', tournament: 'Tournament', game: 'Game', admin: 'Admin', logout: 'Logout',
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
    aBracket: 'A playoffs', bBracket: 'B playoffs', champion: 'Champion', third: '3rd place', replace: 'Replace team', noMatches: 'No current matches', qualifyingPlaces: 'qualification places', selectQualifiers: 'Select the teams that advance',
    confirm: 'Confirm action', publishConfirm: 'Publish matches and lanes to spectator screens?', completeConfirm: 'Complete this round and continue?', reset: 'Reset championship', resetConfirm: 'Reset the championship and delete all teams and results?', workspace: 'Workspace', showAll: 'Show all', recommended: 'Recommended layout', tournamentBanner: 'Tournament banner', spectatorControls: 'Spectator controls', teamSwap: 'Team swapping', bottomBar: 'Status bar', publicScreenControl: 'Public screen controls', screenOne: 'Screen 1', screenTwo: 'Screen 2', displayMode: 'Display', modeAuto: 'Automatic', modeRegistration: 'Registration', modeMatches: 'Current matches', modeInitial: 'Initial standings', modeAStandings: 'A groups', modeBStandings: 'B groups', modeABracket: 'A playoffs', modeBBracket: 'B playoffs', modeBrackets: 'Both playoffs', modePodium: 'Podiums', modeAnnouncement: 'Announcement only', rowsPerPage: 'Rows per page', matchesPerPage: 'Matches per page', groupsPerPage: 'Groups per page', rotationSeconds: 'Rotate sec.', resumeAuto: 'Resume automatic', announcementPlaceholder: 'Write a message for spectators...', publishMessage: 'Show message', clearMessage: 'Hide message', hideTopBar: 'Hide top bar', hideBanner: 'Hide banner', hideConnection: 'Hide connection status', hidePageIndicator: 'Hide page counter', hideLaneInfo: 'Hide lane details', hideFooter: 'Hide status bar', laneFilter: 'Lane filter', allLanes: 'All lanes'
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
  const [announcementDrafts, setAnnouncementDrafts] = useState({ screen1: '', screen2: '' });
  const [showWorkspaceControls, setShowWorkspaceControls] = useState(false);
  const [workspacePreferences, setWorkspacePreferences] = useState(DEFAULT_WORKSPACE_PREFERENCES);
  const [workspacePreferencesReady, setWorkspacePreferencesReady] = useState(false);
  const channelRef = useRef(null);
  const t = texts[lang] || texts.da;

  const teamsById = useMemo(() => new Map(state.teams.map(team => [team.id, team])), [state.teams]);
  const currentMatches = useMemo(() => getCurrentMatches(state), [state]);
  const requiresTieBreak = useMemo(() => hasRequiredChampionshipTieBreaks(state), [state]);
  const currentGroups = useMemo(() => state.groups.filter(group => state.phase === 'initial_groups' ? group.division === 'INITIAL' : state.phase === 'ab_groups' ? ['A', 'B'].includes(group.division) : ['A', 'B'].includes(group.division)), [state.groups, state.phase]);

  useEffect(() => {
    const initial = getInitialLanguage();
    setLang(initial);
    document.documentElement.lang = initial;
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`showdart-championship-workspace-${userId}`) || '{}');
      setWorkspacePreferences({ ...DEFAULT_WORKSPACE_PREFERENCES, ...(saved && typeof saved === 'object' ? saved : {}) });
    } catch {
      setWorkspacePreferences(DEFAULT_WORKSPACE_PREFERENCES);
    }
    setWorkspacePreferencesReady(true);
  }, [session?.user?.id]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !workspacePreferencesReady) return;
    localStorage.setItem(`showdart-championship-workspace-${userId}`, JSON.stringify(workspacePreferences));
  }, [session?.user?.id, workspacePreferences, workspacePreferencesReady]);

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

  useEffect(() => {
    setAnnouncementDrafts(previous => ({
      screen1: previous.screen1 || state.publicScreens?.screen1?.announcement || '',
      screen2: previous.screen2 || state.publicScreens?.screen2?.announcement || ''
    }));
  }, [state.publicScreens?.screen1?.announcement, state.publicScreens?.screen2?.announcement]);

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

  function getPublicScreenUrl(screenKey) {
    if (!screenInfo?.screenUrl) return '';
    return `${screenInfo.screenUrl}${screenInfo.screenUrl.includes('?') ? '&' : '?'}view=${encodeURIComponent(screenKey)}`;
  }

  function updatePublicScreen(screenKey, patch) {
    commit(previous => updateChampionshipPublicScreen(previous, screenKey, patch));
  }

  function publishAnnouncement(screenKey) {
    const announcement = String(announcementDrafts[screenKey] || '').trim();
    updatePublicScreen(screenKey, { announcement });
  }

  function clearAnnouncement(screenKey) {
    setAnnouncementDrafts(previous => ({ ...previous, [screenKey]: '' }));
    updatePublicScreen(screenKey, { announcement: '' });
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

  function toggleWorkspacePanel(key) {
    setWorkspacePreferences(previous => ({ ...previous, [key]: !previous[key] }));
  }

  function showAllWorkspacePanels() {
    setWorkspacePreferences({ ...DEFAULT_WORKSPACE_PREFERENCES });
  }

  function applyRecommendedWorkspace() {
    setWorkspacePreferences(getRecommendedWorkspacePreferences(state.phase));
  }

  if (loading) return <main className="sd-page ch-center">{t.loading}</main>;
  if (!session) return <main className="sd-page ch-center"><a className="sd-button gold" href="/">{t.login}</a></main>;

  const phaseLabel = state.phase === 'registration' ? t.registration : state.phase === 'initial_groups' ? t.initialStage : state.phase === 'ab_groups' ? t.abStage : state.phase === 'playoffs' ? t.playoffs : t.finished;
  const workspaceOptions = [
    ['hero', t.tournamentBanner],
    ['spectator', t.spectatorControls],
    ['publicScreens', t.publicScreenControl],
    ['setup', t.setup],
    ['teams', t.teams],
    ['swap', t.teamSwap],
    ['lanes', t.activeLanes],
    ['standings', t.standings],
    ['currentRound', t.currentRound],
    ['stageActions', t.stageActions],
    ['brackets', t.playoffs],
    ['corrections', t.corrections],
    ['bottomBar', t.bottomBar]
  ];
  const sidebarVisible = workspacePreferences.setup || workspacePreferences.teams || workspacePreferences.swap || workspacePreferences.lanes;

  return (
    <main className={`sd-page ch-page ${!workspacePreferences.bottomBar ? 'without-bottom-bar' : ''}`}>
      <header className="sd-topbar">
        <div className="sd-brand"><div className="sd-logo-mark" /><div><div className="sd-brand-title">Showdart</div><div className="sd-brand-subtitle">Turnering</div></div></div>
        <nav className="sd-nav">
          <button type="button" onClick={() => { window.location.href = '/'; }}><Trophy size={20} />{t.tournament}</button>
          <button type="button" className="is-active"><Medal size={20} />{t.championship}</button>
          <button type="button" onClick={() => { window.location.href = '/spil'; }}><Gamepad2 size={20} />{t.game}</button>
          {role === 'admin' ? <button type="button" onClick={() => { window.location.href = '/admin'; }}><UsersRound size={20} />{t.admin}</button> : null}
        </nav>
        <div className="sd-userbar">
          <span>{email} ({role})</span>
          <button type="button" aria-label="Dansk" className={`sd-flag ${lang === 'da' ? 'is-active' : ''}`} style={{ backgroundImage: "url('https://flagcdn.com/w40/dk.png')" }} onClick={() => changeLanguage('da')} />
          <button type="button" aria-label="English" className={`sd-flag ${lang === 'en' ? 'is-active' : ''}`} style={{ backgroundImage: "url('https://flagcdn.com/w40/gb.png')" }} onClick={() => changeLanguage('en')} />
          <button type="button" className="sd-logout" onClick={logout}>{t.logout}</button>
        </div>
      </header>

      <section className="ch-viewbar">
        <button type="button" className={`sd-button ${showWorkspaceControls ? 'gold' : ''}`} onClick={() => setShowWorkspaceControls(value => !value)}><LayoutGrid size={16} /> {t.workspace}</button>
        <span>{phaseLabel}</span>
        <button type="button" className="sd-button danger" onClick={() => confirm(t.resetConfirm, () => commit(createDefaultChampionshipState()))}><RotateCcw size={16} /> {t.reset}</button>
        {showWorkspaceControls ? <div className="ch-workspace-controls">
          <div className="ch-workspace-control-actions"><button type="button" className="sd-button gold" onClick={applyRecommendedWorkspace}>{t.recommended}</button><button type="button" className="sd-button" onClick={showAllWorkspacePanels}>{t.showAll}</button></div>
          <div className="ch-workspace-options">{workspaceOptions.map(([key, label]) => <label key={key} className={workspacePreferences[key] ? 'is-visible' : ''}><input type="checkbox" checked={workspacePreferences[key]} onChange={() => toggleWorkspacePanel(key)} /><span>{label}</span></label>)}</div>
        </div> : null}
      </section>

      {workspacePreferences.hero || workspacePreferences.spectator ? <section className={`ch-hero ${!workspacePreferences.hero ? 'is-actions-only' : ''}`}>
        {workspacePreferences.hero ? <div><span>{phaseLabel}</span><h1>{state.tournamentName || t.championship}</h1><p>{state.teams.filter(team => !team.withdrawn).length} {t.teams} · {state.activeLanes.length} {t.lanes}</p></div> : null}
        {workspacePreferences.spectator ? <div className="ch-hero-actions">
          <button type="button" className="sd-button gold" disabled={!screenInfo?.screenUrl} onClick={() => window.open(screenInfo.screenUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /> {t.openScreen}</button>
          <button type="button" className="sd-button" disabled={!screenInfo?.screenUrl} onClick={async () => { await navigator.clipboard.writeText(screenInfo.screenUrl); setMessage(t.copied); }}>{t.copyLink}</button>
        </div> : null}
      </section> : null}

      {message ? <div className="ch-toast">{message}</div> : null}

      {workspacePreferences.publicScreens ? <section className="ch-public-screen-control"><Card title={t.publicScreenControl} action={<Monitor size={18} />}><div className="ch-public-screen-grid">{['screen1', 'screen2'].map(screenKey => <PublicScreenCard key={screenKey} screenKey={screenKey} config={state.publicScreens?.[screenKey] || {}} laneCount={state.config.laneCount} draft={announcementDrafts[screenKey] || ''} t={t} url={getPublicScreenUrl(screenKey)} onChange={patch => updatePublicScreen(screenKey, patch)} onDraftChange={value => setAnnouncementDrafts(previous => ({ ...previous, [screenKey]: value }))} onPublish={() => publishAnnouncement(screenKey)} onClear={() => clearAnnouncement(screenKey)} onCopied={() => setMessage(t.copied)} />)}</div></Card></section> : null}

      <section className={`ch-workspace ${!sidebarVisible ? 'without-sidebar' : ''}`}>
        {sidebarVisible ? <aside className="ch-column">
          {workspacePreferences.setup ? <Card title={t.setup}>
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
          </Card> : null}

          {workspacePreferences.teams ? <Card title={`${t.teams} (${state.teams.length})`}>
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
          </Card> : null}

          {workspacePreferences.swap && state.started && GROUP_PHASE_OPTIONS(state).length ? <Card title={t.swapTeams}>
            <div className="ch-form"><select className="sd-select" value={swapForm.first} onChange={event => setSwapForm(previous => ({ ...previous, first: event.target.value }))}><option value="">{t.firstTeam}</option>{GROUP_PHASE_OPTIONS(state).flatMap(group => group.teamIds.map(id => <option key={`${group.id}-${id}`} value={id}>{group.name}: {teamsById.get(id)?.name}</option>))}</select><select className="sd-select" value={swapForm.second} onChange={event => setSwapForm(previous => ({ ...previous, second: event.target.value }))}><option value="">{t.secondTeam}</option>{GROUP_PHASE_OPTIONS(state).flatMap(group => group.teamIds.map(id => <option key={`${group.id}-${id}`} value={id}>{group.name}: {teamsById.get(id)?.name}</option>))}</select><button type="button" className="sd-button" onClick={() => commit(previous => swapTeamsBetweenGroups(previous, Number(swapForm.first), Number(swapForm.second)))}>{t.swap}</button></div>
          </Card> : null}

          {workspacePreferences.lanes ? <Card title={t.activeLanes}><div className="ch-lanes">{Array.from({ length: state.config.laneCount }, (_, index) => index + 1).map(lane => <button type="button" key={lane} className={`sd-lane-toggle ${state.activeLanes.includes(lane) ? 'is-active' : 'is-inactive'}`} onClick={() => commit(previous => setChampionshipActiveLane(previous, lane, !previous.activeLanes.includes(lane)))}><span className="sd-mini-board" /><span><strong>Bane {lane}</strong><small>{state.activeLanes.includes(lane) ? 'Aktiv' : 'Inaktiv'}</small></span></button>)}</div></Card> : null}
        </aside> : null}

        <div className="ch-main">
          {workspacePreferences.standings && currentGroups.length ? <section className="ch-group-grid">{currentGroups.map(group => <GroupCard key={group.id} group={group} standings={getGroupStandings(state, group.id)} t={t} />)}</section> : null}

          {workspacePreferences.currentRound && state.started && !['finished'].includes(state.phase) ? <Card title={`${t.currentRound} ${state.stageRound || ''}`} action={<span className={`ch-status ${state.roundPublished ? 'is-live' : ''}`}>{state.roundPublished ? t.live : t.draft}</span>}>
            <div className="ch-round-actions">
              {!state.roundPublished && currentMatches.length ? <button type="button" className="sd-button gold" onClick={() => confirm(t.publishConfirm, () => commit(publishChampionshipRound))}><Eye size={16} /> {t.publish}</button> : null}
              {state.roundPublished && !currentMatches.some(match => match.winnerId) ? <button type="button" className="sd-button" onClick={() => commit(hideChampionshipRound)}><EyeOff size={16} /> {t.hide}</button> : null}
              {currentMatches.length ? <button type="button" className="sd-button gold" disabled={!state.roundPublished} onClick={() => confirm(t.completeConfirm, () => commit(completeChampionshipRound))}><Check size={16} /> {t.completeRound}</button> : <span className="sd-small-label">{t.noMatches}</span>}
            </div>
            <div className="ch-match-grid">{currentMatches.map(match => <ChampionshipMatch key={match.id} match={match} state={state} teamsById={teamsById} t={t} onWinner={winnerId => commit(previous => setChampionshipWinner(previous, match.id, winnerId))} onTieQualifiers={qualifierIds => commit(previous => setChampionshipTieBreakQualifiers(previous, match.id, qualifierIds))} onLane={lane => commit(previous => assignChampionshipMatchLane(previous, match.id, lane))} onMove={direction => commit(previous => moveChampionshipMatchInQueue(previous, match.id, direction))} />)}</div>
          </Card> : null}

          {workspacePreferences.stageActions && state.stageComplete && state.phase !== 'finished' ? <Card title={t.stageActions}>
            <div className="ch-action-row">
              {requiresTieBreak ? <button type="button" className="sd-button" onClick={() => commit(generateRequiredTieBreaks)}>{t.tieBreak}</button> : null}
              {state.phase === 'initial_groups' ? <button type="button" className="sd-button gold" onClick={() => commit(advanceToABGroups)}>{t.createAB}</button> : null}
              {state.phase === 'ab_groups' ? <button type="button" className="sd-button gold" onClick={handleGeneratePlayoffs}>{t.createPlayoffs}</button> : null}
            </div>
            {state.phase === 'ab_groups' ? <div className="ch-qualification">
              {['A', 'B'].map(division => <div key={division}><h3>{division}-{t.qualification}</h3><Field label={t.drawMode}><select className="sd-select" value={division === 'A' ? state.config.aPlayoffDrawMode : state.config.bPlayoffDrawMode} onChange={event => commit(previous => updateChampionshipQualificationSettings(previous, division === 'A' ? { aPlayoffDrawMode: event.target.value } : { bPlayoffDrawMode: event.target.value }))}><option value="seeded">{t.seeded}</option><option value="random">{t.random}</option><option value="manual">{t.manual}</option></select></Field>{(division === 'A' ? state.config.aPlayoffDrawMode : state.config.bPlayoffDrawMode) === 'manual' ? <div className="ch-seeds">{manualSeeds[division].map((id, index) => <div key={id}><span>{index + 1}. {teamsById.get(id)?.name}</span><button className="sd-button" disabled={!index} onClick={() => moveSeed(division, index, -1)}><ArrowUp size={13} /></button><button className="sd-button" disabled={index === manualSeeds[division].length - 1} onClick={() => moveSeed(division, index, 1)}><ArrowDown size={13} /></button></div>)}</div> : null}</div>)}
            </div> : null}
          </Card> : null}

          {workspacePreferences.brackets && ['playoffs', 'finished'].includes(state.phase) ? <section className="ch-brackets"><BracketCard bracket={getDivisionBracket(state, 'A')} teamsById={teamsById} title={t.aBracket} t={t} /><BracketCard bracket={getDivisionBracket(state, 'B')} teamsById={teamsById} title={t.bBracket} t={t} /></section> : null}

          {workspacePreferences.brackets && state.phase === 'playoffs' ? <Card title={t.replace}>
            <div className="ch-replacement">
              <select className="sd-select" value={replacementForm.division} onChange={event => setReplacementForm(previous => ({ ...previous, division: event.target.value, oldTeamId: '' }))}><option value="A">A</option><option value="B">B</option></select>
              <select className="sd-select" value={replacementForm.oldTeamId} onChange={event => setReplacementForm(previous => ({ ...previous, oldTeamId: event.target.value }))}><option value="">{t.team}</option>{(state.brackets[replacementForm.division]?.seedTeamIds || []).map(id => <option key={id} value={id}>{teamsById.get(id)?.name}</option>)}</select>
              <select className="sd-select" value={replacementForm.newTeamId} onChange={event => setReplacementForm(previous => ({ ...previous, newTeamId: event.target.value }))}><option value="">{t.replace}</option>{state.teams.filter(team => !team.withdrawn && !(state.brackets[replacementForm.division]?.seedTeamIds || []).includes(team.id)).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
              <button type="button" className="sd-button" onClick={() => commit(previous => replacePlayoffTeam(previous, replacementForm.division, Number(replacementForm.oldTeamId), Number(replacementForm.newTeamId)))}>{t.replace}</button>
            </div>
          </Card> : null}

          {workspacePreferences.corrections && state.started ? <Card title={t.corrections} action={<button type="button" className="sd-button" onClick={() => setShowSchedule(value => !value)}><History size={15} /> {showSchedule ? t.hideSchedule : t.showSchedule}</button>}>
            <div className="ch-corrections"><input className="sd-input" placeholder={t.correctionReason} value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} /><div className="ch-adjustment"><select className="sd-select" value={adjustmentForm.groupId} onChange={event => setAdjustmentForm(previous => ({ ...previous, groupId: event.target.value }))}><option value="">{t.group}</option>{state.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><select className="sd-select" value={adjustmentForm.teamId} onChange={event => setAdjustmentForm(previous => ({ ...previous, teamId: event.target.value }))}><option value="">{t.team}</option>{state.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select><input className="sd-input" type="number" value={adjustmentForm.points} onChange={event => setAdjustmentForm(previous => ({ ...previous, points: Number(event.target.value) }))} /><input className="sd-input" placeholder={t.reason} value={adjustmentForm.reason} onChange={event => setAdjustmentForm(previous => ({ ...previous, reason: event.target.value }))} /><button type="button" className="sd-button" onClick={() => commit(previous => addPointsAdjustment(previous, Number(adjustmentForm.teamId), adjustmentForm.groupId, adjustmentForm.points, adjustmentForm.reason))}>{t.addAdjustment}</button></div></div>
            {showSchedule ? <div className="ch-schedule"><table className="sd-table"><thead><tr><th>{t.round}</th><th>{t.group}</th><th>{t.match}</th><th>{t.winner}</th></tr></thead><tbody>{state.matches.filter(match => !match.isBye).map(match => <tr key={match.id}><td>{match.round}</td><td>{match.groupId || match.bracketDivision || '-'}</td><td>{match.isMultiTeamTieBreak ? match.participantIds.map(id => teamsById.get(id)?.name).join(' · ') : `${teamsById.get(match.team1Id)?.name || '-'} VS ${teamsById.get(match.team2Id)?.name || '-'}`}</td><td>{match.isMultiTeamTieBreak ? <select multiple size={Math.min(5, match.participantIds.length)} className="sd-select ch-multi-correction" value={match.qualifierIds.map(String)} disabled={!correctionReason.trim()} onChange={event => commit(previous => setChampionshipTieBreakQualifiers(previous, match.id, [...event.target.selectedOptions].map(option => Number(option.value)), correctionReason))}>{match.participantIds.map(id => <option key={id} value={id}>{teamsById.get(id)?.name}</option>)}</select> : <select className="sd-select" value={match.winnerId || ''} disabled={!correctionReason.trim()} onChange={event => commit(previous => setChampionshipWinner(previous, match.id, Number(event.target.value), correctionReason))}><option value="">-</option>{[match.team1Id, match.team2Id].filter(Boolean).map(id => <option key={id} value={id}>{teamsById.get(id)?.name}</option>)}</select>}</td></tr>)}</tbody></table></div> : null}
            <button type="button" className="sd-button ch-audit-toggle" onClick={() => setShowAudit(value => !value)}>{t.audit} ({state.auditLog.length})</button>
            {showAudit ? <div className="ch-audit-list">{[...state.auditLog].reverse().map(entry => <div key={entry.id}><time>{new Date(entry.createdAt).toLocaleString(lang === 'da' ? 'da-DK' : 'en-GB')}</time><strong>{entry.action}</strong><span>{JSON.stringify(entry.details)}</span></div>)}</div> : null}
          </Card> : null}
        </div>
      </section>

      {workspacePreferences.bottomBar ? <footer className="sd-bottom"><Bottom label={t.championship} value={phaseLabel} /><Bottom label={t.teams} value={state.teams.filter(team => !team.withdrawn).length} /><Bottom label={t.round} value={state.stageRound || 0} /><Bottom label={t.match} value={state.matches.filter(match => match.winnerId && !match.isBye).length} /><Bottom label={t.lanes} value={`${state.activeLanes.length}/${state.config.laneCount}`} /><Bottom label={t.audit} value={state.auditLog.length} /></footer> : null}

      {withdrawTeam ? <div className="sd-dialog-backdrop"><div className="sd-dialog ch-dialog"><div className="sd-dialog-mark">!</div><div><h2 className="sd-dialog-title">{t.withdraw}: {withdrawTeam.name}</h2><p className="sd-dialog-message">{t.withdrawQuestion}</p></div><div className="sd-dialog-actions"><button className="sd-button" onClick={() => setWithdrawTeam(null)}>{t.cancel}</button><button className="sd-button" onClick={() => { commit(previous => withdrawChampionshipTeam(previous, withdrawTeam.id, 'keep')); setWithdrawTeam(null); }}>{t.keepResults}</button><button className="sd-button danger" onClick={() => { commit(previous => withdrawChampionshipTeam(previous, withdrawTeam.id, 'void')); setWithdrawTeam(null); }}>{t.voidResults}</button></div></div></div> : null}
      {dialog ? <div className="sd-dialog-backdrop"><div className="sd-dialog ch-dialog"><div className="sd-dialog-mark">!</div><div><h2 className="sd-dialog-title">{t.confirm}</h2><p className="sd-dialog-message">{dialog.message}</p></div><div className="sd-dialog-actions">{dialog.confirm ? <button className="sd-button" onClick={() => setDialog(null)}>{t.cancel}</button> : null}<button className="sd-button gold" onClick={() => { const action = dialog.confirm; setDialog(null); action?.(); }}>{dialog.confirm ? t.confirm : 'OK'}</button></div></div></div> : null}
    </main>
  );
}

function GROUP_PHASE_OPTIONS(state) {
  return state.groups.filter(group => state.phase === 'initial_groups' ? group.division === 'INITIAL' : state.phase === 'ab_groups' ? ['A', 'B'].includes(group.division) : false);
}

function PublicScreenCard({ screenKey, config, laneCount, draft, t, url, onChange, onDraftChange, onPublish, onClear, onCopied }) {
  const modes = [
    ['auto', t.modeAuto], ['registration', t.modeRegistration], ['matches', t.modeMatches],
    ['initialStandings', t.modeInitial], ['aStandings', t.modeAStandings], ['bStandings', t.modeBStandings],
    ['aBracket', t.modeABracket], ['bBracket', t.modeBBracket], ['brackets', t.modeBrackets],
    ['podium', t.modePodium], ['announcement', t.modeAnnouncement]
  ];
  const checkboxes = [
    ['hideHeader', t.hideTopBar], ['hideHero', t.hideBanner], ['hideConnection', t.hideConnection],
    ['hidePageIndicator', t.hidePageIndicator], ['hideLaneInfo', t.hideLaneInfo], ['hideFooter', t.hideFooter]
  ];
  const lanes = Array.isArray(config.lanes) ? config.lanes : [];
  const liveAnnouncement = config.announcement || '';
  return <article className="ch-public-screen-card">
    <div className="ch-public-screen-head"><strong>{screenKey === 'screen1' ? t.screenOne : t.screenTwo}</strong><span className={config.mode === 'auto' ? 'is-auto' : 'is-manual'}>{config.mode === 'auto' ? t.modeAuto : modes.find(([value]) => value === config.mode)?.[1]}</span></div>
    <div className="ch-public-screen-fields">
      <Field label={t.displayMode}><select className="sd-select" value={config.mode || 'auto'} onChange={event => onChange({ mode: event.target.value })}>{modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label={t.rowsPerPage}><input className="sd-input" type="number" min="4" max="24" value={config.rowsPerPage || 12} onChange={event => onChange({ rowsPerPage: Number(event.target.value) })} /></Field>
      <Field label={t.matchesPerPage}><input className="sd-input" type="number" min="1" max="24" value={config.matchesPerPage || 8} onChange={event => onChange({ matchesPerPage: Number(event.target.value) })} /></Field>
      <Field label={t.groupsPerPage}><input className="sd-input" type="number" min="1" max="6" value={config.groupsPerPage || 2} onChange={event => onChange({ groupsPerPage: Number(event.target.value) })} /></Field>
      <Field label={t.rotationSeconds}><input className="sd-input" type="number" min="5" max="120" value={config.rotationSeconds || 10} onChange={event => onChange({ rotationSeconds: Number(event.target.value) })} /></Field>
    </div>
    <div className="ch-public-screen-checks">{checkboxes.map(([key, label]) => <label key={key}><input type="checkbox" checked={!!config[key]} onChange={event => onChange({ [key]: event.target.checked })} />{label}</label>)}</div>
    <div className="ch-public-screen-lanes"><span>{t.laneFilter}: {lanes.length ? '' : t.allLanes}</span><div>{Array.from({ length: laneCount }, (_, index) => index + 1).map(lane => <button type="button" key={lane} className={lanes.includes(lane) ? 'is-selected' : ''} onClick={() => onChange({ lanes: lanes.includes(lane) ? lanes.filter(value => value !== lane) : [...lanes, lane] })}>Bane {lane}</button>)}</div></div>
    <div className="ch-public-screen-message"><input className="sd-input" maxLength="240" value={draft} placeholder={t.announcementPlaceholder} onChange={event => onDraftChange(event.target.value)} /><button type="button" className="sd-button gold" disabled={!draft.trim() || draft.trim() === liveAnnouncement} onClick={onPublish}>{t.publishMessage}</button><button type="button" className="sd-button" disabled={!liveAnnouncement && !draft} onClick={onClear}>{t.clearMessage}</button></div>
    <div className="ch-public-screen-actions"><button type="button" className="sd-button gold" disabled={config.mode === 'auto'} onClick={() => onChange({ mode: 'auto' })}>{t.resumeAuto}</button><button type="button" className="sd-button" disabled={!url} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}><ExternalLink size={14} /> {t.openScreen}</button><button type="button" className="sd-button" disabled={!url} onClick={async () => { await navigator.clipboard.writeText(url); onCopied(); }}><Copy size={14} /> {t.copyLink}</button></div>
  </article>;
}

function Card({ title, action, children }) {
  const [collapsed, setCollapsed] = useState(false);
  return <section className={`sd-card sd-panel ch-card ${collapsed ? 'is-collapsed' : ''}`}><div className="ch-card-head"><h2 className="sd-panel-title">{title}</h2><div className="ch-card-actions">{action}<button type="button" className="ch-collapse-button" aria-label={`${collapsed ? 'Vis' : 'Skjul'} ${title}`} onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}</button></div></div>{collapsed ? null : children}</section>;
}

function getRecommendedWorkspacePreferences(phase) {
  const base = Object.fromEntries(Object.keys(DEFAULT_WORKSPACE_PREFERENCES).map(key => [key, false]));
  if (phase === 'registration') return { ...base, hero: true, spectator: true, publicScreens: true, setup: true, teams: true, lanes: true, bottomBar: true };
  if (['initial_groups', 'ab_groups'].includes(phase)) return { ...base, hero: true, spectator: true, publicScreens: true, lanes: true, standings: true, currentRound: true, stageActions: true, bottomBar: true };
  if (phase === 'playoffs') return { ...base, hero: true, spectator: true, publicScreens: true, lanes: true, currentRound: true, stageActions: true, brackets: true, bottomBar: true };
  return { ...base, hero: true, spectator: true, publicScreens: true, brackets: true, corrections: true, bottomBar: true };
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

function ChampionshipMatch({ match, state, teamsById, t, onWinner, onTieQualifiers, onLane, onMove }) {
  const status = getChampionshipMatchStatus(state, match.id);
  const label = status === 'current' ? t.playing : status === 'queued' ? t.queued : status === 'completed' ? t.completed : t.waitingLane;
  const canScore = state.roundPublished && ['current', 'completed'].includes(status);
  const queue = getCurrentMatches(state).filter(item => item.laneNumber === match.laneNumber);
  const index = queue.findIndex(item => item.id === match.id);
  const resolved = match.isMultiTeamTieBreak ? match.qualifierIds.length === match.qualifierCount : !!match.winnerId;
  const toggleQualifier = teamId => {
    const selected = match.qualifierIds || [];
    onTieQualifiers(selected.includes(teamId) ? selected.filter(id => id !== teamId) : [...selected, teamId]);
  };
  return <article className={`ch-match is-${status} ${match.isMultiTeamTieBreak ? 'is-multi-tiebreak' : ''}`}><div className="ch-match-head"><strong>{match.isMultiTeamTieBreak ? 'TIE-BREAK' : label}</strong><span>Bane {match.laneNumber || '-'} · #{match.lanePosition || '-'}</span></div>{match.isMultiTeamTieBreak ? <div className="ch-tiebreak"><p>{t.selectQualifiers}: <strong>{match.qualifierIds.length}/{match.qualifierCount}</strong> {t.qualifyingPlaces}</p><div>{match.participantIds.map(teamId => <button type="button" key={teamId} disabled={!canScore} className={match.qualifierIds.includes(teamId) ? 'is-winner' : ''} onClick={() => toggleQualifier(teamId)}><span>{match.qualifierIds.includes(teamId) ? '✓' : ''}</span>{teamsById.get(teamId)?.name || '-'}</button>)}</div></div> : <div className="ch-versus"><button type="button" disabled={!canScore} className={match.winnerId === match.team1Id ? 'is-winner' : ''} onClick={() => onWinner(match.team1Id)}>{teamsById.get(match.team1Id)?.name || '-'}</button><b>VS</b><button type="button" disabled={!canScore} className={match.winnerId === match.team2Id ? 'is-winner' : ''} onClick={() => onWinner(match.team2Id)}>{teamsById.get(match.team2Id)?.name || '-'}</button></div>}<div className="ch-match-controls"><select className="sd-select" value={match.laneNumber || ''} disabled={resolved} onChange={event => onLane(Number(event.target.value))}>{state.activeLanes.map(lane => <option key={lane} value={lane}>Bane {lane}</option>)}</select><button className="sd-button" disabled={index <= 0 || resolved} onClick={() => onMove(-1)}><ArrowUp size={14} /></button><button className="sd-button" disabled={index < 0 || index >= queue.length - 1 || resolved} onClick={() => onMove(1)}><ArrowDown size={14} /></button></div></article>;
}

function BracketCard({ bracket, teamsById, title, t }) {
  if (!bracket) return <Card title={title}><p>-</p></Card>;
  return <Card title={title}><div className="ch-bracket-rounds">{bracket.rounds.map(round => <div key={round.number}><h3>{t.round} {round.number}</h3>{round.matches.map(match => <div className={`ch-bracket-match ${match.matchType}`} key={match.id}><span>{teamsById.get(match.team1Id)?.name || 'BYE'}</span><b>{match.matchType === 'third' ? t.third : 'VS'}</b><span>{teamsById.get(match.team2Id)?.name || 'BYE'}</span>{match.winnerId ? <em>✓ {teamsById.get(match.winnerId)?.name}</em> : null}</div>)}</div>)}</div>{bracket.complete ? <div className="ch-podium"><strong>{t.champion}: {teamsById.get(bracket.championId)?.name}</strong><span>{t.third}: {teamsById.get(bracket.thirdId)?.name || '-'}</span></div> : null}</Card>;
}

function Bottom({ label, value }) {
  return <div className="sd-bottom-item"><span>{label}</span><strong>{value}</strong></div>;
}
