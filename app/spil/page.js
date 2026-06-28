'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, ClipboardList, Gamepad2, RotateCcw, Send, Settings, Trophy, Undo2, UsersRound, X } from 'lucide-react';
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
  runMickeyAiTurn,
  startMickeyGame,
  undoMickeyVisit
} from '../../lib/mickey/engine';
import '../dashboard.css';
import './spil.css';

const LANGUAGE_STORAGE_KEY = 'showdart-language';
const STORAGE_PREFIX = 'showdart-mickey-state';

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
    integrationBody: 'Forberedt: Mickey kan nu returnere vinder, taber, marks, pile, MPR og metadata. Næste trin er at forbinde den payload til en konkret turneringskamp.',
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
    openChampionship: 'Til mesterskab'
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
    integrationBody: 'Prepared: Mickey can now return winner, loser, marks, darts, MPR and metadata. Next step is connecting that payload to a specific tournament match.',
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
    openChampionship: 'To championship'
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
      const stored = localStorage.getItem(`${STORAGE_PREFIX}-${session.user.id}`);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      setState(parsed);
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
    setState(startMickeyGame({ playerOneName, playerTwoName, opponentMode, aiAverageMarks }));
    setActivePanel('setup');
    setScorerOpen(true);
    requestMickeyFullscreen();
  }

  function restartGame() {
    setState(createMickeyState({ playerOneName, playerTwoName, opponentMode, aiAverageMarks }));
    setActivePanel('setup');
    setScorerOpen(false);
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
          <strong>{resultPayload ? t.resultReady : t.resultWaiting}</strong>
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
        />
        <aside className="game-side">
          <RulesPanel t={t} />
          <ResultPanel t={t} state={state} resultPayload={resultPayload} />
        </aside>
      </section>

      {scorerOpen ? (
        <div className="mickey-modal-backdrop">
          <div className="mickey-modal" role="dialog" aria-modal="true" aria-label={t.boardTitle}>
            <MickeyBoard t={t} state={state} onMark={mark} onUndo={undo} onAiTurn={runAi} onRestart={restartGame} onClose={closeScorer} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SetupPanel({ t, playerOneName, playerTwoName, opponentMode, aiAverageMarks, setPlayerOneName, setPlayerTwoName, setOpponentMode, setAiAverageMarks, onStart }) {
  return (
    <section className="sd-card game-panel">
      <div className="game-panel-head">
        <h2 className="sd-panel-title">{t.setupTitle}</h2>
        <button type="button" className="sd-button gold" onClick={onStart}>{t.start}</button>
      </div>
      <div className="game-form-grid">
        <label>
          <span>{t.playerOne}</span>
          <input className="sd-input" value={playerOneName} maxLength={40} onChange={event => setPlayerOneName(event.target.value)} />
        </label>
        <label>
          <span>{t.playerTwo}</span>
          <input className="sd-input" value={opponentMode === 'ai' ? 'AI' : playerTwoName} maxLength={40} disabled={opponentMode === 'ai'} onChange={event => setPlayerTwoName(event.target.value)} />
        </label>
      </div>
      <div className="game-mode-grid">
        <button type="button" className={opponentMode === 'human' ? 'is-active' : ''} onClick={() => setOpponentMode('human')}><UsersRound size={20} />{t.twoPlayers}</button>
        <button type="button" className={opponentMode === 'ai' ? 'is-active' : ''} onClick={() => setOpponentMode('ai')}><Bot size={20} />{t.ai}</button>
      </div>
      {opponentMode === 'ai' ? (
        <div className="game-ai-control">
          <div>
            <span>{t.aiStrength}</span>
            <strong>{Number(aiAverageMarks).toFixed(2)}</strong>
          </div>
          <input type="range" min="0.25" max="5" step="0.25" value={aiAverageMarks} onChange={event => setAiAverageMarks(Number(event.target.value))} />
          <p>{t.aiHelp}</p>
        </div>
      ) : <p className="game-muted">{t.humanMode}</p>}
    </section>
  );
}

function MickeyBoard({ t, state, onMark, onUndo, onAiTurn, onRestart, onClose }) {
  const canPlay = state.status === 'playing';
  return (
    <section className="sd-card game-panel game-board-panel">
      <div className="game-panel-head">
        <div>
          <h2 className="sd-panel-title">{t.boardTitle}</h2>
          <p>{state.message || (state.opponentMode === 'ai' ? t.aiMode : t.humanMode)}</p>
        </div>
        <div className="game-actions">
          <button type="button" className="sd-button" disabled={!state.visits.length} onClick={onUndo}><Undo2 size={16} /> {t.undo}</button>
          {state.opponentMode === 'ai' ? <button type="button" className="sd-button gold" disabled={!canPlay} onClick={onAiTurn}><Bot size={16} /> {t.aiTurn}</button> : null}
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

function ResultPanel({ t, state, resultPayload }) {
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
          <p>{t.resultHint}</p>
          <pre>{JSON.stringify(resultPayload, null, 2)}</pre>
        </>
      ) : (
        <p>{isMickeyPlayerFinished(state.players[0]) || isMickeyPlayerFinished(state.players[1]) ? t.sendLater : t.noResult}</p>
      )}
    </section>
  );
}
