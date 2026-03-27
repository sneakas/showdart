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
    title: 'Showdart Live Skærm',
    subtitle: 'Separat visning for deltagere og tilskuere',
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
    updated: 'Senest opdateret',
    live: 'Live',
    scanQr: 'Scan QR-kode',
    scanQrHint: 'Åbn skærmen på din telefon',
    tournamentNotStarted: 'Turneringen er ikke startet',
    fixedTeams: 'Faste makkere',
    changingTeams: 'Skiftende makkere'
  },
  en: {
    loading: 'Loading spectator screen...',
    invalidTitle: 'Invalid screen link',
    invalidBody: 'This link is not valid or could not be loaded.',
    title: 'Showdart Live Screen',
    subtitle: 'Separate display for players and spectators',
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
    onBye: 'Bye',
    updated: 'Last updated',
    live: 'Live',
    scanQr: 'Scan QR Code',
    scanQrHint: 'Open this screen on your phone',
    tournamentNotStarted: 'Tournament not started',
    fixedTeams: 'Fixed teammates',
    changingTeams: 'Changing teammates'
  }
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
  if (entry.active) {
    return t.active;
  }

  if (entry.eliminationRound === 'final') {
    return `${t.eliminated} Final`;
  }

  if (Number.isFinite(Number(entry.eliminationRound))) {
    return `${t.eliminated} R${entry.eliminationRound}`;
  }

  return t.eliminated;
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

  const t = texts[lang] || texts.da;
  const screenState = useMemo(() => buildScreenState(tournamentState), [tournamentState]);

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

    if (token) {
      loadScreen();
    } else {
      setError('Missing token');
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!supabase || !screenMeta?.realtimeChannel) {
      return undefined;
    }

    const channel = supabase
      .channel(screenMeta.realtimeChannel, {
        config: {
          broadcast: { self: false }
        }
      })
      .on('broadcast', { event: 'tournament-state' }, ({ payload }) => {
        if (!payload?.state) {
          return;
        }

        setTournamentState(payload.state);
        setUpdatedAt(payload.updatedAt || new Date().toISOString());
      });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [screenMeta, supabase]);

  const pageStyle = {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top, #17382c 0%, #0b1e16 45%, #07140f 100%)',
    color: '#ecf8f2',
    padding: '24px'
  };

  if (loading) {
    return <main style={pageStyle}>{t.loading}</main>;
  }

  if (error) {
    return (
      <main style={pageStyle}>
        <section style={{ maxWidth: 860, margin: '0 auto', background: '#10271e', border: '1px solid #355748', borderRadius: 18, padding: 24 }}>
          <h1 style={{ marginTop: 0 }}>{t.invalidTitle}</h1>
          <p>{t.invalidBody}</p>
          <p style={{ color: '#cfe4d8', marginBottom: 0 }}>{error}</p>
        </section>
      </main>
    );
  }

  const entryLabel = screenState.isFixedTeams ? t.team : t.player;
  const modeLabel = screenState.isFixedTeams ? t.fixedTeams : t.changingTeams;
  const displayTitle = screenState.tournamentName || t.title;
  const qrSrc = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(shareUrl)}`
    : '';

  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 1280, margin: '0 auto', textTransform: 'uppercase' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#9db9ab', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12, marginBottom: 8 }}>{modeLabel}</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(2.4rem, 6vw, 4.6rem)', lineHeight: 1, letterSpacing: '0.08em' }}>{displayTitle}</h1>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setLang('da')}
                  style={{ width: 40, height: 30, borderRadius: 6, border: lang === 'da' ? '2px solid #f2d14c' : '1px solid #3e6353', backgroundImage: "url('https://flagcdn.com/w40/dk.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#10271e', padding: 0 }}
                  aria-label="Skift sprog til dansk"
                />
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  style={{ width: 40, height: 30, borderRadius: 6, border: lang === 'en' ? '2px solid #f2d14c' : '1px solid #3e6353', backgroundImage: "url('https://flagcdn.com/w40/gb.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#10271e', padding: 0 }}
                  aria-label="Switch language to English"
                />
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#10271e', border: '1px solid #355748', borderRadius: 999, padding: '8px 12px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#46c37b', boxShadow: '0 0 12px rgba(70,195,123,0.6)' }} />
                <strong>{t.live}</strong>
                <span style={{ color: '#cfe4d8' }}>{t.updated}: {formatUpdatedAt(updatedAt, lang)}</span>
              </div>
            </div>

            {qrSrc ? (
              <div style={{ background: '#10271e', border: '1px solid #355748', borderRadius: 18, padding: 12, textAlign: 'center', width: 170, textTransform: 'none' }}>
                <div style={{ color: '#9db9ab', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{t.scanQr}</div>
                <img
                  src={qrSrc}
                  alt={t.scanQr}
                  style={{ width: '100%', height: 'auto', borderRadius: 10, background: '#fff', padding: 8, display: 'block' }}
                />
                <div style={{ marginTop: 8, color: '#cfe4d8', fontSize: 12, lineHeight: 1.35 }}>{t.scanQrHint}</div>
              </div>
            ) : null}
          </div>
        </div>

        {screenState.phase === 'waiting' ? (
          <section style={{ background: '#10271e', border: '1px solid #355748', borderRadius: 18, padding: 28 }}>
            <h2 style={{ marginTop: 0 }}>{t.waitingTitle}</h2>
            <p style={{ marginBottom: 0, color: '#d9ece2' }}>{t.waitingBody}</p>
          </section>
        ) : null}

        {screenState.phase === 'registration' ? (
          <section style={{ background: '#10271e', border: '1px solid #355748', borderRadius: 18, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>{t.registrationOpen}</h2>
              <div style={{ color: '#9db9ab' }}>{t.tournamentNotStarted}</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#9db9ab', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>#</th>
                    <th style={{ padding: '10px 12px' }}>{entryLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {screenState.standings.map(entry => (
                    <tr key={entry.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding: '12px' }}>{entry.id}</td>
                      <td style={{ padding: '12px', fontWeight: 700 }}>{entry.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {screenState.phase === 'standings' ? (
          <section style={{ background: '#10271e', border: '1px solid #355748', borderRadius: 18, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#9db9ab', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>{t.betweenRounds}</div>
                <h2 style={{ margin: '6px 0 0' }}>{t.standings}</h2>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{t.round} {screenState.currentRound}</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#9db9ab', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>{t.place}</th>
                    <th style={{ padding: '10px 12px' }}>{entryLabel}</th>
                    <th style={{ padding: '10px 12px' }}>{t.losses}</th>
                    <th style={{ padding: '10px 12px' }}>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {screenState.standings.map((entry, index) => (
                    <tr key={entry.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding: '12px', fontWeight: 700 }}>{index + 1}</td>
                      <td style={{ padding: '12px', fontWeight: 700 }}>{entry.name}</td>
                      <td style={{ padding: '12px' }}>{entry.losses}/{screenState.maxLosses}</td>
                      <td style={{ padding: '12px', color: entry.active ? '#93e0a9' : '#f2b0b0' }}>{getStatusText(entry, t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {screenState.phase === 'round' ? (
          <section style={{ display: 'grid', gap: 18 }}>
            <div style={{ background: '#10271e', border: '1px solid #355748', borderRadius: 18, padding: 22, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#9db9ab', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>{t.roundLive}</div>
                <h2 style={{ margin: '6px 0 0' }}>{t.round} {screenState.currentRound}</h2>
              </div>
              <div style={{ color: '#cfe4d8' }}>{screenState.matches.length} {screenState.matches.length === 1 ? 'match' : 'matches'}</div>
            </div>

            {screenState.skippedEntries.length > 0 ? (
              <div style={{ background: '#10271e', border: '1px solid #7b6a2a', borderRadius: 18, padding: 18 }}>
                <div style={{ color: '#f2d14c', fontWeight: 700, marginBottom: 10 }}>{t.onBye}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {screenState.skippedEntries.map(entry => (
                    <div key={entry.id} style={{ padding: '10px 14px', borderRadius: 999, background: '#1b3428', border: '1px solid #355748', fontWeight: 700 }}>
                      {entry.name}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
              {screenState.matches.map(match => {
                const winner = match.winner === 1 ? match.team1Label : match.winner === 2 ? match.team2Label : '';

                return (
                  <article key={match.id} style={{ background: '#10271e', border: match.winner ? '1px solid #46c37b' : '1px solid #355748', borderRadius: 18, padding: 18, boxShadow: match.winner ? '0 0 0 1px rgba(70,195,123,0.25), 0 10px 30px rgba(0,0,0,0.22)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                      <strong>{t.round} {screenState.currentRound} - #{match.id}</strong>
                      {winner ? <span style={{ color: '#93e0a9', fontWeight: 700 }}>{t.winner}: {winner}</span> : null}
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: '14px 16px', borderRadius: 14, background: match.winner === 1 ? '#214735' : '#142a20', border: match.winner === 1 ? '1px solid #46c37b' : '1px solid rgba(255,255,255,0.06)', fontWeight: 800, textAlign: 'center' }}>
                        {match.team1Label}
                      </div>
                      <div style={{ textAlign: 'center', color: '#9db9ab', fontWeight: 700 }}>{t.vs}</div>
                      <div style={{ padding: '14px 16px', borderRadius: 14, background: match.winner === 2 ? '#214735' : '#142a20', border: match.winner === 2 ? '1px solid #46c37b' : '1px solid rgba(255,255,255,0.06)', fontWeight: 800, textAlign: 'center' }}>
                        {match.team2Label}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {screenState.phase === 'final' ? (
          <section style={{ background: '#10271e', border: '1px solid #355748', borderRadius: 18, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>{t.finalResults}</h2>
              <div style={{ color: '#9db9ab' }}>{t.round} {screenState.currentRound}</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#9db9ab', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>{t.place}</th>
                    <th style={{ padding: '10px 12px' }}>{entryLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {screenState.finalPlacements.map(entry => (
                    <tr key={entry.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding: '12px', fontWeight: 700 }}>{entry.place}</td>
                      <td style={{ padding: '12px', fontWeight: 700 }}>{entry.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
