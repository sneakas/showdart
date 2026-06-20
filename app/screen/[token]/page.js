'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../lib/supabaseBrowser';
import { buildScreenState } from '../../../lib/tournamentScreenState';

const LANGUAGE_STORAGE_KEY = 'showdart-language';
const DEFAULT_TV_SCREENS = {
  screen1: { label: 'Skærm 1', mode: 'live', rowsPerPage: 12, matchesPerPage: 6, rotationSeconds: 10, showQr: false, announcement: '', hideHeader: false, autoHideHeader: false, theme: 'classic' },
  screen2: { label: 'Skærm 2', mode: 'standings', rowsPerPage: 12, matchesPerPage: 6, rotationSeconds: 10, showQr: true, announcement: '', hideHeader: false, autoHideHeader: false, theme: 'classic' }
};

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
    reconnecting: 'Genopretter forbindelse',
    polling: 'Backup-opdatering aktiv',
    stale: 'Forbindelse forsinket',
    scanQr: 'Scan QR-kode',
    scanQrHint: 'Åbn skærmen på din telefon',
    tournamentNotStarted: 'Turneringen er ikke startet',
    fixedTeams: 'Faste makkere',
    changingTeams: 'Skiftende makkere',
    matches: 'Kampe',
    participants: 'Deltagere',
    lanes: 'Baner',
    page: 'Side',
    announcement: 'Besked fra arrangør',
    activeLane: 'Aktiv',
    inactiveLane: 'Inaktiv',
    noMatch: 'Ingen kamp',
    compactLaneOverview: 'Baneoversigt',
    laneCurrent: 'Spiller nu',
    laneQueued: 'Næste kamp',
    laneCompleted: 'Afsluttet',
    queuePosition: 'Køplads'
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
    reconnecting: 'Reconnecting',
    polling: 'Backup updates active',
    stale: 'Connection delayed',
    scanQr: 'Scan QR Code',
    scanQrHint: 'Open this screen on your phone',
    tournamentNotStarted: 'Tournament not started',
    fixedTeams: 'Fixed teammates',
    changingTeams: 'Changing teammates',
    matches: 'Matches',
    participants: 'Participants',
    lanes: 'Lanes',
    page: 'Page',
    announcement: 'Organizer message',
    activeLane: 'Active',
    inactiveLane: 'Inactive',
    noMatch: 'No match',
    compactLaneOverview: 'Lane overview',
    laneCurrent: 'Playing now',
    laneQueued: 'Next match',
    laneCompleted: 'Completed',
    queuePosition: 'Queue position'
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

function getThemeStyles(theme) {
  if (theme === 'highContrast') {
    return {
      page: {
        background: 'linear-gradient(180deg, #000 0%, #020604 100%)',
        filter: 'contrast(1.08) saturate(1.05)'
      },
      header: 'linear-gradient(90deg, #000, #03140d 46%, #000)',
      accent: '#ffd34d'
    };
  }
  if (theme === 'light') {
    return {
      page: {
        background: 'radial-gradient(circle at 18% 0%, rgba(241,189,53,.22), transparent 25rem), linear-gradient(180deg, #132015 0%, #07120d 100%)'
      },
      header: 'linear-gradient(90deg, #0a1510, #12301f 46%, #0b1711)',
      accent: '#f7d35a'
    };
  }
  if (theme === 'minimal') {
    return {
      page: {
        background: 'linear-gradient(180deg, #010302 0%, #020705 100%)'
      },
      header: 'rgba(1, 5, 3, .96)',
      accent: colors.gold2
    };
  }
  return {
    page: {},
    header: 'linear-gradient(90deg, #020604, #04120c 44%, #02100a)',
    accent: colors.gold2
  };
}

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <img
        src="/assets/small-logo.png"
        alt="Showdart"
        style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        objectFit: 'cover',
        boxShadow: '0 0 26px rgba(216, 169, 40, 0.25)'
      }}
      />
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

function BottomItem({ label, value, green, dense }) {
  return (
    <div style={{ borderLeft: '1px solid rgba(255,255,255,.14)', paddingLeft: dense ? 18 : 28 }}>
      <div style={{ color: colors.muted, fontSize: dense ? 10 : 12, fontWeight: 900, letterSpacing: '.08em' }}>{label}</div>
      <div style={{ color: green ? colors.green : colors.text, fontSize: dense ? 16 : 19, fontWeight: 900, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function StatusBar({ t, screenState, updatedAt, lang, compact, dense }) {
  return (
    <footer style={{
      position: compact ? 'static' : 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      height: compact ? 'auto' : dense ? 58 : 72,
      display: 'grid',
      gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)',
      gap: compact ? 12 : 0,
      background: 'linear-gradient(90deg, rgba(5, 28, 18, .96), rgba(9, 42, 28, .96), rgba(4, 18, 12, .96))',
      borderTop: '1px solid #1c5a41',
      boxShadow: '0 -18px 40px rgba(0,0,0,.4)',
      padding: compact ? '14px 18px' : dense ? '8px 42px' : '12px 54px',
      zIndex: 20
    }}>
      <BottomItem dense={dense} label={t.status} value={screenState.phase === 'round' ? t.roundLive : screenState.phase === 'final' ? t.finalResults : t.standings} green />
      <BottomItem dense={dense} label={t.participants} value={String(screenState.entries.length)} />
      <BottomItem dense={dense} label={t.round} value={String(screenState.currentRound || 0)} />
      <BottomItem dense={dense} label={t.updated} value={formatUpdatedAt(updatedAt, lang)} />
    </footer>
  );
}

function getPageSize(phase, viewportWidth) {
  const phone = viewportWidth < 620;
  const tablet = viewportWidth < 900;
  if (phase === 'round') return phone ? 2 : tablet ? 3 : 6;
  if (phase === 'registration') return phone ? 8 : tablet ? 12 : 12;
  if (phase === 'final') return phone ? 8 : tablet ? 12 : 12;
  return phone ? 7 : tablet ? 10 : 12;
}

function getScreenConfig(screenState, screenKey) {
  const key = screenKey === 'screen2' ? 'screen2' : 'screen1';
  const defaults = DEFAULT_TV_SCREENS[key];
  const configured = screenState.tvScreens?.[key] || {};
  const theme = ['classic', 'highContrast', 'light', 'minimal'].includes(configured.theme) ? configured.theme : defaults.theme;
  return {
    ...defaults,
    ...configured,
    rowsPerPage: Math.max(6, Math.min(20, Number(configured.rowsPerPage || defaults.rowsPerPage))),
    matchesPerPage: Math.max(1, Math.min(20, Number(configured.matchesPerPage || defaults.matchesPerPage))),
    rotationSeconds: Math.max(5, Math.min(60, Number(configured.rotationSeconds || defaults.rotationSeconds))),
    showQr: configured.showQr !== undefined ? configured.showQr !== false : defaults.showQr !== false,
    announcement: String(configured.announcement || '').trim().slice(0, 180),
    hideHeader: !!configured.hideHeader,
    autoHideHeader: !!configured.autoHideHeader,
    theme
  };
}

function getAutoContentView(screenState) {
  return screenState.phase;
}

function getModeContentView(mode, screenState, rotatingView) {
  if (screenState.started && !screenState.roundPublished && mode !== 'info') return 'standings';
  if (mode === 'rotating') return rotatingView;
  if (mode === 'info') return 'info';
  if (mode === 'live') {
    if (screenState.phase === 'round') return 'round';
    if (screenState.phase === 'final') return 'final';
    return screenState.started ? 'standings' : 'info';
  }
  if (mode === 'lanes') {
    return 'lanes';
  }
  if (mode === 'standings') {
    if (screenState.phase === 'final') return 'final';
    return screenState.started ? 'standings' : 'registration';
  }
  if (mode === 'final') {
    return screenState.phase === 'final' ? 'final' : (screenState.started ? 'standings' : 'info');
  }
  return getAutoContentView(screenState);
}

function getRotatingViews(screenState) {
  const views = ['info'];
  if (screenState.phase === 'round') views.push('round');
  if (screenState.entries.length > 0) views.push(screenState.started ? 'standings' : 'registration');
  if (screenState.phase === 'final') views.push('final');
  return [...new Set(views)];
}

function chunkItems(items, size) {
  const safeSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize));
  }
  return chunks.length ? chunks : [[]];
}

function PageIndicator({ t, page, pageCount }) {
  if (pageCount <= 1) return null;
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      border: `1px solid ${colors.border}`,
      borderRadius: 999,
      color: colors.gold2,
      background: 'rgba(2, 8, 5, .42)',
      padding: '7px 12px',
      fontSize: 13,
      fontWeight: 900,
      letterSpacing: '.08em'
    }}>
      {t.page} {page + 1} / {pageCount}
    </div>
  );
}

function PagedDisplay({ items, pageSize, resetKey, t, children, intervalMs = 10000 }) {
  const pages = useMemo(() => chunkItems(items, pageSize), [items, pageSize]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [resetKey, pageSize, pages.length]);

  useEffect(() => {
    if (pages.length <= 1 || typeof window === 'undefined') return undefined;
    const intervalId = window.setInterval(() => {
      setPage(current => (current + 1) % pages.length);
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [pages.length, intervalMs]);

  const safePage = Math.min(page, pages.length - 1);
  return children({
    visibleItems: pages[safePage] || [],
    page: safePage,
    pageCount: pages.length,
    startIndex: safePage * Math.max(1, Number(pageSize) || 1),
    indicator: <PageIndicator t={t} page={safePage} pageCount={pages.length} />
  });
}

function StandingsTable({ entries, t, entryLabel, maxLosses, final, showTournamentColumns = true, startIndex = 0, dense = false }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: dense ? 15 : 18 }}>
        <thead>
          <tr>
            <th style={tableHeadStyle}>{t.place}</th>
            <th style={tableHeadStyle}>{entryLabel}</th>
            {!final && showTournamentColumns ? <th style={tableHeadStyle}>{t.losses}</th> : null}
            {!final && showTournamentColumns ? <th style={tableHeadStyle}>{t.status}</th> : null}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.place || index}-${entry.id}`}>
              <td style={{ ...tableCellStyle, padding: dense ? '10px 12px' : tableCellStyle.padding }}>{entry.place || startIndex + index + 1}</td>
              <td style={{ ...tableCellStyle, padding: dense ? '10px 12px' : tableCellStyle.padding }}>{entry.name}</td>
              {!final && showTournamentColumns ? <td style={{ ...tableCellStyle, padding: dense ? '10px 12px' : tableCellStyle.padding }}>{entry.losses}/{maxLosses}</td> : null}
              {!final && showTournamentColumns ? <td style={{ ...tableCellStyle, padding: dense ? '10px 12px' : tableCellStyle.padding, color: entry.active ? colors.green : colors.orange }}>{getStatusText(entry, t)}</td> : null}
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

function TeamBox({ outcome = 'neutral', label }) {
  const isWinner = outcome === 'winner';
  const isLoser = outcome === 'loser';
  return (
    <div style={{
      padding: '18px 16px',
      borderRadius: 10,
      textAlign: 'center',
      fontWeight: 900,
      fontSize: 'clamp(1.1rem, 2.4vw, 1.6rem)',
      background: isWinner ? 'rgba(75, 209, 125, .18)' : isLoser ? 'rgba(73, 91, 104, .12)' : 'rgba(2, 8, 5, .34)',
      border: isWinner ? `1px solid ${colors.green}` : isLoser ? '1px solid rgba(112, 135, 151, .22)' : '1px solid rgba(255,255,255,.08)',
      opacity: isLoser ? .52 : 1
    }}>
      {isWinner ? '✓ ' : ''}{label}
    </div>
  );
}

function MatchCard({ match, t, compact }) {
  const winner = match.winner === 1 ? match.team1Label : match.winner === 2 ? match.team2Label : '';
  const laneText = Number.isFinite(Number(match.laneNumber))
    ? `${t.lane} ${match.laneNumber}${match.displayQueuePosition ? ` · ${t.queuePosition} ${match.displayQueuePosition}` : ''}`
    : t.waitingForLane;
  const statusText = match.queueStatus === 'current'
    ? t.laneCurrent
    : match.queueStatus === 'queued'
      ? t.laneQueued
      : match.queueStatus === 'completed'
        ? t.laneCompleted
        : t.waitingForLane;
  const completed = match.queueStatus === 'completed';
  const statusColor = match.queueStatus === 'current' ? colors.green : match.queueStatus === 'queued' ? colors.gold2 : completed ? '#9fb3c2' : colors.muted;
  const cardBorder = match.queueStatus === 'current'
    ? colors.green
    : match.queueStatus === 'queued'
      ? 'rgba(241, 189, 53, .58)'
      : completed
        ? 'rgba(112, 135, 151, .72)'
        : colors.border;

  return (
    <Card style={{
      padding: 18,
      borderColor: cardBorder,
      ...(completed ? { background: 'linear-gradient(145deg, rgba(31, 43, 49, .92), rgba(5, 13, 14, .98))' } : {}),
      ...(match.queueStatus === 'current' ? { boxShadow: '0 0 28px rgba(75, 209, 125, .1)' } : {})
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: statusColor, fontSize: compact ? 16 : 18, fontWeight: 900, letterSpacing: '.04em', lineHeight: 1.05, whiteSpace: 'nowrap', flexShrink: 0 }}>{statusText}</div>
        <span style={{ border: `1px solid ${completed ? 'rgba(112, 135, 151, .5)' : 'rgba(241, 189, 53, .38)'}`, color: completed ? '#b8c7d1' : colors.gold2, borderRadius: 999, padding: '7px 11px', fontSize: 13, lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 900 }}>{laneText}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr auto 1fr', gap: compact ? 8 : 14, alignItems: 'center' }}>
        <TeamBox outcome={completed ? (match.winner === 1 ? 'winner' : 'loser') : 'neutral'} label={match.team1Label} />
        <div style={{ color: colors.muted, fontWeight: 900, textAlign: 'center' }}>{t.vs}</div>
        <TeamBox outcome={completed ? (match.winner === 2 ? 'winner' : 'loser') : 'neutral'} label={match.team2Label} />
      </div>
      {winner ? <div style={{ color: colors.green, marginTop: 14, fontWeight: 900 }}>✓ {t.winner}: {winner}</div> : null}
    </Card>
  );
}

function AnnouncementBanner({ message, t, compact }) {
  if (!message) return null;
  return (
    <Card style={{
      padding: compact ? 16 : 22,
      borderColor: 'rgba(241, 189, 53, .58)',
      background: 'linear-gradient(135deg, rgba(241, 189, 53, .18), rgba(5, 43, 27, .94))',
      marginBottom: compact ? 12 : 16
    }}>
      <div style={{ color: colors.gold2, fontSize: 12, fontWeight: 900, letterSpacing: '.1em' }}>{t.announcement}</div>
      <div style={{ marginTop: 7, fontSize: compact ? 20 : 28, fontWeight: 900, lineHeight: 1.15, overflowWrap: 'anywhere' }}>{message}</div>
    </Card>
  );
}

function LaneOverview({ screenState, matches, selectedLanes, t, compact }) {
  const selected = Array.isArray(selectedLanes) && selectedLanes.length
    ? [...selectedLanes].sort((a, b) => a - b)
    : Array.from({ length: Math.max(1, Number(screenState.laneCount) || 1) }, (_, index) => index + 1);
  const activeLanes = new Set(Array.isArray(screenState.activeLanes) ? screenState.activeLanes.map(Number) : selected);
  const matchesByLane = new Map();
  (matches || []).forEach(match => {
    const lane = Number(match.laneNumber);
    if (!Number.isInteger(lane)) return;
    const queue = matchesByLane.get(lane) || [];
    queue.push(match);
    matchesByLane.set(lane, queue);
  });
  matchesByLane.forEach(queue => queue.sort((left, right) => (Number(left.lanePosition) || 999) - (Number(right.lanePosition) || 999) || left.id - right.id));

  return (
    <Card style={{ padding: compact ? 16 : 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.compactLaneOverview}</div>
          <h2 style={{ margin: '7px 0 0', fontSize: compact ? 22 : 28, letterSpacing: '.04em' }}>{screenState.laneCount || selected.length} {t.lanes}</h2>
        </div>
        <strong style={{ color: colors.gold2 }}>{t.round} {screenState.currentRound || 0}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        {selected.map(lane => {
          const queue = matchesByLane.get(Number(lane)) || [];
          const match = queue.find(item => item.queueStatus === 'current');
          const nextMatch = queue.find(item => item.queueStatus === 'queued');
          const completedMatch = [...queue].reverse().find(item => item.queueStatus === 'completed');
          const active = activeLanes.has(Number(lane));
          return (
            <div
              key={lane}
              style={{
                border: `1px solid ${active ? colors.border : 'rgba(242, 132, 76, .54)'}`,
                borderRadius: 12,
                background: active ? 'rgba(5, 43, 27, .78)' : 'rgba(242, 132, 76, .08)',
                padding: 16,
                minHeight: compact ? 120 : 154
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <strong style={{ fontSize: 19 }}>{t.lane} {lane}</strong>
                <span style={{ color: active ? colors.green : colors.orange, fontWeight: 900, fontSize: 13 }}>{active ? t.activeLane : t.inactiveLane}</span>
              </div>
              {match ? (
                <div style={{ marginTop: 13, display: 'grid', gap: 6, fontWeight: 900 }}>
                  <span style={{ color: colors.green, fontSize: 12 }}>{t.laneCurrent}</span>
                  <span>{match.team1Label}</span>
                  <span style={{ color: colors.muted, fontSize: 13 }}>{t.vs}</span>
                  <span>{match.team2Label}</span>
                </div>
              ) : (
                <div style={{ marginTop: 16, color: colors.muted, fontWeight: 900 }}>{active ? t.noMatch : t.waitingForLane}</div>
              )}
              {nextMatch ? (
                <div style={{ marginTop: 14, borderTop: '1px solid rgba(241, 189, 53, .26)', paddingTop: 11, display: 'grid', gap: 4 }}>
                  <span style={{ color: colors.gold2, fontSize: 12, fontWeight: 900 }}>{t.laneQueued}</span>
                  <strong style={{ fontSize: 14 }}>{nextMatch.team1Label} {t.vs} {nextMatch.team2Label}</strong>
                </div>
              ) : null}
              {completedMatch ? (
                <div style={{ marginTop: 14, border: '1px solid rgba(112, 135, 151, .38)', borderRadius: 8, background: 'rgba(66, 82, 92, .16)', padding: 10, display: 'grid', gap: 4 }}>
                  <span style={{ color: '#9fb3c2', fontSize: 12, fontWeight: 900 }}>{t.laneCompleted}</span>
                  <strong style={{ color: colors.green, fontSize: 14 }}>✓ {t.winner}: {completedMatch.winner === 1 ? completedMatch.team1Label : completedMatch.team2Label}</strong>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function ScreenPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const params = useParams();
  const searchParams = useSearchParams();
  const rawToken = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const token = decodeURIComponent(rawToken || '');
  const screenKey = searchParams.get('view') === 'screen2' ? 'screen2' : 'screen1';

  const [lang, setLang] = useState('da');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [screenMeta, setScreenMeta] = useState(null);
  const [tournamentState, setTournamentState] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [clockTick, setClockTick] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const [connectionState, setConnectionState] = useState('connecting');
  const [lastFetchMs, setLastFetchMs] = useState(0);
  const [rotatingViewIndex, setRotatingViewIndex] = useState(0);
  const [headerHidden, setHeaderHidden] = useState(false);

  const t = texts[lang] || texts.da;
  const screenState = useMemo(() => buildScreenState(tournamentState), [tournamentState, clockTick]);
  const screenConfig = useMemo(() => getScreenConfig(screenState, screenKey), [screenState, screenKey]);
  const filteredMatches = useMemo(() => {
    const lanes = Array.isArray(screenConfig.lanes) ? screenConfig.lanes : [];
    if (screenConfig.mode !== 'lanes' || lanes.length === 0) return screenState.matches;
    return screenState.matches.filter(match => lanes.includes(Number(match.laneNumber)));
  }, [screenConfig, screenState.matches]);
  const orderedMatches = useMemo(() => {
    const priority = { current: 0, queued: 1, unassigned: 2, completed: 3 };
    return [...filteredMatches].sort((left, right) => (
      (priority[left.queueStatus] ?? 2) - (priority[right.queueStatus] ?? 2)
      || (Number(left.laneNumber) || 999) - (Number(right.laneNumber) || 999)
      || (Number(left.lanePosition) || 999) - (Number(right.lanePosition) || 999)
      || left.id - right.id
    ));
  }, [filteredMatches]);
  const rotatingViews = useMemo(() => getRotatingViews(screenState), [screenState]);
  const rotatingView = rotatingViews[rotatingViewIndex % Math.max(1, rotatingViews.length)] || 'info';
  const contentView = getModeContentView(screenConfig.mode, screenState, rotatingView);
  const compact = viewportWidth < 900;
  const phone = viewportWidth < 620;
  const themeStyles = getThemeStyles(screenConfig.theme);
  const hideHeader = screenConfig.hideHeader || headerHidden;

  const loadScreen = useCallback(async ({ silent = false } = {}) => {
    if (!token) {
      setError('Missing token');
      setLoading(false);
      setConnectionState('stale');
      return;
    }

    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const response = await fetch(`/api/tournament-screen/public?token=${encodeURIComponent(token)}`, {
        cache: 'no-store'
      });
      const payload = await response.json();

      if (!response.ok) {
        if (!silent) setError(payload?.error || 'Screen error');
        setConnectionState('stale');
        setLoading(false);
        return;
      }

      setScreenMeta(previous => {
        if (
          previous?.realtimeChannel === payload?.realtimeChannel
          && previous?.screenUrl === payload?.screenUrl
          && previous?.token === payload?.token
        ) {
          return previous;
        }
        return payload;
      });
      setTournamentState(payload.state || null);
      setUpdatedAt(payload.updatedAt || null);
      setLastFetchMs(Date.now());
      setConnectionState(previous => previous === 'live' ? 'live' : 'polling');
      setLoading(false);
      setError('');
    } catch (_error) {
      if (!silent) setError('Failed to load spectator screen');
      setConnectionState('stale');
      setLoading(false);
    }
  }, [token]);

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
    if (typeof window === 'undefined') return undefined;
    const updateWidth = () => setViewportWidth(window.innerWidth || 1280);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    loadScreen();
  }, [loadScreen]);

  useEffect(() => {
    if (!token || typeof window === 'undefined') return undefined;
    const intervalId = window.setInterval(() => {
      loadScreen({ silent: true });
    }, 8000);
    return () => window.clearInterval(intervalId);
  }, [loadScreen, token]);

  useEffect(() => {
    const realtimeChannel = screenMeta?.realtimeChannel;
    if (!supabase || !realtimeChannel) return undefined;

    const channel = supabase
      .channel(realtimeChannel, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'tournament-state' }, ({ payload }) => {
        if (!payload?.state) return;
        setTournamentState(payload.state);
        setUpdatedAt(payload.updatedAt || new Date().toISOString());
        setLastFetchMs(Date.now());
        setConnectionState('live');
      });

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        setConnectionState('live');
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnectionState(previous => previous === 'stale' ? 'stale' : 'polling');
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [screenMeta?.realtimeChannel, supabase]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const intervalId = window.setInterval(() => {
      if (lastFetchMs && Date.now() - lastFetchMs > 22000) {
        setConnectionState('stale');
      }
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [lastFetchMs]);

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

  useEffect(() => {
    setRotatingViewIndex(0);
  }, [screenConfig.mode, screenKey, screenState.phase, screenState.currentRound, rotatingViews.length]);

  useEffect(() => {
    if (screenConfig.mode !== 'rotating' || rotatingViews.length <= 1 || typeof window === 'undefined') return undefined;
    const intervalId = window.setInterval(() => {
      setRotatingViewIndex(current => (current + 1) % rotatingViews.length);
    }, screenConfig.rotationSeconds * 1000);
    return () => window.clearInterval(intervalId);
  }, [screenConfig.mode, screenConfig.rotationSeconds, rotatingViews.length]);

  useEffect(() => {
    setHeaderHidden(false);
    if (!screenConfig.autoHideHeader || screenConfig.hideHeader || typeof window === 'undefined') return undefined;
    const timeoutId = window.setTimeout(() => setHeaderHidden(true), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [screenConfig.autoHideHeader, screenConfig.hideHeader, contentView, updatedAt, screenKey]);

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
  const showQrCode = Boolean(qrSrc) && screenConfig.showQr && (contentView === 'info' || screenState.phase === 'waiting' || screenState.phase === 'registration');
  const activeListSize = contentView === 'round'
    ? filteredMatches.length
    : contentView === 'lanes'
      ? Math.max(screenState.laneCount || 0, filteredMatches.length)
    : contentView === 'final'
      ? screenState.finalPlacements.length
      : screenState.standings.length;
  const pageSize = contentView === 'round' ? screenConfig.matchesPerPage : screenConfig.rowsPerPage;
  const denseDisplay = !compact && (
    activeListSize > pageSize
    || (contentView === 'round' && pageSize > getPageSize('round', viewportWidth))
  );
  const pageResetKey = [
    contentView,
    screenConfig.mode,
    screenKey,
    screenState.currentRound,
    updatedAt,
    activeListSize,
    screenState.spectatorOverride?.active ? 'override' : 'normal'
  ].join('|');
  const connectionLabel = connectionState === 'live'
    ? t.live
    : connectionState === 'stale'
      ? t.stale
      : connectionState === 'polling'
        ? t.polling
        : t.reconnecting;
  const connectionColor = connectionState === 'live' ? colors.green : connectionState === 'stale' ? colors.orange : colors.gold2;

  return (
    <main style={{ ...pageStyle, ...themeStyles.page }}>
      {!hideHeader ? <header style={{
        minHeight: compact ? 0 : denseDisplay ? 66 : 88,
        display: 'flex',
        flexWrap: compact ? 'wrap' : 'nowrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: compact ? 14 : 24,
        padding: compact ? '14px 18px' : denseDisplay ? '5px 34px' : '0 44px',
        borderBottom: `1px solid ${themeStyles.accent}`,
        background: themeStyles.header
      }}>
        <Brand />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : 'flex-end', width: compact ? '100%' : 'auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, border: `1px solid ${colors.border}`, borderRadius: 999, background: 'rgba(5, 43, 27, .82)', padding: compact ? '7px 10px' : '9px 14px', color: colors.soft, fontSize: phone ? 11 : 13, fontWeight: 900, maxWidth: '100%' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: connectionColor, boxShadow: `0 0 16px ${connectionColor}88` }} />
            {connectionLabel} · {t.updated}: {formatUpdatedAt(updatedAt, lang)}
          </div>
          <FlagButton active={lang === 'da'} label="Dansk" src="https://flagcdn.com/w40/dk.png" onClick={() => setLang('da')} />
          <FlagButton active={lang === 'en'} label="English" src="https://flagcdn.com/w40/gb.png" onClick={() => setLang('en')} />
        </div>
      </header> : null}

      <section style={{
        minHeight: compact ? 0 : denseDisplay ? 160 : 238,
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) 350px',
        gap: compact ? 14 : 28,
        alignItems: 'start',
        padding: compact ? '16px 18px 18px' : denseDisplay ? '18px 34px 20px' : '28px 34px 34px',
        borderBottom: '1px solid #1c5a41',
        background: 'linear-gradient(90deg, rgba(3, 8, 6, .64), rgba(3, 8, 6, .08) 45%, rgba(3, 8, 6, .7)), url(/assets/showdart-banner.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 43%'
      }}>
        <Card style={{ padding: compact ? 18 : denseDisplay ? 20 : 28, maxWidth: compact ? 'none' : 680, minHeight: compact ? 0 : denseDisplay ? 122 : 174 }}>
          <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{modeLabel}</div>
          <h1 style={{ margin: '10px 0 0', fontSize: phone ? '1.65rem' : compact ? '2.25rem' : denseDisplay ? 'clamp(1.8rem, 2.9vw, 2.7rem)' : 'clamp(2.2rem, 3.8vw, 3.9rem)', lineHeight: 1.02, letterSpacing: compact ? '.035em' : '.05em', overflowWrap: 'anywhere' }}>{displayTitle}</h1>
          <div style={{ display: 'flex', gap: compact ? 10 : 18, flexWrap: 'wrap', marginTop: compact ? 14 : denseDisplay ? 14 : 22, color: colors.soft, fontSize: compact ? 13 : 15, fontWeight: 800 }}>
            <span>{screenState.entries.length} {t.participants}</span>
            {screenState.started ? <span>{t.round} {screenState.currentRound || 0}</span> : <span>{screenState.laneCount || 0} {t.lanes}</span>}
            <span>{screenState.maxLosses} {t.losses}</span>
          </div>
        </Card>

        {showQrCode ? (
          <Card style={{ padding: compact ? 14 : denseDisplay ? 12 : 18, textAlign: 'center' }}>
            <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.scanQr}</div>
            <img src={qrSrc} alt={t.scanQr} style={{ width: phone ? 128 : compact ? 150 : denseDisplay ? 128 : 180, maxWidth: '100%', height: 'auto', background: '#fff', borderRadius: 8, padding: 8, margin: denseDisplay ? '8px auto' : '12px auto', display: 'block' }} />
            <div style={{ color: colors.soft, fontSize: 13 }}>{t.scanQrHint}</div>
          </Card>
        ) : (
          <Card style={{ padding: 22 }}>
            <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.status}</div>
            <h2 style={{ margin: '7px 0 0', fontSize: 26, letterSpacing: '.04em' }}>
              {contentView === 'round' ? t.roundLive : contentView === 'final' ? t.finalResults : contentView === 'info' ? t.status : t.standings}
            </h2>
          </Card>
        )}
      </section>

      <section style={{ padding: compact ? '14px 18px 18px' : denseDisplay ? '14px 34px 76px' : '18px 34px 110px' }}>
        <AnnouncementBanner message={screenConfig.announcement} t={t} compact={compact} />

        {contentView === 'info' || contentView === 'waiting' ? (
          <Card style={{ padding: 22, maxWidth: 980 }}>
            <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{modeLabel}</div>
            <h2 style={{ margin: '7px 0 0', fontSize: 26, letterSpacing: '.04em' }}>{displayTitle}</h2>
            <p style={{ color: colors.soft, textTransform: 'none', lineHeight: 1.55 }}>
              {screenState.entries.length} {t.participants} · {screenState.laneCount || 0} {t.lanes} · {screenState.maxLosses} {t.losses}
            </p>
          </Card>
        ) : null}

        {contentView === 'registration' ? (
          <Card style={{ padding: 22 }}>
            <PagedDisplay items={screenState.standings} pageSize={pageSize} resetKey={pageResetKey} t={t} intervalMs={screenConfig.rotationSeconds * 1000}>
              {({ visibleItems, startIndex, indicator }) => (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.tournamentNotStarted}</div>
                      <h2 style={{ margin: '7px 0 0', fontSize: denseDisplay ? 22 : 26, letterSpacing: '.04em' }}>{t.registrationOpen}</h2>
                    </div>
                    {indicator}
                  </div>
                  <StandingsTable entries={visibleItems} t={t} entryLabel={entryLabel} maxLosses={screenState.maxLosses} showTournamentColumns={false} startIndex={startIndex} dense={denseDisplay} />
                </>
              )}
            </PagedDisplay>
          </Card>
        ) : null}

        {contentView === 'standings' ? (
          <Card style={{ padding: 22 }}>
            <PagedDisplay items={screenState.standings} pageSize={pageSize} resetKey={pageResetKey} t={t} intervalMs={screenConfig.rotationSeconds * 1000}>
              {({ visibleItems, startIndex, indicator }) => (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{screenState.spectatorOverride?.active ? t.temporaryStandings : t.betweenRounds}</div>
                      <h2 style={{ margin: '7px 0 0', fontSize: denseDisplay ? 22 : 26, letterSpacing: '.04em' }}>{t.standings}</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {indicator}
                      <strong style={{ fontSize: denseDisplay ? 18 : 22 }}>{t.round} {screenState.currentRound}</strong>
                    </div>
                  </div>
                  {screenState.spectatorOverride?.active ? (
                    <div style={{ marginBottom: denseDisplay ? 12 : 18 }}>
                      <div style={{ color: colors.soft, marginBottom: 8, fontSize: 13 }}>{t.temporaryStandingsHint}</div>
                      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, screenState.spectatorOverride.progress * 100))}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${colors.gold2} 0%, ${colors.green} 100%)`, transition: 'width 240ms linear' }} />
                      </div>
                    </div>
                  ) : null}
                  <StandingsTable entries={visibleItems} t={t} entryLabel={entryLabel} maxLosses={screenState.maxLosses} startIndex={startIndex} dense={denseDisplay} />
                </>
              )}
            </PagedDisplay>
          </Card>
        ) : null}

        {contentView === 'round' ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <Card style={{ padding: 22 }}>
              <PagedDisplay items={orderedMatches} pageSize={pageSize} resetKey={pageResetKey} t={t} intervalMs={screenConfig.rotationSeconds * 1000}>
                {({ indicator }) => (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.roundLive}</div>
                      <h2 style={{ margin: '7px 0 0', fontSize: denseDisplay ? 22 : 26, letterSpacing: '.04em' }}>{t.round} {screenState.currentRound} · {filteredMatches.length} {t.matches}</h2>
                    </div>
                    {indicator}
                  </div>
                )}
              </PagedDisplay>
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

            <PagedDisplay items={orderedMatches} pageSize={pageSize} resetKey={pageResetKey} t={t} intervalMs={screenConfig.rotationSeconds * 1000}>
              {({ visibleItems }) => (
                <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(310px, 1fr))', gap: compact ? 10 : 14 }}>
                  {visibleItems.map(match => <MatchCard key={match.id} match={match} t={t} compact={compact} />)}
                </div>
              )}
            </PagedDisplay>
          </div>
        ) : null}

        {contentView === 'lanes' ? (
          <LaneOverview screenState={screenState} matches={filteredMatches} selectedLanes={screenConfig.lanes} t={t} compact={compact} />
        ) : null}

        {contentView === 'final' ? (
          <Card style={{ padding: 22 }}>
            <PagedDisplay items={screenState.finalPlacements} pageSize={pageSize} resetKey={pageResetKey} t={t} intervalMs={screenConfig.rotationSeconds * 1000}>
              {({ visibleItems, startIndex, indicator }) => (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: colors.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{t.finalResults}</div>
                      <h2 style={{ margin: '7px 0 0', fontSize: denseDisplay ? 22 : 26, letterSpacing: '.04em' }}>{displayTitle}</h2>
                    </div>
                    {indicator}
                  </div>
                  <StandingsTable entries={visibleItems} t={t} entryLabel={entryLabel} maxLosses={screenState.maxLosses} final startIndex={startIndex} dense={denseDisplay} />
                </>
              )}
            </PagedDisplay>
          </Card>
        ) : null}
      </section>

      <StatusBar t={t} screenState={screenState} updatedAt={updatedAt} lang={lang} compact={compact} dense={denseDisplay} />
    </main>
  );
}
