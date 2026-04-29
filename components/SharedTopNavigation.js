'use client';

import { ClipboardList, ShieldCheck, Trophy, UsersRound } from 'lucide-react';

const headerTexts = {
  da: {
    loggedInAs: 'Logget ind som',
    logout: 'Log ud',
    siteTitle: 'Showdart Turnerings Organisator',
    registration: 'Registrering',
    tournament: 'Turnering',
    rules: 'Regler',
    admin: 'Admin'
  },
  en: {
    loggedInAs: 'Logged in as',
    logout: 'Logout',
    siteTitle: 'Showdart Tournament Organizer',
    registration: 'Registration',
    tournament: 'Tournament',
    rules: 'Rules',
    admin: 'Admin'
  }
};

const theme = {
  bg: '#030806',
  bgGlass: 'rgba(3, 8, 6, 0.96)',
  surface: '#07140f',
  surface2: '#0d241a',
  border: '#244438',
  borderStrong: '#3b6a55',
  text: '#f6f6ed',
  textSoft: '#dfe8de',
  textMuted: '#a7b7ad',
  gold: '#d8a928',
  goldSoft: '#f0c24b',
  danger: '#9b3f3f'
};

export function SharedTopNavigation({
  lang,
  role,
  email,
  showRules,
  showHero = true,
  activePage,
  onLanguageChange,
  onLogout,
  onNavigate
}) {
  const t = headerTexts[lang] || headerTexts.da;
  const isAdmin = role === 'admin';
  const navIcons = {
    registration: ClipboardList,
    tournament: Trophy,
    admin: UsersRound,
    rules: ShieldCheck
  };

  const navButtonStyle = isActive => ({
    color: isActive ? theme.goldSoft : theme.textSoft,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderRadius: 0,
    padding: '1.15rem 0.8rem 1rem',
    border: 0,
    borderBottom: isActive ? `4px solid ${theme.goldSoft}` : '4px solid transparent',
    background: 'transparent',
    boxShadow: 'none',
    textDecoration: 'none',
    cursor: 'pointer',
    lineHeight: 1.15,
    whiteSpace: 'nowrap'
  });

  const navItem = (key, label) => {
    const Icon = navIcons[key];
    return (
    <button
      key={key}
      type="button"
      onClick={() => onNavigate?.(key)}
      style={navButtonStyle(activePage === key)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {Icon ? <Icon size={20} strokeWidth={1.8} /> : null}
        {label}
      </span>
    </button>
    );
  };

  return (
    <>
      <div style={{ background: 'linear-gradient(90deg, #020604, #06150f 42%, #03100b)', borderBottom: `1px solid ${theme.gold}`, color: theme.text, boxShadow: '0 14px 36px rgba(0,0,0,0.45)' }}>
        <div style={{ maxWidth: 1520, margin: '0 auto', minHeight: 90, padding: '0 28px', display: 'grid', gridTemplateColumns: '280px minmax(360px, 1fr) 310px', gap: 18, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              aria-hidden="true"
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                border: `2px solid ${theme.goldSoft}`,
                background: `radial-gradient(circle, #0b1912 0 20%, transparent 21%), conic-gradient(${theme.goldSoft} 0 12deg, #111 12deg 24deg, ${theme.goldSoft} 24deg 36deg, #111 36deg 48deg, ${theme.goldSoft} 48deg 60deg, #111 60deg 72deg, ${theme.goldSoft} 72deg 84deg, #111 84deg 96deg, ${theme.goldSoft} 96deg 108deg, #111 108deg 120deg, ${theme.goldSoft} 120deg 132deg, #111 132deg 144deg, ${theme.goldSoft} 144deg 156deg, #111 156deg 168deg, ${theme.goldSoft} 168deg 180deg, #111 180deg 192deg, ${theme.goldSoft} 192deg 204deg, #111 204deg 216deg, ${theme.goldSoft} 216deg 228deg, #111 228deg 240deg, ${theme.goldSoft} 240deg 252deg, #111 252deg 264deg, ${theme.goldSoft} 264deg 276deg, #111 276deg 288deg, ${theme.goldSoft} 288deg 300deg, #111 300deg 312deg, ${theme.goldSoft} 312deg 324deg, #111 324deg 336deg, ${theme.goldSoft} 336deg 348deg, #111 348deg 360deg)`,
                boxShadow: '0 0 24px rgba(216,169,40,0.24)'
              }}
            />
            <div>
              <div style={{ color: theme.text, fontSize: 28, fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.01em' }}>Showdart</div>
              <div style={{ color: theme.goldSoft, fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.34em', marginTop: 6 }}>Turnering</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 34, alignItems: 'stretch', flexWrap: 'wrap', minHeight: 90 }}>
            {navItem('registration', t.registration)}
            {navItem('tournament', t.tournament)}
            {isAdmin ? navItem('admin', t.admin) : null}
            {showRules ? navItem('rules', t.rules) : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ color: theme.textMuted, fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email || '-'} ({role || 'user'})
            </div>
            <button
              type="button"
              onClick={() => onLanguageChange?.('da')}
              title="Dansk"
              aria-label="Skift sprog til dansk"
              style={{ width: 34, height: 24, borderRadius: 3, border: lang === 'da' ? `2px solid ${theme.gold}` : `1px solid ${theme.borderStrong}`, backgroundImage: "url('https://flagcdn.com/w40/dk.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: theme.surface, padding: 0, boxShadow: lang === 'da' ? '0 0 0 2px rgba(214,184,77,0.15)' : 'none' }}
            />
            <button
              type="button"
              onClick={() => onLanguageChange?.('en')}
              title="English"
              aria-label="Switch language to English"
              style={{ width: 34, height: 24, borderRadius: 3, border: lang === 'en' ? `2px solid ${theme.gold}` : `1px solid ${theme.borderStrong}`, backgroundImage: "url('https://flagcdn.com/w40/gb.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: theme.surface, padding: 0, boxShadow: lang === 'en' ? '0 0 0 2px rgba(214,184,77,0.15)' : 'none' }}
            />
            <button onClick={onLogout} style={{ padding: '8px 11px', borderRadius: 6, border: `1px solid ${theme.danger}`, background: theme.danger, color: '#fff', fontWeight: 800, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t.logout}
            </button>
          </div>
        </div>
      </div>

      {showHero ? (
        <div
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(3, 8, 6, 0.82) 0%, rgba(3, 8, 6, 0.34) 45%, rgba(3, 8, 6, 0.88) 100%), url('https://source.unsplash.com/0M9ceArxHdA/1800x420')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: '#f4efe1',
            padding: '1.15rem 0',
            marginBottom: 0,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            borderBottom: `1px solid ${theme.border}`,
            boxShadow: 'inset 0 -90px 120px rgba(0,0,0,0.52)',
            minHeight: 190
          }}
        >
          <div style={{ maxWidth: 1520, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', minHeight: 170 }}>
            <h1 style={{ margin: 0, maxWidth: 480, fontSize: 'clamp(1.7rem, 3.5vw, 2.45rem)', lineHeight: 1.02, textTransform: 'uppercase', letterSpacing: '0.04em', textShadow: '0 12px 32px rgba(0,0,0,0.72)' }}>
              {t.siteTitle}
            </h1>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function getHeaderTexts(lang) {
  return headerTexts[lang] || headerTexts.da;
}


