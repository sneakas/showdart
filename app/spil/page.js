'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, ClipboardList, Gamepad2, MapPin, RefreshCw, RotateCcw, Send, Settings, Trophy, Undo2, UsersRound, X } from 'lucide-react';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';
import {
  MICKEY_RULES,
  MICKEY_TARGETS,
  buildMickeyTournamentResult,
  createMickeyState,
  getMickeyMpr,
  getMickeyTargetLabel,
  isMickeyPlayerFinished,
  markMickeyTarget,
  normalizeMickeyState,
  runMickeyAiTurn,
  startMickeyGame,
  undoMickeyVisit
} from '../../lib/mickey/engine';
import '../dashboard.css';
import './spil.css';

const LANGUAGE_STORAGE_KEY = 'showdart-language';
const STORAGE_PREFIX = 'showdart-mickey-state';
const LANE_STORAGE_PREFIX = 'showdart-tablet-lane';
const LINKED_MATCH_STORAGE_PREFIX = 'showdart-linked-match';

const texts = {
  da: {
    loading: 'Indlæser spil...',
    login: 'Log ind på forsiden for at fortsætte',
    tournament: 'Turnering',
    championship: 'Mesterskab',
    game: 'Spil',
    admin: 'Admin',
    rules: 'Regler',
    logout: 'Log ud',
    brandSub: 'Turnering',
    app: 'App',
    setup: 'Setup',
    closeApp: 'Luk app',
    title: 'Mickey scoring app',
    subtitle: 'Cricket Close-Out med Any Double, Any Triple og bull.',
    playerOne: 'Spiller 1',
    playerTwo: 'Spiller 2',
    opponent: 'Modstander',
    twoPlayers: '2 spillere',
    ai: 'Spil mod AI',
    aiStrength: 'AI styrke',
    aiHelp: 'Marks i gennemsnit pr. AI-tur.',
    start: 'Start Mickey',
    restart: 'Start forfra',
    undo: 'Fortryd',
    aiTurn: 'AI tur',
    resultReady: 'Resultat klar',
    resultWaiting: 'Resultat sendes senere',
    resultHint: 'Denne payload kan senere sendes direkte til turneringskampen.',
    winner: 'Vinder',
    closed: 'Lukkede',
    marks: 'Marks',
    darts: 'Pile',
    visits: 'Visits',
    mpr: 'MPR',
    integration: 'Turneringsintegration',
    integrationBody: 'Vælg tablettens bane. Den aktuelle kamp hentes automatisk, og vinderen sendes tilbage til turneringen.',
    noResult: 'Spil færdigt først for at se resultat-payload.',
    ruleTitle: 'Mickey regler',
    setupTitle: 'Spilopsætning',
    boardTitle: 'Mickey tavle',
    activeGame: 'Aktivt spil',
    finished: 'Færdig',
    notStarted: 'Ikke startet',
    humanMode: 'Manuel markering for begge spillere.',
    aiMode: 'Du markerer Spiller 1. AI markerer sig selv med AI tur-knappen.',
    sendLater: 'Klar til senere turneringskobling',
    openTournament: 'Til turnering',
    openChampionship: 'Til mesterskab',
    laneSetup: 'Tablet-bane', chooseLane: 'Vælg bane…', lane: 'Bane',
    refreshing: 'Opdaterer...', refresh: 'Opdater kamp', noCompetition: 'Ingen aktiv turnering eller mesterskab blev fundet.',
    roundNotPublished: 'Runden er ikke offentliggjort endnu.', waitingForMatch: 'Der er ingen kamp klar på denne bane endnu.', inactiveLane: 'Denne bane er ikke aktiv i turneringen.',
    matchReady: 'Kamp klar', startMatch: 'Start kamp', continueMatch: 'Fortsæt kamp', whoStarts: 'Hvem starter?', whoStartsHint: 'Tryk på spilleren eller holdet, der kaster først.',
    starts: 'Starter', linkedMatch: 'Forbundet kamp', resultSending: 'Sender resultat...', resultSent: 'Resultatet er sendt og kampforløbet er opdateret.', resultFailed: 'Resultatet kunne ikke sendes.',
    retry: 'Prøv igen', manualGame: 'Frit spil', manualGameHint: 'Brug kun frit spil, når kampen ikke kommer fra en turnering.',
    confirmResult: 'Godkend resultat', confirmResultHint: 'Kontrollér vinderen, før resultatet sendes til turneringen.', approveClose: 'Godkend og luk app',
    cancel: 'Annuller', undoLastEntry: 'Fortryd sidste indtastning', awaitingApproval: 'Venter på spillernes godkendelse'
  },
  en: {
    loading: 'Loading game...',
    login: 'Log in on the front page to continue',
    tournament: 'Tournament',
    championship: 'Championship',
    game: 'Game',
    admin: 'Admin',
    rules: 'Rules',
    logout: 'Logout',
    brandSub: 'Tournament',
    app: 'App',
    setup: 'Setup',
    closeApp: 'Close app',
    title: 'Mickey scoring app',
    subtitle: 'Cricket Close-Out with Any Double, Any Triple and bull.',
    playerOne: 'Player 1',
    playerTwo: 'Player 2',
    opponent: 'Opponent',
    twoPlayers: '2 players',
    ai: 'Play AI',
    aiStrength: 'AI strength',
    aiHelp: 'Average marks per AI turn.',
    start: 'Start Mickey',
    restart: 'Restart',
    undo: 'Undo',
    aiTurn: 'AI turn',
    resultReady: 'Result ready',
    resultWaiting: 'Result will be sent later',
    resultHint: 'This payload can later be sent directly to a tournament match.',
    winner: 'Winner',
    closed: 'Closed',
    marks: 'Marks',
    darts: 'Darts',
    visits: 'Visits',
    mpr: 'MPR',
    integration: 'Tournament integration',
    integrationBody: 'Choose the tablet lane. The current match is loaded automatically and the winner is sent back to the competition.',
    noResult: 'Finish the game first to see the result payload.',
    ruleTitle: 'Mickey rules',
    setupTitle: 'Game setup',
    boardTitle: 'Mickey board',
    activeGame: 'Active game',
    finished: 'Finished',
    notStarted: 'Not started',
    humanMode: 'Manual marking for both players.',
    aiMode: 'You mark Player 1. AI marks itself through the AI turn button.',
    sendLater: 'Ready for later tournament link',
    openTournament: 'To tournament',
    openChampionship: 'To championship',
    laneSetup: 'Tablet lane', chooseLane: 'Choose lane…', lane: 'Lane',
    refreshing: 'Refreshing...', refresh: 'Refresh match', noCompetition: 'No active tournament or championship was found.',
    roundNotPublished: 'The round has not been published yet.', waitingForMatch: 'No match is ready on this lane yet.', inactiveLane: 'This lane is not active in the competition.',
    matchReady: 'Match ready', startMatch: 'Start match', continueMatch: 'Continue match', whoStarts: 'Who starts?', whoStartsHint: 'Press the player or team that throws first.',
    starts: 'Starts', linkedMatch: 'Linked match', resultSending: 'Sending result...', resultSent: 'The result was sent and match progress was updated.', resultFailed: 'The result could not be sent.',
    retry: 'Try again', manualGame: 'Free play', manualGameHint: 'Use free play only when the match does not come from a competition.',
    confirmResult: 'Approve result', confirmResultHint: 'Check the winner before the result is sent to the competition.', approveClose: 'Approve and close app',
    cancel: 'Cancel', undoLastEntry: 'Undo last entry', awaitingApproval: 'Waiting for player approval'
  }
};

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'da';
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'en' ? 'en' : 'da';
}

function shouldRequestMickeyFullscreen() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1180px), (pointer: coarse)').matches;
}

function requestMickeyFullscreen() {
  if (typeof document === 'undefined' || !shouldRequestMickeyFullscreen()) return;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const element = document.documentElement;
  const requestFullscreen = element.requestFullscreen || element.webkitRequestFullscreen;
  const result = requestFullscreen?.call(element);
  if (result && typeof result.catch === 'function') result.catch(() => {});
}

function exitMickeyFullscreen() {
  if (typeof document === 'undefined') return;
  const exitFullscreen = document.fullscreenElement
    ? document.exitFullscreen
    : document.webkitFullscreenElement
      ? document.webkitExitFullscreen
      : null;
  const result = exitFullscreen?.call(document);
  if (result && typeof result.catch === 'function') result.catch(() => {});
}

export default function GamePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [lang, setLang] = useState('da');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState('user');
  const [email, setEmail] = useState('');
  const [activePanel, setActivePanel] = useState('setup');
  const [scorerOpen, setScorerOpen] = useState(false);
  const [playerOneName, setPlayerOneName] = useState('Spiller 1');
  const [playerTwoName, setPlayerTwoName] = useState('Spiller 2');
  const [opponentMode, setOpponentMode] = useState('human');
  const [aiAverageMarks, setAiAverageMarks] = useState(3);
  const [state, setState] = useState(() => createMickeyState());
  const [selectedLane, setSelectedLane] = useState(null);
  const [laneData, setLaneData] = useState(null);
  const [laneLoading, setLaneLoading] = useState(false);
  const [laneError, setLaneError] = useState('');
  const [linkedMatch, setLinkedMatch] = useState(null);
  const [startPrompt, setStartPrompt] = useState(null);
  const [submission, setSubmission] = useState({ status: 'idle', message: '' });
  const [resultApprovalOpen, setResultApprovalOpen] = useState(false);
  const [approvalDismissed, setApprovalDismissed] = useState(false);
  const t = texts[lang] || texts.da;

  useEffect(() => {
    const initial = getInitialLanguage();
    setLang(initial);
    document.documentElement.lang = initial;
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
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
    if (!session?.access_token) {
      setRole('user');
      return;
    }
    fetch('/api/profile/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(response => response.ok ? response.json() : null)
      .then(profile => {
        setRole(profile?.role || 'user');
        setEmail(profile?.email || session.user?.email || '');
      })
      .catch(() => setRole('user'));
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id) return;
    try {
      const storedLane = Number(localStorage.getItem(`${LANE_STORAGE_PREFIX}-${session.user.id}`));
      setSelectedLane(Number.isInteger(storedLane) && storedLane > 0 ? storedLane : null);
      const storedLink = JSON.parse(localStorage.getItem(`${LINKED_MATCH_STORAGE_PREFIX}-${session.user.id}`) || 'null');
      setLinkedMatch(storedLink && typeof storedLink === 'object' ? storedLink : null);
      const stored = localStorage.getItem(`${STORAGE_PREFIX}-${session.user.id}`);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      setState(normalizeMickeyState(parsed));
      setOpponentMode(parsed?.opponentMode === 'ai' ? 'ai' : 'human');
      setAiAverageMarks(Number(parsed?.aiAverageMarks) || 3);
      setPlayerOneName(parsed?.players?.[0]?.name || 'Spiller 1');
      setPlayerTwoName(parsed?.players?.[1]?.name === 'AI' ? 'Spiller 2' : parsed?.players?.[1]?.name || 'Spiller 2');
    } catch {
      setState(createMickeyState());
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    localStorage.setItem(`${STORAGE_PREFIX}-${session.user.id}`, JSON.stringify(state));
  }, [session?.user?.id, state]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const laneKey = `${LANE_STORAGE_PREFIX}-${session.user.id}`;
    if (selectedLane) localStorage.setItem(laneKey, String(selectedLane));
    else localStorage.removeItem(laneKey);
  }, [selectedLane, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const linkKey = `${LINKED_MATCH_STORAGE_PREFIX}-${session.user.id}`;
    if (linkedMatch) localStorage.setItem(linkKey, JSON.stringify(linkedMatch));
    else localStorage.removeItem(linkKey);
  }, [linkedMatch, session?.user?.id]);

  const refreshLaneMatch = useCallback(async (laneOverride = selectedLane) => {
    if (!session?.access_token) return;
    setLaneLoading(true);
    setLaneError('');
    try {
      const query = laneOverride ? `?lane=${encodeURIComponent(laneOverride)}` : '';
      const response = await fetch(`/api/lane-match${query}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || t.resultFailed);
      setLaneData(payload);
      if (laneOverride && payload.laneCount > 0 && laneOverride > payload.laneCount) setSelectedLane(null);
    } catch (error) {
      setLaneError(error instanceof Error ? error.message : t.resultFailed);
    } finally {
      setLaneLoading(false);
    }
  }, [selectedLane, session?.access_token, t.resultFailed]);

  useEffect(() => {
    if (!session?.access_token) return undefined;
    refreshLaneMatch();
    if (scorerOpen) return undefined;
    const interval = window.setInterval(() => refreshLaneMatch(), 5000);
    return () => window.clearInterval(interval);
  }, [refreshLaneMatch, scorerOpen, session?.access_token]);

  function changeLanguage(nextLang) {
    setLang(nextLang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
    document.documentElement.lang = nextLang;
  }

  async function logout() {
    await supabase?.auth.signOut();
    window.location.href = '/';
  }

  function beginGame() {
    setStartPrompt({ playerOneName, playerTwoName: opponentMode === 'ai' ? 'AI' : playerTwoName, opponentMode, linked: null });
  }

  function beginLinkedGame() {
    if (!laneData?.competition || !laneData?.match) return;
    const linked = {
      competitionKey: laneData.competition.key,
      competitionLabel: laneData.competition.label,
      matchId: laneData.match.id,
      matchKey: laneData.match.key,
      lane: laneData.match.laneNumber,
      roundLabel: laneData.match.roundLabel,
      side1Label: laneData.match.side1Label,
      side2Label: laneData.match.side2Label
    };
    setStartPrompt({ playerOneName: linked.side1Label, playerTwoName: linked.side2Label, opponentMode: 'human', linked });
  }

  function chooseStarter(startingPlayerIndex) {
    if (!startPrompt) return;
    setState(startMickeyGame({
      playerOneName: startPrompt.playerOneName,
      playerTwoName: startPrompt.playerTwoName,
      opponentMode: startPrompt.opponentMode,
      aiAverageMarks,
      startingPlayerIndex
    }));
    setPlayerOneName(startPrompt.playerOneName);
    setPlayerTwoName(startPrompt.playerTwoName);
    setOpponentMode(startPrompt.opponentMode);
    setLinkedMatch(startPrompt.linked);
    setSubmission({ status: 'idle', message: '' });
    setApprovalDismissed(false);
    setResultApprovalOpen(false);
    setStartPrompt(null);
    setActivePanel('setup');
    setScorerOpen(true);
    requestMickeyFullscreen();
  }

  function resumeGame() {
    setScorerOpen(true);
    requestMickeyFullscreen();
  }

  function restartGame() {
    const prompt = linkedMatch && submission.status !== 'success' ? {
      playerOneName: linkedMatch.side1Label,
      playerTwoName: linkedMatch.side2Label,
      opponentMode: 'human',
      linked: linkedMatch
    } : null;
    setState(createMickeyState({ playerOneName, playerTwoName, opponentMode, aiAverageMarks }));
    setLinkedMatch(null);
    setSubmission({ status: 'idle', message: '' });
    setApprovalDismissed(false);
    setResultApprovalOpen(false);
    setActivePanel('setup');
    setScorerOpen(false);
    if (prompt) setStartPrompt(prompt);
    exitMickeyFullscreen();
  }

  function closeScorer() {
    setScorerOpen(false);
    exitMickeyFullscreen();
  }

  function mark(playerIndex, targetIndex) {
    setState(previous => markMickeyTarget(previous, playerIndex, targetIndex, 1));
  }

  function runAi() {
    setState(previous => runMickeyAiTurn(previous));
  }

  function undo() {
    setState(previous => undoMickeyVisit(previous));
  }

  function undoFinishedEntry() {
    setState(previous => undoMickeyVisit(previous));
    setSubmission({ status: 'idle', message: '' });
    setResultApprovalOpen(false);
    setApprovalDismissed(false);
  }

  useEffect(() => {
    if (state.status === 'finished' && state.winnerIndex !== null && submission.status === 'idle' && !approvalDismissed) setResultApprovalOpen(true);
    if (state.status !== 'finished') {
      setResultApprovalOpen(false);
      setApprovalDismissed(false);
    }
  }, [approvalDismissed, state.status, state.winnerIndex, submission.status]);

  function cancelResultApproval() {
    setResultApprovalOpen(false);
    setApprovalDismissed(true);
  }

  function requestResultApproval() {
    setApprovalDismissed(false);
    setResultApprovalOpen(true);
  }

  async function approveResultAndClose() {
    if (state.status !== 'finished' || state.winnerIndex === null || submission.status === 'sending') return;
    if (!linkedMatch) {
      setResultApprovalOpen(false);
      setScorerOpen(false);
      exitMickeyFullscreen();
      return;
    }
    if (!session?.access_token) return;

    setSubmission({ status: 'sending', message: t.resultSending });
    const gameResult = buildMickeyTournamentResult(state, {
      source: 'showdart-spil-page', competitionKey: linkedMatch.competitionKey, matchId: linkedMatch.matchId, lane: linkedMatch.lane
    });
    try {
      const response = await fetch('/api/lane-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ competitionKey: linkedMatch.competitionKey, matchId: linkedMatch.matchId, lane: linkedMatch.lane, winnerIndex: state.winnerIndex, gameResult })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || t.resultFailed);
      setSubmission({ status: 'success', message: t.resultSent });
      setLaneData(payload.next || null);
      setResultApprovalOpen(false);
      setApprovalDismissed(false);
      setScorerOpen(false);
      setLinkedMatch(null);
      setState(createMickeyState({ playerOneName, playerTwoName, opponentMode, aiAverageMarks }));
      exitMickeyFullscreen();
    } catch (error) {
      setSubmission({ status: 'error', message: error instanceof Error ? error.message : t.resultFailed });
      refreshLaneMatch(linkedMatch.lane);
    }
  }

  if (loading) return <main className="sd-page game-center">{t.loading}</main>;
  if (!session) return <main className="sd-page game-center"><a className="sd-button gold" href="/">{t.login}</a></main>;

  const statusLabel = state.status === 'finished' ? t.finished : state.status === 'playing' ? t.activeGame : t.notStarted;
  const resultPayload = buildMickeyTournamentResult(state, { source: 'showdart-spil-page' });

  return (
    <main className="sd-page game-page">
      <header className="sd-topbar">
        <div className="sd-brand">
          <div className="sd-logo-mark" />
          <div>
            <div className="sd-brand-title">Showdart</div>
            <div className="sd-brand-subtitle">{t.brandSub}</div>
          </div>
        </div>
        <nav className="sd-nav">
          <button type="button" onClick={() => { window.location.href = '/'; }}><Trophy size={20} />{t.tournament}</button>
          <button type="button" onClick={() => { window.location.href = '/championship'; }}><ClipboardList size={20} />{t.championship}</button>
          <button type="button" className="is-active"><Gamepad2 size={20} />{t.game}</button>
          {role === 'admin' ? <button type="button" onClick={() => { window.location.href = '/admin'; }}><UsersRound size={20} />{t.admin}</button> : null}
        </nav>
        <div className="sd-userbar">
          <span>{email} ({role})</span>
          <button type="button" aria-label="Dansk" className={`sd-flag ${lang === 'da' ? 'is-active' : ''}`} style={{ backgroundImage: "url('https://flagcdn.com/w40/dk.png')" }} onClick={() => changeLanguage('da')} />
          <button type="button" aria-label="English" className={`sd-flag ${lang === 'en' ? 'is-active' : ''}`} style={{ backgroundImage: "url('https://flagcdn.com/w40/gb.png')" }} onClick={() => changeLanguage('en')} />
          <button type="button" className="sd-logout" onClick={logout}>{t.logout}</button>
        </div>
      </header>

      <section className="game-hero">
        <div className="sd-card game-hero-card">
          <p className="sd-small-label">Mickey</p>
          <h1 className="sd-title">{t.title}</h1>
          <p>{t.subtitle}</p>
          <div className="game-status-row">
            <span>{statusLabel}</span>
            <span>{state.players[0].name} / {state.players[1].name}</span>
            <span>{state.opponentMode === 'ai' ? t.ai : t.twoPlayers}</span>
          </div>
        </div>
        <div className="sd-card game-integration-card">
          <p className="sd-small-label">{t.integration}</p>
          <strong>{submission.message || (laneData?.match ? `${t.lane} ${laneData.match.laneNumber} · ${t.matchReady}` : t.resultWaiting)}</strong>
          <p>{t.integrationBody}</p>
        </div>
      </section>

      <section className="game-tabs">
        <button type="button" className={`sd-button ${activePanel === 'setup' ? 'gold' : ''}`} onClick={() => setActivePanel('setup')}><Settings size={17} /> {t.setup}</button>
        <button type="button" className="sd-button" onClick={() => { window.location.href = '/'; }}>{t.openTournament}</button>
        <button type="button" className="sd-button" onClick={() => { window.location.href = '/championship'; }}>{t.openChampionship}</button>
      </section>

      <section className="game-layout">
        <SetupPanel
          t={t}
          playerOneName={playerOneName}
          playerTwoName={playerTwoName}
          opponentMode={opponentMode}
          aiAverageMarks={aiAverageMarks}
          setPlayerOneName={setPlayerOneName}
          setPlayerTwoName={setPlayerTwoName}
          setOpponentMode={setOpponentMode}
          setAiAverageMarks={setAiAverageMarks}
          onStart={beginGame}
          selectedLane={selectedLane}
          onLaneChange={setSelectedLane}
          laneData={laneData}
          laneLoading={laneLoading}
          laneError={laneError}
          onRefresh={() => refreshLaneMatch()}
          onLinkedStart={beginLinkedGame}
          onResume={resumeGame}
          linkedMatch={linkedMatch}
          gameStatus={state.status}
        />
        <aside className="game-side">
          <RulesPanel t={t} />
          <ResultPanel t={t} state={state} resultPayload={resultPayload} submission={submission} linkedMatch={linkedMatch} />
        </aside>
      </section>

      {startPrompt ? (
        <div className="mickey-modal-backdrop">
          <div className="starter-modal sd-card" role="dialog" aria-modal="true" aria-label={t.whoStarts}>
            <button type="button" className="starter-close" aria-label={t.closeApp} onClick={() => setStartPrompt(null)}><X size={22} /></button>
            <MapPin size={32} />
            <p className="sd-small-label">{startPrompt.linked ? `${t.lane} ${startPrompt.linked.lane} · ${startPrompt.linked.roundLabel}` : t.manualGame}</p>
            <h2>{t.whoStarts}</h2>
            <p>{t.whoStartsHint}</p>
            <div className="starter-options">
              <button type="button" onClick={() => chooseStarter(0)}>{startPrompt.playerOneName}</button>
              <button type="button" onClick={() => chooseStarter(1)}>{startPrompt.playerTwoName}</button>
            </div>
          </div>
        </div>
      ) : null}

      {scorerOpen ? (
        <div className="mickey-modal-backdrop">
          <div className="mickey-modal" role="dialog" aria-modal="true" aria-label={t.boardTitle}>
            <MickeyBoard t={t} state={state} linkedMatch={linkedMatch} submission={submission} onMark={mark} onUndo={undo} onAiTurn={runAi} onRequestApproval={requestResultApproval} onRestart={restartGame} onClose={closeScorer} />
          </div>
        </div>
      ) : null}

      {resultApprovalOpen && state.winnerIndex !== null ? (
        <div className="mickey-modal-backdrop result-approval-backdrop">
          <div className="result-approval-modal sd-card" role="dialog" aria-modal="true" aria-label={t.confirmResult}>
            <CheckCircle2 size={38} />
            <p className="sd-small-label">{linkedMatch ? `${t.lane} ${linkedMatch.lane} · ${linkedMatch.roundLabel}` : t.manualGame}</p>
            <h2>{t.confirmResult}</h2>
            <p>{t.confirmResultHint}</p>
            <div className="result-approval-winner"><span>{t.winner}</span><strong>{state.players[state.winnerIndex]?.name}</strong></div>
            {submission.status === 'error' ? <p className="game-submission is-error">{submission.message}</p> : null}
            <div className="result-approval-actions">
              <button type="button" className="sd-button gold" disabled={submission.status === 'sending'} onClick={approveResultAndClose}><CheckCircle2 size={18} /> {submission.status === 'sending' ? t.resultSending : t.approveClose}</button>
              <button type="button" className="sd-button" disabled={submission.status === 'sending'} onClick={undoFinishedEntry}><Undo2 size={18} /> {t.undoLastEntry}</button>
              <button type="button" className="sd-button" disabled={submission.status === 'sending'} onClick={cancelResultApproval}><X size={18} /> {t.cancel}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SetupPanel({ t, playerOneName, playerTwoName, opponentMode, aiAverageMarks, setPlayerOneName, setPlayerTwoName, setOpponentMode, setAiAverageMarks, onStart, selectedLane, onLaneChange, laneData, laneLoading, laneError, onRefresh, onLinkedStart, onResume, linkedMatch, gameStatus }) {
  const statusMessages = {
    no_competition: t.noCompetition,
    round_not_published: t.roundNotPublished,
    waiting_for_match: t.waitingForMatch,
    inactive_lane: t.inactiveLane,
    choose_lane: t.chooseLane
  };
  const laneDataIsCurrent = !!selectedLane && laneData?.lane === selectedLane;
  const readyMatch = laneDataIsCurrent ? laneData?.match : null;
  const isSameActiveMatch = ['playing', 'finished'].includes(gameStatus) && linkedMatch?.matchKey && linkedMatch.matchKey === readyMatch?.key;
  return (
    <section className="sd-card game-panel">
      <div className="game-lane-toolbar">
        <label>
          <MapPin size={18} />
          <span>{t.laneSetup}</span>
          <select className="sd-select" aria-label={t.chooseLane} value={selectedLane || ''} onChange={event => onLaneChange(event.target.value ? Number(event.target.value) : null)}>
            <option value="">{t.chooseLane}</option>
            {Array.from({ length: laneData?.laneCount || 0 }, (_, index) => index + 1).map(lane => <option key={lane} value={lane}>{t.lane} {lane}</option>)}
          </select>
        </label>
        <button type="button" className="game-refresh-button" title={t.refresh} aria-label={t.refresh} disabled={laneLoading} onClick={onRefresh}><RefreshCw size={18} className={laneLoading ? 'is-spinning' : ''} /></button>
      </div>
      {selectedLane && readyMatch ? (
        <article className="game-linked-match">
          <div className="game-linked-meta"><span>{t.matchReady}</span><small>{laneData.competition?.label} · {readyMatch.roundLabel}</small></div>
          <div className="game-linked-versus"><strong>{readyMatch.side1Label}</strong><b>VS</b><strong>{readyMatch.side2Label}</strong></div>
          <button type="button" className="sd-button gold" onClick={isSameActiveMatch ? onResume : onLinkedStart}>{isSameActiveMatch ? t.continueMatch : t.startMatch}</button>
        </article>
      ) : selectedLane ? <div className="game-lane-status">{laneLoading || !laneDataIsCurrent ? t.refreshing : laneError || statusMessages[laneData?.status] || t.waitingForMatch}</div> : null}

      <details className="game-manual-details">
        <summary>{t.manualGame}</summary>
        <div className="game-manual-content">
          <div className="game-panel-head">
            <div><h2 className="sd-panel-title">{t.setupTitle}</h2><p>{t.manualGameHint}</p></div>
            <button type="button" className="sd-button" onClick={onStart}>{t.start}</button>
          </div>
          <div className="game-form-grid">
            <label><span>{t.playerOne}</span><input className="sd-input" value={playerOneName} maxLength={40} onChange={event => setPlayerOneName(event.target.value)} /></label>
            <label><span>{t.playerTwo}</span><input className="sd-input" value={opponentMode === 'ai' ? 'AI' : playerTwoName} maxLength={40} disabled={opponentMode === 'ai'} onChange={event => setPlayerTwoName(event.target.value)} /></label>
          </div>
          <div className="game-mode-grid">
            <button type="button" className={opponentMode === 'human' ? 'is-active' : ''} onClick={() => setOpponentMode('human')}><UsersRound size={20} />{t.twoPlayers}</button>
            <button type="button" className={opponentMode === 'ai' ? 'is-active' : ''} onClick={() => setOpponentMode('ai')}><Bot size={20} />{t.ai}</button>
          </div>
          {opponentMode === 'ai' ? <div className="game-ai-control"><div><span>{t.aiStrength}</span><strong>{Number(aiAverageMarks).toFixed(2)}</strong></div><input type="range" min="0.25" max="5" step="0.25" value={aiAverageMarks} onChange={event => setAiAverageMarks(Number(event.target.value))} /><p>{t.aiHelp}</p></div> : <p className="game-muted">{t.humanMode}</p>}
        </div>
      </details>
    </section>
  );
}

function MickeyBoard({ t, state, linkedMatch, submission, onMark, onUndo, onAiTurn, onRequestApproval, onRestart, onClose }) {
  const canPlay = state.status === 'playing';
  const starterName = state.players[state.startingPlayerIndex]?.name;
  return (
    <section className="sd-card game-panel game-board-panel">
      <div className="game-panel-head">
        <div>
          <h2 className="sd-panel-title">{t.boardTitle}</h2>
          <p>{linkedMatch ? `${t.linkedMatch} · ${t.lane} ${linkedMatch.lane} · ${linkedMatch.roundLabel}` : (state.opponentMode === 'ai' ? t.aiMode : t.humanMode)}</p>
          <p className="game-starter"><strong>{t.starts}: {starterName}</strong>{state.message ? ` · ${state.message}` : ''}</p>
          {submission.message ? <p className={`game-submission is-${submission.status}`}>{submission.status === 'success' ? <CheckCircle2 size={16} /> : null}{submission.message}</p> : null}
        </div>
        <div className="game-actions">
          <button type="button" className="sd-button" disabled={!state.visits.length || (!!linkedMatch && state.status === 'finished')} onClick={onUndo}><Undo2 size={16} /> {t.undo}</button>
          {state.opponentMode === 'ai' ? <button type="button" className="sd-button gold" disabled={!canPlay} onClick={onAiTurn}><Bot size={16} /> {t.aiTurn}</button> : null}
          {state.status === 'finished' ? <button type="button" className="sd-button gold" onClick={onRequestApproval}><CheckCircle2 size={16} /> {t.confirmResult}</button> : null}
          <button type="button" className="sd-button" onClick={onRestart}><RotateCcw size={16} /> {t.restart}</button>
          <button type="button" className="sd-button" onClick={onClose}><X size={16} /> {t.closeApp}</button>
        </div>
      </div>
      <div className="mickey-grid" style={{ '--mickey-rows': MICKEY_TARGETS.length + 1 }}>
        <div className="mickey-cell mickey-corner" />
        {state.players.map((player, playerIndex) => (
          <div key={playerIndex} className={`mickey-cell mickey-player ${state.winnerIndex === playerIndex ? 'is-winner' : ''}`}>
            <strong>{player.name}</strong>
          </div>
        ))}
        {MICKEY_TARGETS.map((target, targetIndex) => (
          <div key={target.key} className="mickey-row">
            <div className="mickey-cell mickey-target">{getMickeyTargetLabel(targetIndex)}</div>
            {[0, 1].map(playerIndex => {
              const marks = state.players[playerIndex]?.marks[targetIndex] || 0;
              const disabled = !canPlay || marks >= 3 || (state.opponentMode === 'ai' && playerIndex === 1);
              return (
                <button
                  key={`${target.key}-${playerIndex}`}
                  type="button"
                  disabled={disabled}
                  className={`mickey-cell mickey-mark ${marks >= 3 ? 'is-closed' : ''}`}
                  onClick={() => onMark(playerIndex, targetIndex)}
                  aria-label={`${state.players[playerIndex]?.name} ${target.label} ${marks}/3`}
                >
                  <MickeyMark marks={marks} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function MickeyMark({ marks }) {
  return (
    <span className="mickey-symbol" aria-hidden="true">
      {marks >= 1 ? <span className="line one" /> : null}
      {marks >= 2 ? <span className="line two" /> : null}
      {marks >= 3 ? <span className="circle" /> : null}
    </span>
  );
}

function RulesPanel({ t }) {
  return (
    <section className="sd-card game-panel game-rules">
      <h2 className="sd-panel-title">{t.ruleTitle}</h2>
      <ol>
        {MICKEY_RULES.map(rule => <li key={rule}>{rule}</li>)}
      </ol>
    </section>
  );
}

function ResultPanel({ t, state, resultPayload, submission, linkedMatch }) {
  const winner = state.winnerIndex === 0 || state.winnerIndex === 1 ? state.players[state.winnerIndex] : null;
  return (
    <section className="sd-card game-panel game-result">
      <div className="game-panel-head">
        <h2 className="sd-panel-title">{t.resultReady}</h2>
        <Send size={18} />
      </div>
      {winner ? (
        <>
          <div className="game-winner">
            <span>{t.winner}</span>
            <strong>{winner.name}</strong>
          </div>
          <div className="game-stat-grid">
            {state.players.map((player, index) => (
              <div key={index}>
                <span>{player.name}</span>
                <strong>{player.marks.filter(mark => mark >= 3).length}/{MICKEY_TARGETS.length}</strong>
                <small>{player.rawMarks} {t.marks} · {player.dartsThrown} {t.darts} · {getMickeyMpr(player)} {t.mpr}</small>
              </div>
            ))}
          </div>
          <p>{linkedMatch ? submission.message || t.awaitingApproval : t.resultHint}</p>
          <pre>{JSON.stringify(resultPayload, null, 2)}</pre>
        </>
      ) : (
        <p>{isMickeyPlayerFinished(state.players[0]) || isMickeyPlayerFinished(state.players[1]) ? t.sendLater : t.noResult}</p>
      )}
    </section>
  );
}
