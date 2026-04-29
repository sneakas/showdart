'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../lib/supabaseBrowser';
import { buildScreenState } from '../../../lib/tournamentScreenState';

const LANGUAGE_STORAGE_KEY = 'showdart-language';

const texts = {
  da: {
    loading: 'Indlæser tilskuerskærm...',
    invalidTitle: 'Ugyldigt skærmlink',
    invalidBody: 'Dette link er ikke gyldigt eller kunne ikke hentes.',
    betweenRounds: 'Mellem runder',
    roundLive: 'Aktuelle kampe',
    registrationOpen: 'Registrerede deltagere',
    waitingTitle: 'Venter på turnering',
    waitingBody: 'Turneringen er ikke startet endnu. Skærmen opdaterer automatisk, når arrangøren opretter eller opdaterer turneringen.',
    standings: 'Stilling',
    finalResults: 'Slutstilling',
    losses: 'Nederlag',
    status: 'Status',
    active: 'Aktiv',
    eliminated: 'Elimineret',
    round: 'Runde',
    team: 'Hold',
    player: 'Spiller',
    place: 'Plads',
    vs: 'VS',
    winner: 'Vinder',
    onBye: 'Sidder over',
    lane: 'Bane',
    waitingForLane: 'Venter på bane',
    temporaryStandings: 'Midlertidig stilling',
    temporaryStandingsHint: 'Live kampe vender tilbage automatisk',
    updated: 'Senest opdateret',
    live: 'Live',
    scanQr: 'Scan QR-kode',
    scanQrHint: 'Åbn skærmen på din telefon',
    tournamentNotStarted: 'Turneringen er ikke startet',
    fixedTeams: 'Faste makkere',
    changingTeams: 'Skiftende makkere',
    matches: 'Kampe',
    participants: 'Deltagere'
  },
  en: {
    loading: 'Loading spectator screen...',
    invalidTitle: 'Invalid screen link',
    invalidBody: 'This link is not valid or could not be loaded.',
    betweenRounds: 'Between rounds',
    roundLive: 'Current matches',
    registrationOpen: 'Registered entries',
    waitingTitle: 'Waiting for tournament',
    waitingBody: 'The tournament has not started yet. This screen updates automatically when the organizer creates or updates the tournament.',
    standings: 'Standings',
    finalResults: 'Final results',
    losses: 'Losses',
    status: 'Status',
    active: 'Active',
    eliminated: 'Eliminated',
    round: 'Round',
    team: 'Team',
    player: 'Player',
    place: 'Place',
    vs: 'VS',
    winner: 'Winner',
    onBye: 'Sitting out',
    lane: 'Lane',
    waitingForLane: 'Waiting for lane',
    temporaryStandings: 'Temporary standings',
    temporaryStandingsHint: 'Live matches return automatically',
    updated: 'Last updated',
    live: 'Live',
    scanQr: 'Scan QR Code',
    scanQrHint: 'Open this screen on your phone',
    tournamentNotStarted: 'Tournament not started',
    fixedTeams: 'Fixed teammates',
    changingTeams: 'Changing teammates',
    matches: 'Matches',
    participants: 'Participants'
  }
};

const colors = {
  bg: '#030806',
  bg2: '#07120d',
  panel: 'rgba(5, 43, 27, .95)',
  panelDark: 'rgba(3, 18, 12, .98)',
  border: 'rgba(43, 99, 73, .88)',
  gold: '#d89d24',
  gold2: '#f1bd35',
  text: '#f6f6ed',
  soft: '#dfe8de',
  muted: '#aab9ae',
  green: '#4bd17d',
  orange: '#f2844c'
};

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'da';
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'da' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('da') ? 'da' : 'en';
}

function formatUpdatedAt(value, lang) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString(lang === 'da' ? 'da-DK' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function getStatusText(entry, t) {
  if (entry.active) return t.active;
  if (entry.eliminationRound === 'final') return `${t.eliminated} Final`;
  if (Number.isFinite(Number(entry.eliminationRound))) return `${t.eliminated} R${entry.eliminationRound}`;
  return t.eliminated;
}

const pageStyle = {
  minHeight: '100vh',
  background: `radial-gradient(circle at 18% 0%, rgba(216, 169, 40, 0.11), transparent 26rem), linear-gradient(180deg, ${colors.bg} 0%, ${colors.bg2} 48%, #020504 100%)`,
  color: colors.text,
  fontFamily: 'Manrope, system-ui, sans-serif',
  textTransform: 'uppercase',
  overflowX: 'hidden'
};

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: `2px solid ${colors.gold2}`,
        background: `radial-gradient(circle, ${colors.bg2} 0 22%, transparent 23%), conic-gradient(${colors.gold2} 0 12deg, #111 12deg 24deg, ${colors.gold2} 24deg 36deg, #111 36deg 48deg, ${colors.gold2} 48deg 60deg, #111 60deg 72deg, ${colors.gold2} 72deg 84deg, #111 84deg 96deg, ${colors.gold2} 96deg 108deg, #111 108deg 120deg, ${colors.gold2} 120deg 132deg, #111 132deg 144deg, ${colors.gold2} 144deg 156deg, #111 156deg 168deg, ${colors.gold2} 168deg 180deg, #111 180deg 192deg, ${colors.gold2} 192deg 204deg, #111 204deg 216deg, ${colors.gold2} 216deg 228deg, #111 228deg 240deg, ${colors.gold2} 240deg 252deg, #111 252deg 264deg, ${colors.gold2} 264deg 276deg, #111 276deg 288deg, ${colors.gold2} 288deg 300deg, #111 300deg 312deg, ${colors.gold2} 312deg 324deg, #111 324deg 336deg, ${colors.gold2} 336deg 348deg, #111 348deg 360deg)`,
        boxShadow: '0 0 26px rgba(216, 169, 40, 0.25)'
      }} />
      <div>
        <div style={{ fontSize: 29, fontWeight: 900, lineHeight: .92 }}>Showdart</div>
        <div style={{ color: colors.gold2, fontSize: 13, fontWeight: 900, letterSpacing: '.34em', marginTop: 7 }}>Turnering</div>
      </div>
    </div>
  );
}

function FlagButton({ active, label, src, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 34,
        height: 24,
        borderRadius: 3,
        border: active ? `2px solid ${colors.gold2}` : '1px solid #63806d',
        backgroundImage: `url('${src}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: colors.panel,
        padding: 0
      }}
    />
  );
}

function Card({ children, style }) {
  return (
    <section style={{
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      background: `radial-gradient(circle at 100% 0%, rgba(31, 100, 62, .22), transparent 14rem), linear-gradient(145deg, ${colors.panel}, ${colors.panelDark})`,
      boxShadow: '0 18px 34px rgba(0, 0, 0, .42)',
      ...style
    }}>
      {children}
    </section>
  );
}

function BottomItem({ label, value, green }) {
  return (
    <div style={{ borderLeft: '1px solid rgba(255,255,255,.14)', paddingLeft: 28 }}>
      <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.08em' }}>{label}</div>
      <div style={{ color: green ? colors.green : colors.text, fontSize: 19, fontWeight: 900, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function StatusBar({ t, screenState, updatedAt, lang }) {
  return (
    <footer style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      height: 72,
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      background: 'linear-gradient(90deg, rgba(5, 28, 18, .96), rgba(9, 42, 28, .96), rgba(4, 18, 12, .96))',
      borderTop: '1px solid #1c5a41',
      boxShadow: '0 -18px 40px rgba(0,0,0,.4)',
      padding: '12px 54px',
      zIndex: 20
    }}>
      <BottomItem label={t.status} value={screenState.phase === 'round' ? t.roundLive : screenState.phase === 'final' ? t.finalResults : t.standings} green />
      <BottomItem label={t.participants} value={String(screenState.entries.length)} />
      <BottomItem label={t.round} value={String(screenState.currentRound || 0)} />
      <BottomItem label={t.updated} value={formatUpdatedAt(updatedAt, lang)} />
    </footer>
  );
}

function StandingsTable({ entries, t, entryLabel, maxLosses, final }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 18 }}>
        <thead>
          <tr>
            <th style={tableHeadStyle}>{t.place}</th>
            <th style={tableHeadStyle}>{entryLabel}</th>
            {!final ? <th style={tableHeadStyle}>{t.losses}</th> : null}
            {!final ? <th style={tableHeadStyle}>{t.status}</th> : null}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.place || index}-${entry.id}`}>
              <td style={tableCellStyle}>{entry.place || index + 1}</td>
              <td style={tableCellStyle}>{entry.name}</td>
              {!final ? <td style={tableCellStyle}>{entry.losses}/{maxLosses}</td> : null}
              {!final ? <td style={{ ...tableCellStyle, color: entry.active ? colors.green : colors.orange }}>{getStatusText(entry, t)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tableHeadStyle = {
  color: colors.gold2,
  textAlign: 'left',
  fontSize: 13,
  letterSpacing: '.08em',
  padding: '12px 14px',
  borderBottom: '1px solid rgba(255,255,255,.09)'
};

const tableCellStyle = {
  padding: 14,
  borderBottom: '1px solid rgba(255,255,255,.08)',
  fontWeight: 800
};

function TeamBox({ active, label }) {
  return (
    <div style={{
      padding: '18px 16px',
      borderRadius: 10,
      textAlign: 'center',
      fontWeight: 900,
      fontSize: 'clamp(1.1rem, 2.4vw, 1.6rem)',
      background: active ? 'rgba(75, 209, 125, .18)' : 'rgba(2, 8, 5, .34)',
      border: active ? `1px solid ${colors.green}` : '1px solid rgba(255,255,255,.08)'
    }}>
      {label}
    </div>
  );
}

function MatchCard({ match, t, round }) {
  const winner = match.winner === 1 ? match.team1Label : match.winner === 2 ? match.team2Label : '';
  const laneText = Number.isFinite(Number(match.laneNumber)) ? `${t.lane} ${match.laneNumber}` : t.waitingForLane;

  return (
    <Card style={{ padding: 18, borderColor: winner ? colors.green : colors.border }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <strong>{t.round} {round} - #{match.id}</strong>
        <span style={{ border: '1px solid rgba(241, 189, 53, .38)', color: colors.gold2, borderRadius: 999, padding: '7px 12px', fontWeight: 900 }}>{laneText}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'center' }}>
        <TeamBox active={match.winner === 1} label={match.team1Label} />
        <div style={{ color: colors.muted, fontWeight: 900 }}>{t.vs}</div>
        <TeamBox active={match.winner === 2} label={match.team2Label} />
      </div>
      {winner ? <div style={{ color: colors.green, marginTop: 14, fontWeight: 900 }}>{t.winner}: {winner}</div> : null}
    </Card>
  );
}

export default function ScreenPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const params = useParams();
  const rawToken = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const token = decodeURIComponent(rawToken || '');

  const [lang, setLang] = useState('da');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [screenMeta, setScreenMeta] = useState(null);
  const [tournamentState, setTournamentState] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [clockTick, setClockTick] = useState(0);

  const t = texts[lang] || texts.da;
  const screenState = useMemo(() => buildScreenState(tournamentState), [tournamentState, clockTick]);

  useEffect(() => {
    const initialLang = getInitialLanguage();
    setLang(initialLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, initialLang);
      document.documentElement.lang = initialLang;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShareUrl(window.location.href);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadScreen() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/tournament-screen/public?token=${encodeURIComponent(token)}`);
        const payload = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setError(payload?.error || 'Screen error');
          setLoading(false);
          return;
        }

        setScreenMeta(payload);
        setTournamentState(payload.state || null);
        setUpdatedAt(payload.updatedAt || null);
        setLoading(false);
      } catch (_error) {
        if (cancelled) return;
        setError('Failed to load spectator screen');
        setLoading(false);
      }
    }

    if (token) loadScreen();
    else {
      setError('Missing token');
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!supabase || !screenMeta?.realtimeChannel) return undefined;

    const channel = supabase
      .channel(screenMeta.realtimeChannel, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'tournament-state' }, ({ payload }) => {
        if (!payload?.state) return;
        setTournamentState(payload.state);
        setUpdatedAt(payload.updatedAt || new Date().toISOString());
      });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [screenMeta, supabase]);

  useEffect(() => {
    const expiresAt = Number(tournamentState?.spectatorOverride?.expiresAt || 0);
    if (!expiresAt || expiresAt <= Date.now()) return undefined;

    const intervalId = window.setInterval(() => setClockTick(Date.now()), 250);
    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      setClockTick(Date.now());
    }, Math.max(0, expiresAt - Date.now()) + 300);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [tournamentState?.spectatorOverride?.expiresAt]);

  if (loading) {
    return <main style={{ ...pageStyle, display: 'grid', placeItems: 'center', padding: 24 }}>{t.loading}</main>;
  }

  if (error) {
    return (
      <main style={{ ...pageStyle, display: 'grid', placeItems: 'center', padding: 24 }}>
        <Card style={{ width: 'min(100%, 760px)', padding: 28 }}>
          <Brand />
          <h1 style={{ margin: '28px 0 8px', fontSize: 38 }}>{t.invalidTitle}</h1>
          <p style={{ color: colors.soft, textTransform: 'none' }}>{t.invalidBody}</p>
          <p style={{ color: colors.gold2, marginBottom: 0, textTransform: 'none' }}>{error}</p>
        </Card>
      </main>
    );
  }

  const entryLabel = screenState.isFixedTeams ? t.team : t.player;
  const modeLabel = screenState.isFixedTeams ? t.fixedTeams : t.changingTeams;
  const displayTitle = screenState.tournamentName || 'Showdart Live';
  const qrSrc = shareUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(shareUrl)}` : '';
  const showQrCode = Boolean(qrSrc) && (screenState.phase === 'waiting' || screenState.phase === 'registration');

  return (
    <main style={pageStyle}>
      <header style={{
        height: 88,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 24,
        padding: '0 44px',
        borderBottom: `1px solid ${colors.gold}`,
        background: 'linear-gradient(90deg, #020604, #04120c 44%, #02100a)'
      }}>
        <Brand />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, border: `1px solid ${colors.border}`, borderRadius: 999, background: 'rgba(5, 43, 27, .82)', padding: '9px 14px', color: colors.soft, fontSize: 13, fontWeight: 900 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors.green, boxShadow: '0 0 16px rgba(75, 209, 125, .65)' }} />
            {t.live} · {t.updated}: {formatUpdatedAt(updatedAt, lang)}
          </div>
          <FlagButton active={lang === 'da'} label="Dansk" src="https://flagcdn.com/w40/dk.png" onClick={() => setLang('da')} />
          <FlagButton active={lang === 'en'} label="English" src="https://flagcdn.com/w40/gb.png" onClick={() => setLang('en')} />
        </div>
      </header>

      <section style={{
        minHeight: 238,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 350px',
        gap: 28,
        alignItems: 'start',
        padding: '28px 34px 34px',
        borderBottom: '1px solid #1c5a41',
        background: 'linear-gradient(90deg, rgba(3, 8, 6, .64), rgba(3, 8, 6, .08) 45%, rgba(3, 8, 6, .7)), url(/assets/dart-venue-banner.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 43%'
      }}>
        <Card style={{ padding: 28, maxWidth: 680, minHeight: 174 }}>
          <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{modeLabel}</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.7rem, 6vw, 5.8rem)', lineHeight: .92, letterSpacing: '.07em' }}>{displayTitle}</h1>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 22, color: colors.soft, fontSize: 15, fontWeight: 800 }}>
            <span>{screenState.entries.length} {t.participants}</span>
            <span>{t.round} {screenState.currentRound || 0}</span>
            <span>{screenState.maxLosses} {t.losses}</span>
          </div>
        </Card>

        {showQrCode ? (
          <Card style={{ padding: 18, textAlign: 'center' }}>
            <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.scanQr}</div>
            <img src={qrSrc} alt={t.scanQr} style={{ width: 180, maxWidth: '100%', height: 'auto', background: '#fff', borderRadius: 8, padding: 8, margin: '12px auto', display: 'block' }} />
            <div style={{ color: colors.soft, fontSize: 13 }}>{t.scanQrHint}</div>
          </Card>
        ) : (
          <Card style={{ padding: 22 }}>
            <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.status}</div>
            <h2 style={{ margin: '7px 0 0', fontSize: 26, letterSpacing: '.04em' }}>
              {screenState.phase === 'round' ? t.roundLive : screenState.phase === 'final' ? t.finalResults : t.standings}
            </h2>
          </Card>
        )}
      </section>

      <section style={{ padding: '18px 34px 110px' }}>
        {screenState.phase === 'waiting' ? (
          <Card style={{ padding: 22, maxWidth: 980 }}>
            <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.tournamentNotStarted}</div>
            <h2 style={{ margin: '7px 0 0', fontSize: 26, letterSpacing: '.04em' }}>{t.waitingTitle}</h2>
            <p style={{ color: colors.soft, textTransform: 'none', lineHeight: 1.55 }}>{t.waitingBody}</p>
          </Card>
        ) : null}

        {screenState.phase === 'registration' ? (
          <Card style={{ padding: 22 }}>
            <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.tournamentNotStarted}</div>
            <h2 style={{ margin: '7px 0 18px', fontSize: 26, letterSpacing: '.04em' }}>{t.registrationOpen}</h2>
            <StandingsTable entries={screenState.standings} t={t} entryLabel={entryLabel} maxLosses={screenState.maxLosses} />
          </Card>
        ) : null}

        {screenState.phase === 'standings' ? (
          <Card style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{screenState.spectatorOverride?.active ? t.temporaryStandings : t.betweenRounds}</div>
                <h2 style={{ margin: '7px 0 0', fontSize: 26, letterSpacing: '.04em' }}>{t.standings}</h2>
              </div>
              <strong style={{ fontSize: 22 }}>{t.round} {screenState.currentRound}</strong>
            </div>
            {screenState.spectatorOverride?.active ? (
              <div style={{ marginBottom: 18 }}>
                <div style={{ color: colors.soft, marginBottom: 8, fontSize: 13 }}>{t.temporaryStandingsHint}</div>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, screenState.spectatorOverride.progress * 100))}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${colors.gold2} 0%, ${colors.green} 100%)`, transition: 'width 240ms linear' }} />
                </div>
              </div>
            ) : null}
            <StandingsTable entries={screenState.standings} t={t} entryLabel={entryLabel} maxLosses={screenState.maxLosses} />
          </Card>
        ) : null}

        {screenState.phase === 'round' ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <Card style={{ padding: 22 }}>
              <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.roundLive}</div>
              <h2 style={{ margin: '7px 0 0', fontSize: 26, letterSpacing: '.04em' }}>{t.round} {screenState.currentRound} · {screenState.matches.length} {t.matches}</h2>
            </Card>

            {screenState.skippedEntries.length > 0 ? (
              <Card style={{ padding: 22, borderColor: 'rgba(241, 189, 53, .45)' }}>
                <div style={{ color: colors.gold2, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.onBye}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  {screenState.skippedEntries.map(entry => (
                    <span key={entry.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 999, padding: '10px 14px', fontWeight: 900 }}>{entry.name}</span>
                  ))}
                </div>
              </Card>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 14 }}>
              {screenState.matches.map(match => <MatchCard key={match.id} match={match} t={t} round={screenState.currentRound} />)}
            </div>
          </div>
        ) : null}

        {screenState.phase === 'final' ? (
          <Card style={{ padding: 22 }}>
            <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.finalResults}</div>
            <h2 style={{ margin: '7px 0 18px', fontSize: 26, letterSpacing: '.04em' }}>{displayTitle}</h2>
            <StandingsTable entries={screenState.finalPlacements} t={t} entryLabel={entryLabel} maxLosses={screenState.maxLosses} final />
          </Card>
        ) : null}
      </section>

      <StatusBar t={t} screenState={screenState} updatedAt={updatedAt} lang={lang} />
    </main>
  );
}
