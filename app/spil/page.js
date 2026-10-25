'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CheckCircle2, ClipboardList, Gamepad2, MapPin, RefreshCw, RotateCcw, Send, Settings, Trophy, Undo2, UsersRound, X } from 'lucide-react';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';
import { buildLaneDisplayBoard } from '../../lib/laneDisplay';
import { useLaneDisplay } from '../../lib/useLaneDisplay';
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
  orderMickeyPlayersByStarter,
  runMickeyAiTurn,
  startMickeyGame,
  undoMickeyVisit
} from '../../lib/mickey/engine';
import {
  buildFinalMickeyResult,
  createFinalMickeyState,
  markFinalMickeyTarget,
  normalizeFinalMickeyState,
  startFinalMickeyGame,
  undoFinalMickeyVisit
} from '../../lib/mickey/finalEngine';
import '../dashboard.css';
import './spil.css';

const LANGUAGE_STORAGE_KEY = 'showdart-language';
const STORAGE_PREFIX = 'showdart-mickey-state';
const LANE_STORAGE_PREFIX = 'showdart-tablet-lane';
const LINKED_MATCH_STORAGE_PREFIX = 'showdart-linked-match';
const FINAL_STORAGE_PREFIX = 'showdart-mickey-final-state';

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
    cancel: 'Annuller', undoLastEntry: 'Fortryd sidste indtastning', awaitingApproval: 'Venter på spillernes godkendelse',
    individualFinal: 'Individuel finale', chooseOrder: 'Vælg kasterækkefølge', chooseOrderHint: 'Vælg hvem der kaster som {place}. Spillerne placeres fra venstre mod højre i denne rækkefølge.',
    orderPlaces: ['første', 'anden', 'tredje', 'fjerde'], finalPlacements: 'Finaleplaceringer', placeShort: 'plads', finalConfirmHint: 'Kontrollér alle placeringer, før resultatet sendes til turneringen.'
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
    cancel: 'Cancel', undoLastEntry: 'Undo last entry', awaitingApproval: 'Waiting for player approval',
    individualFinal: 'Individual final', chooseOrder: 'Choose throwing order', chooseOrderHint: 'Choose who throws {place}. Players are placed left to right in this order.',
    orderPlaces: ['first', 'second', 'third', 'fourth'], finalPlacements: 'Final placements', placeShort: 'place', finalConfirmHint: 'Check every placement before the result is sent to the tournament.'
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
  const [finalState, setFinalState] = useState(() => createFinalMickeyState());
  const [selectedLane, setSelectedLane] = useState(null);
  const [laneData, setLaneData] = useState(null);
  const [laneLoading, setLaneLoading] = useState(false);
  const [laneError, setLaneError] = useState('');
  const laneRequestRef = useRef(0);
  const [linkedMatch, setLinkedMatch] = useState(null);
  const [startPrompt, setStartPrompt] = useState(null);
  const [finalOrderPrompt, setFinalOrderPrompt] = useState(null);
  const [submission, setSubmission] = useState({ status: 'idle', message: '' });
  const [resultApprovalOpen, setResultApprovalOpen] = useState(false);
  const [approvalDismissed, setApprovalDismissed] = useState(false);
  const [screenConfig, setScreenConfig] = useState({ enabled: false, lanes: [] });
  const [screenWanted, setScreenWanted] = useState(false);
  const [restoredForUser, setRestoredForUser] = useState(null);
  const displayBoard = useMemo(() => buildLaneDisplayBoard({ state, finalState, linkedMatch }), [state, finalState, linkedMatch]);
  const screen = useLaneDisplay({ session, lane: linkedMatch?.lane || selectedLane, board: displayBoard, linkedMatch, enabled: screenWanted && screenConfig.enabled && restoredForUser === session?.user?.id });
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
    setState(createMickeyState());
    setFinalState(createFinalMickeyState());
    setLinkedMatch(null);
    try {
      setScreenWanted(localStorage.getItem(`showdart-screen-enabled-${session.user.id}`) !== 'false');
      const storedLane = Number(localStorage.getItem(`${LANE_STORAGE_PREFIX}-${session.user.id}`));
      setSelectedLane(Number.isInteger(storedLane) && storedLane > 0 ? storedLane : null);
      const storedLink = JSON.parse(localStorage.getItem(`${LINKED_MATCH_STORAGE_PREFIX}-${session.user.id}`) || 'null');
      setLinkedMatch(storedLink && typeof storedLink === 'object' ? storedLink : null);
      const storedFinal = localStorage.getItem(`${FINAL_STORAGE_PREFIX}-${session.user.id}`);
      if (storedFinal) setFinalState(normalizeFinalMickeyState(JSON.parse(storedFinal)));
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
    } finally {
      setRestoredForUser(session.user.id);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || restoredForUser !== session.user.id) return;
    localStorage.setItem(`${STORAGE_PREFIX}-${session.user.id}`, JSON.stringify(state));
  }, [session?.user?.id, state, restoredForUser]);

  useEffect(() => {
    if (!session?.user?.id || restoredForUser !== session.user.id) return;
    localStorage.setItem(`${FINAL_STORAGE_PREFIX}-${session.user.id}`, JSON.stringify(finalState));
  }, [finalState, session?.user?.id, restoredForUser]);

  useEffect(() => {
    if (!session?.user?.id || restoredForUser !== session.user.id) return;
    const laneKey = `${LANE_STORAGE_PREFIX}-${session.user.id}`;
    if (selectedLane) localStorage.setItem(laneKey, String(selectedLane));
    else localStorage.removeItem(laneKey);
  }, [selectedLane, session?.user?.id, restoredForUser]);

  useEffect(() => {
    if (!session?.user?.id || restoredForUser !== session.user.id) return;
    const linkKey = `${LINKED_MATCH_STORAGE_PREFIX}-${session.user.id}`;
    if (linkedMatch) localStorage.setItem(linkKey, JSON.stringify(linkedMatch));
    else localStorage.removeItem(linkKey);
  }, [linkedMatch, session?.user?.id, restoredForUser]);

  const refreshLaneMatch = useCallback(async (laneOverride = selectedLane) => {
    if (!session?.access_token) return;
    const requestId = ++laneRequestRef.current;
    setLaneLoading(true);
    setLaneError('');
    try {
      const query = laneOverride ? `?lane=${encodeURIComponent(laneOverride)}` : '';
      const response = await fetch(`/api/lane-match${query}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const payload = await response.json();
      if (requestId !== laneRequestRef.current) return;
      if (!response.ok) throw new Error(payload?.error || t.resultFailed);
      setLaneData(payload);
      if (laneOverride && payload.laneCount > 0 && laneOverride > payload.laneCount) setSelectedLane(null);
    } catch (error) {
      if (requestId === laneRequestRef.current) setLaneError(error instanceof Error ? error.message : t.resultFailed);
    } finally {
      if (requestId === laneRequestRef.current) setLaneLoading(false);
    }
  }, [selectedLane, session?.access_token, t.resultFailed]);

  useEffect(() => {
    if (!session?.access_token) return undefined;
    let active = true;
    fetch('/api/lane-display', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(response => response.ok ? response.json() : { enabled: false, lanes: [] })
      .then(config => { if (active) setScreenConfig(config); })
      .catch(() => { if (active) setScreenConfig({ enabled: false, lanes: [] }); });
    return () => { active = false; };
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) return undefined;
    refreshLaneMatch();
    if (scorerOpen) return undefined;
    let timer;
    const recover = () => { timer = window.setTimeout(() => { refreshLaneMatch(); recover(); }, 90_000 + Math.round(Math.random() * 30_000)); };
    recover();
    const resume = () => { if (document.visibilityState === 'visible') refreshLaneMatch(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [refreshLaneMatch, scorerOpen, session?.access_token]);

  const laneChannelKey = (laneData?.realtimeChannels || []).join('|');
  useEffect(() => {
    if (!supabase || scorerOpen || !laneChannelKey) return undefined;
    let timer;
    const channels = laneChannelKey.split('|').map(name => supabase.channel(name)
      .on('broadcast', { event: 'tournament-state' }, () => { clearTimeout(timer); timer = setTimeout(() => refreshLaneMatch(), 250); })
      .subscribe());
    return () => { clearTimeout(timer); channels.forEach(channel => { supabase.removeChannel(channel); }); };
  }, [supabase, scorerOpen, laneChannelKey, refreshLaneMatch]);

  function changeLanguage(nextLang) {
    setLang(nextLang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
    document.documentElement.lang = nextLang;
  }

  async function logout() {
    await screen.release();
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
      competitionInstanceId: laneData.competition.instanceId,
      competitionLabel: laneData.competition.label,
      matchId: laneData.match.id,
      matchKey: laneData.match.key,
      lane: laneData.match.laneNumber,
      roundLabel: laneData.match.roundLabel,
      side1Label: laneData.match.side1Label,
      side2Label: laneData.match.side2Label,
      isFinal: !!laneData.match.isFinal,
      participants: Array.isArray(laneData.match.participants) ? laneData.match.participants : []
    };
    if (linked.isFinal && linked.participants.length >= 2) {
      setFinalOrderPrompt({ linked, orderedPlayerIds: [] });
      return;
    }
    setStartPrompt({ playerOneName: linked.side1Label, playerTwoName: linked.side2Label, opponentMode: 'human', linked });
  }

  function chooseFinalOrderPlayer(playerId) {
    if (!finalOrderPrompt) return;
    const orderedPlayerIds = [...finalOrderPrompt.orderedPlayerIds, Number(playerId)];
    if (orderedPlayerIds.length < finalOrderPrompt.linked.participants.length) {
      setFinalOrderPrompt({ ...finalOrderPrompt, orderedPlayerIds });
      return;
    }
    const nextLinkedMatch = { ...finalOrderPrompt.linked, throwOrderPlayerIds: orderedPlayerIds };
    setFinalState(startFinalMickeyGame({ participants: nextLinkedMatch.participants, throwOrderPlayerIds: orderedPlayerIds }));
    setLinkedMatch(nextLinkedMatch);
    setSubmission({ status: 'idle', message: '' });
    setApprovalDismissed(false);
    setResultApprovalOpen(false);
    setFinalOrderPrompt(null);
    setActivePanel('setup');
    setScorerOpen(true);
    requestMickeyFullscreen();
  }

  function chooseStarter(startingPlayerIndex) {
    if (!startPrompt) return;
    const starterOrder = startPrompt.opponentMode === 'human'
      ? orderMickeyPlayersByStarter(startPrompt.playerOneName, startPrompt.playerTwoName, startingPlayerIndex)
      : { playerOneName: startPrompt.playerOneName, playerTwoName: startPrompt.playerTwoName, sourcePlayerIndexes: [0, 1] };
    const nextLinkedMatch = startPrompt.linked ? { ...startPrompt.linked, competitionSideIndexes: starterOrder.sourcePlayerIndexes } : null;
    setState(startMickeyGame({
      playerOneName: starterOrder.playerOneName,
      playerTwoName: starterOrder.playerTwoName,
      opponentMode: startPrompt.opponentMode,
      aiAverageMarks,
      startingPlayerIndex: startPrompt.opponentMode === 'human' ? 0 : startingPlayerIndex
    }));
    setPlayerOneName(starterOrder.playerOneName);
    setPlayerTwoName(starterOrder.playerTwoName);
    setOpponentMode(startPrompt.opponentMode);
    setLinkedMatch(nextLinkedMatch);
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

  async function restartGame() {
    await screen.release();
    const prompt = linkedMatch && submission.status !== 'success' ? {
      playerOneName: linkedMatch.side1Label,
      playerTwoName: linkedMatch.side2Label,
      opponentMode: 'human',
      linked: linkedMatch
    } : null;
    setState(createMickeyState({ playerOneName, playerTwoName, opponentMode, aiAverageMarks }));
    setFinalState(createFinalMickeyState());
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

  function markFinal(playerIndex, targetIndex) {
    setFinalState(previous => markFinalMickeyTarget(previous, playerIndex, targetIndex, 1));
  }

  function runAi() {
    setState(previous => runMickeyAiTurn(previous));
  }

  function undo() {
    if (linkedMatch?.isFinal) setFinalState(previous => undoFinalMickeyVisit(previous));
    else setState(previous => undoMickeyVisit(previous));
  }

  function undoFinishedEntry() {
    if (linkedMatch?.isFinal) setFinalState(previous => undoFinalMickeyVisit(previous));
    else setState(previous => undoMickeyVisit(previous));
    setSubmission({ status: 'idle', message: '' });
    setResultApprovalOpen(false);
    setApprovalDismissed(false);
  }

  useEffect(() => {
    const finished = linkedMatch?.isFinal
      ? finalState.status === 'finished' && finalState.placements.length === finalState.players.length
      : state.status === 'finished' && state.winnerIndex !== null;
    if (finished && submission.status === 'idle' && !approvalDismissed) setResultApprovalOpen(true);
    if (!finished) {
      setResultApprovalOpen(false);
      setApprovalDismissed(false);
    }
  }, [approvalDismissed, finalState.placements.length, finalState.players.length, finalState.status, linkedMatch?.isFinal, state.status, state.winnerIndex, submission.status]);

  function cancelResultApproval() {
    setResultApprovalOpen(false);
    setApprovalDismissed(true);
  }

  function requestResultApproval() {
    setApprovalDismissed(false);
    setResultApprovalOpen(true);
  }

  async function approveResultAndClose() {
    const isFinal = !!linkedMatch?.isFinal;
    if (submission.status === 'sending') return;
    if (isFinal && finalState.status !== 'finished') return;
    if (!isFinal && (state.status !== 'finished' || state.winnerIndex === null)) return;
    if (!linkedMatch) {
      setSubmission({ status: 'sending', message: t.resultSending });
      const display = await screen.getResultDisplay();
      if (display && session?.access_token) {
        setSubmission({ status: 'sending', message: t.resultSending });
        try {
          const response = await fetch('/api/lane-display/result', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ display, gameResult: buildMickeyTournamentResult(state) }) });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || t.resultFailed);
          const note = payload.screenDelivery === 'queued' ? (lang === 'da' ? ' Skærmresultatet sendes automatisk igen.' : ' Screen delivery will retry automatically.')
            : payload.screenDelivery === 'unavailable' ? (lang === 'da' ? ' Baneskærmen er ikke tilsluttet.' : ' The lane screen is disconnected.') : '';
          setSubmission({ status: 'success', message: (lang === 'da' ? 'Resultatet er godkendt.' : 'Result approved.') + note });
        } catch (error) { setSubmission({ status: 'error', message: error.message }); return; }
      } else setSubmission({ status: 'success', message: t.resultReady });
      await screen.release();
      setResultApprovalOpen(false);
      setScorerOpen(false);
      setState(createMickeyState({ playerOneName, playerTwoName, opponentMode, aiAverageMarks }));
      exitMickeyFullscreen();
      return;
    }
    if (!session?.access_token) return;

    setSubmission({ status: 'sending', message: t.resultSending });
    const mappedWinnerIndex = Array.isArray(linkedMatch.competitionSideIndexes)
      ? linkedMatch.competitionSideIndexes[state.winnerIndex]
      : state.winnerIndex;
    const competitionWinnerIndex = mappedWinnerIndex === 0 || mappedWinnerIndex === 1 ? mappedWinnerIndex : state.winnerIndex;
    const gameResult = isFinal ? buildFinalMickeyResult(finalState, {
      source: 'showdart-spil-page', competitionKey: linkedMatch.competitionKey, matchId: linkedMatch.matchId, lane: linkedMatch.lane
    }) : buildMickeyTournamentResult(state, {
      source: 'showdart-spil-page', competitionKey: linkedMatch.competitionKey, matchId: linkedMatch.matchId, lane: linkedMatch.lane,
      competitionWinnerIndex, competitionSideIndexes: linkedMatch.competitionSideIndexes || [0, 1]
    });
    try {
      const display = await screen.getResultDisplay();
      const response = await fetch('/api/lane-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(isFinal
          ? { competitionKey: linkedMatch.competitionKey, competitionInstanceId: linkedMatch.competitionInstanceId || 'legacy', matchId: linkedMatch.matchId, lane: linkedMatch.lane, resultType: 'final', orderedPlayerIds: gameResult?.orderedPlayerIds, gameResult, display }
          : { competitionKey: linkedMatch.competitionKey, competitionInstanceId: linkedMatch.competitionInstanceId || 'legacy', matchId: linkedMatch.matchId, lane: linkedMatch.lane, winnerIndex: competitionWinnerIndex, gameResult, display })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || t.resultFailed);
      await screen.release();
      const screenNote = payload.screenDelivery === 'queued' ? (lang === 'da' ? ' Skærmresultatet sendes automatisk igen.' : ' Screen delivery will retry automatically.')
        : payload.screenDelivery === 'unavailable' ? (lang === 'da' ? ' Baneskærmen er ikke tilsluttet.' : ' The lane screen is disconnected.') : '';
      setSubmission({ status: 'success', message: t.resultSent + screenNote });
      setLaneData(payload.next || null);
      setResultApprovalOpen(false);
      setApprovalDismissed(false);
      setScorerOpen(false);
      setLinkedMatch(null);
      setState(createMickeyState({ playerOneName, playerTwoName, opponentMode, aiAverageMarks }));
      setFinalState(createFinalMickeyState());
      exitMickeyFullscreen();
    } catch (error) {
      setSubmission({ status: 'error', message: error instanceof Error ? error.message : t.resultFailed });
      refreshLaneMatch(linkedMatch.lane);
    }
  }

  if (loading) return <main className="sd-page game-center">{t.loading}</main>;
  if (!session) return <main className="sd-page game-center"><a className="sd-button gold" href="/">{t.login}</a></main>;

  const currentStatus = linkedMatch?.isFinal ? finalState.status : state.status;
  const statusLabel = currentStatus === 'finished' ? t.finished : currentStatus === 'playing' ? t.activeGame : t.notStarted;
  const resultPayload = linkedMatch?.isFinal
    ? buildFinalMickeyResult(finalState, { source: 'showdart-spil-page' })
    : buildMickeyTournamentResult(state, { source: 'showdart-spil-page' });
  const finalPlacements = [...finalState.placements].sort((left, right) => left.place - right.place);

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
            <span>{linkedMatch?.isFinal ? finalState.players.map(player => player.name).join(' / ') : `${state.players[0].name} / ${state.players[1].name}`}</span>
            <span>{linkedMatch?.isFinal ? t.individualFinal : (state.opponentMode === 'ai' ? t.ai : t.twoPlayers)}</span>
          </div>
        </div>
        <div className="sd-card game-integration-card">
          <p className="sd-small-label">{t.integration}</p>
          <strong>{submission.message || (laneData?.match ? `${t.lane} ${laneData.match.laneNumber} · ${t.matchReady}` : t.resultWaiting)}</strong>
          <p>{t.integrationBody}</p>
        </div>
      </section>

      <section className="game-tabs">
        {!scorerOpen && displayBoard && !linkedMatch ? <button type="button" className="sd-button gold" onClick={resumeGame}>{t.continueMatch}</button> : null}
        <button type="button" className={`sd-button ${activePanel === 'setup' ? 'gold' : ''}`} onClick={() => setActivePanel('setup')}><Settings size={17} /> {t.setup}</button>
        <button type="button" className="sd-button" onClick={() => { window.location.href = '/'; }}>{t.openTournament}</button>
        <button type="button" className="sd-button" onClick={() => { window.location.href = '/championship'; }}>{t.openChampionship}</button>
      </section>

      {screenConfig.enabled ? <div className="sd-card game-screen-control">
        <label><input type="checkbox" checked={screenWanted} onChange={async event => { const wanted = event.target.checked; if (!wanted) await screen.release(); localStorage.setItem(`showdart-screen-enabled-${session.user.id}`, String(wanted)); setScreenWanted(wanted); }} /> {lang === 'da' ? 'Vis spil og resultat på baneskærmen' : 'Show game and result on the lane screen'}</label>
        {screenWanted ? <span role="status">{screen.error || (screen.status === 'live' ? (lang === 'da' ? 'Skærmen er tilsluttet' : 'Screen connected') : screen.status === 'connecting' ? (lang === 'da' ? 'Tilslutter skærmen…' : 'Connecting screen…') : (lang === 'da' ? 'Vælg bane og start et spil' : 'Choose a lane and start a game'))}</span> : null}
        {screenWanted && screen.error ? <button className="sd-button" type="button" onClick={screen.retry}>{t.retry}</button> : null}
      </div> : null}

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
          onLaneChange={async lane => { await screen.release(); setSelectedLane(lane); }}
          screenLanes={screenConfig.lanes}
          laneData={laneData}
          laneLoading={laneLoading}
          laneError={laneError}
          onRefresh={() => refreshLaneMatch()}
          onLinkedStart={beginLinkedGame}
          onResume={resumeGame}
          linkedMatch={linkedMatch}
          gameStatus={currentStatus}
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

      {finalOrderPrompt ? (
        <div className="mickey-modal-backdrop">
          <div className="starter-modal final-order-modal sd-card" role="dialog" aria-modal="true" aria-label={t.chooseOrder}>
            <button type="button" className="starter-close" aria-label={t.closeApp} onClick={() => setFinalOrderPrompt(null)}><X size={22} /></button>
            <Trophy size={32} />
            <p className="sd-small-label">{t.lane} {finalOrderPrompt.linked.lane} · {t.individualFinal}</p>
            <h2>{t.chooseOrder}</h2>
            <p>{t.chooseOrderHint.replace('{place}', t.orderPlaces[finalOrderPrompt.orderedPlayerIds.length])}</p>
            {finalOrderPrompt.orderedPlayerIds.length ? (
              <div className="final-order-selected">
                {finalOrderPrompt.orderedPlayerIds.map((id, index) => <span key={id}><b>{index + 1}</b>{finalOrderPrompt.linked.participants.find(player => player.id === id)?.name}</span>)}
              </div>
            ) : null}
            <div className="starter-options final-order-options">
              {finalOrderPrompt.linked.participants.filter(player => !finalOrderPrompt.orderedPlayerIds.includes(player.id)).map(player => (
                <button type="button" key={player.id} onClick={() => chooseFinalOrderPlayer(player.id)}>{player.name}</button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {scorerOpen ? (
        <div className="mickey-modal-backdrop">
          <div className="mickey-modal" role="dialog" aria-modal="true" aria-label={t.boardTitle}>
            {screenWanted && screen.error ? <div className="game-screen-warning" role="status">{screen.error} <button type="button" onClick={screen.retry}>{t.retry}</button></div> : null}
            {linkedMatch?.isFinal ? (
              <FinalMickeyBoard t={t} state={finalState} linkedMatch={linkedMatch} submission={submission} onMark={markFinal} onUndo={undo} onRequestApproval={requestResultApproval} onClose={closeScorer} />
            ) : (
              <MickeyBoard t={t} state={state} linkedMatch={linkedMatch} submission={submission} onMark={mark} onUndo={undo} onAiTurn={runAi} onRequestApproval={requestResultApproval} onRestart={restartGame} onClose={closeScorer} />
            )}
          </div>
        </div>
      ) : null}

      {resultApprovalOpen && (linkedMatch?.isFinal ? finalPlacements.length === finalState.players.length : state.winnerIndex !== null) ? (
        <div className="mickey-modal-backdrop result-approval-backdrop">
          <div className="result-approval-modal sd-card" role="dialog" aria-modal="true" aria-label={t.confirmResult}>
            <CheckCircle2 size={38} />
            <p className="sd-small-label">{linkedMatch ? `${t.lane} ${linkedMatch.lane} · ${linkedMatch.roundLabel}` : t.manualGame}</p>
            <h2>{t.confirmResult}</h2>
            <p>{linkedMatch?.isFinal ? t.finalConfirmHint : t.confirmResultHint}</p>
            {linkedMatch?.isFinal ? (
              <div className="result-approval-ranking">
                {finalPlacements.map(placement => {
                  const player = finalState.players.find(item => item.id === placement.playerId);
                  return <div key={placement.playerId}><span>{placement.place}. {t.placeShort}</span><strong>{player?.name}</strong></div>;
                })}
              </div>
            ) : <div className="result-approval-winner"><span>{t.winner}</span><strong>{state.players[state.winnerIndex]?.name}</strong></div>}
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

function SetupPanel({ t, playerOneName, playerTwoName, opponentMode, aiAverageMarks, setPlayerOneName, setPlayerTwoName, setOpponentMode, setAiAverageMarks, onStart, selectedLane, onLaneChange, laneData, laneLoading, laneError, onRefresh, onLinkedStart, onResume, linkedMatch, gameStatus, screenLanes = [] }) {
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
            {[...new Set([...Array.from({ length: laneData?.laneCount || 0 }, (_, index) => index + 1), ...screenLanes])].sort((a, b) => a - b).map(lane => <option key={lane} value={lane}>{t.lane} {lane}</option>)}
          </select>
        </label>
        <button type="button" className="game-refresh-button" title={t.refresh} aria-label={t.refresh} disabled={laneLoading} onClick={onRefresh}><RefreshCw size={18} className={laneLoading ? 'is-spinning' : ''} /></button>
      </div>
      {selectedLane && readyMatch ? (
        <article className="game-linked-match">
          <div className="game-linked-meta"><span>{t.matchReady}</span><small>{laneData.competition?.label} · {readyMatch.roundLabel}</small></div>
          {readyMatch.isFinal ? (
            <div className="game-linked-finalists">
              {readyMatch.participants.map((player, index) => <span key={player.id}><b>{index + 1}</b>{player.name}</span>)}
            </div>
          ) : <div className="game-linked-versus"><strong>{readyMatch.side1Label}</strong><b>VS</b><strong>{readyMatch.side2Label}</strong></div>}
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

function FinalMickeyBoard({ t, state, linkedMatch, submission, onMark, onUndo, onRequestApproval, onClose }) {
  const canPlay = state.status === 'playing';
  return (
    <section className="sd-card game-panel game-board-panel final-board-panel">
      <div className="game-panel-head final-board-head">
        <div>
          <h2 className="sd-panel-title">{t.individualFinal}</h2>
          <p>{t.lane} {linkedMatch.lane} · {linkedMatch.roundLabel}</p>
          <p className="game-starter"><strong>{t.starts}: {state.players[0]?.name}</strong>{state.message ? ` · ${state.message}` : ''}</p>
          {submission.message ? <p className={`game-submission is-${submission.status}`}>{submission.message}</p> : null}
        </div>
        <div className="game-actions">
          <button type="button" className="sd-button" disabled={!state.visits.length || state.status === 'finished'} onClick={onUndo}><Undo2 size={16} /> {t.undo}</button>
          {state.status === 'finished' ? <button type="button" className="sd-button gold" onClick={onRequestApproval}><CheckCircle2 size={16} /> {t.confirmResult}</button> : null}
          <button type="button" className="sd-button" onClick={onClose}><X size={16} /> {t.closeApp}</button>
        </div>
      </div>
      <div className="mickey-grid mickey-final-grid" style={{ '--final-player-count': state.players.length }}>
        <div className="mickey-cell mickey-corner" />
        {state.players.map(player => (
          <div key={player.id} className={`mickey-cell mickey-player final-player ${player.place ? 'has-place' : ''}`}>
            {player.place ? <span className="final-place-badge">{player.place}</span> : null}
            <strong>{player.name}</strong>
          </div>
        ))}
        {MICKEY_TARGETS.map((target, targetIndex) => (
          <div key={target.key} className="mickey-row">
            <div className="mickey-cell mickey-target">{getMickeyTargetLabel(targetIndex)}</div>
            {state.players.map((player, playerIndex) => {
              const marks = player.marks[targetIndex] || 0;
              const disabled = !canPlay || !!player.place || marks >= 3;
              return (
                <button
                  key={`${target.key}-${player.id}`}
                  type="button"
                  disabled={disabled}
                  className={`mickey-cell mickey-mark ${marks >= 3 ? 'is-closed' : ''} ${player.place ? 'is-placed' : ''}`}
                  onClick={() => onMark(playerIndex, targetIndex)}
                  aria-label={`${player.name} ${target.label} ${marks}/3`}
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
          {!linkedMatch ? <button type="button" className="sd-button" onClick={onRestart}><RotateCcw size={16} /> {t.restart}</button> : null}
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
