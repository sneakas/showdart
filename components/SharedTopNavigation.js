'use client';

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
  bg: '#07120d',
  bgGlass: 'rgba(7, 18, 13, 0.9)',
  surface: '#101f19',
  surface2: '#14271f',
  border: '#29463a',
  borderStrong: '#4f755f',
  text: '#f1f7f0',
  textSoft: '#d6e6dc',
  textMuted: '#94ad9e',
  gold: '#d6b84d',
  goldSoft: '#f1d56d',
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

  const navButtonStyle = isActive => ({
    color: isActive ? '#11170f' : theme.textSoft,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderRadius: 7,
    padding: '0.62rem 0.9rem',
    border: isActive ? `1px solid ${theme.goldSoft}` : '1px solid transparent',
    background: isActive ? `linear-gradient(135deg, ${theme.gold}, ${theme.goldSoft})` : 'transparent',
    boxShadow: isActive ? '0 10px 22px rgba(214, 184, 77, 0.18)' : 'none',
    textDecoration: 'none',
    cursor: 'pointer',
    lineHeight: 1.15,
    whiteSpace: 'nowrap'
  });

  const navItem = (key, label) => (
    <button
      key={key}
      type="button"
      onClick={() => onNavigate?.(key)}
      style={navButtonStyle(activePage === key)}
    >
      {label}
    </button>
  );

  return (
    <>
      <div style={{ background: theme.bgGlass, borderBottom: `1px solid ${theme.border}`, color: theme.text, backdropFilter: 'blur(14px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '9px 16px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ color: theme.textSoft, fontSize: 14 }}>
            {t.loggedInAs} <strong>{email || '-'}</strong> ({role || 'user'})
          </div>
          <button onClick={onLogout} style={{ padding: '8px 12px', borderRadius: 7, border: `1px solid ${theme.danger}`, background: theme.danger, color: '#fff', fontWeight: 800, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {t.logout}
          </button>
        </div>
      </div>

      <div style={{ background: 'linear-gradient(90deg, rgba(9, 20, 14, 0.98), rgba(15, 35, 27, 0.98))', borderBottom: `1px solid ${theme.border}`, boxShadow: '0 10px 28px rgba(0,0,0,0.22)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '11px 16px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {navItem('registration', t.registration)}
            {navItem('tournament', t.tournament)}
            {showRules ? navItem('rules', t.rules) : null}
            {isAdmin ? navItem('admin', t.admin) : null}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => onLanguageChange?.('da')}
              title="Dansk"
              aria-label="Skift sprog til dansk"
              style={{ width: 40, height: 30, borderRadius: 6, border: lang === 'da' ? `2px solid ${theme.gold}` : `1px solid ${theme.borderStrong}`, backgroundImage: "url('https://flagcdn.com/w40/dk.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: theme.surface, padding: 0, boxShadow: lang === 'da' ? '0 0 0 2px rgba(214,184,77,0.15)' : 'none' }}
            />
            <button
              type="button"
              onClick={() => onLanguageChange?.('en')}
              title="English"
              aria-label="Switch language to English"
              style={{ width: 40, height: 30, borderRadius: 6, border: lang === 'en' ? `2px solid ${theme.gold}` : `1px solid ${theme.borderStrong}`, backgroundImage: "url('https://flagcdn.com/w40/gb.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: theme.surface, padding: 0, boxShadow: lang === 'en' ? '0 0 0 2px rgba(214,184,77,0.15)' : 'none' }}
            />
          </div>
        </div>
      </div>

      {showHero ? (
        <div
          style={{
            backgroundImage:
              "linear-gradient(115deg, rgba(5, 12, 8, 0.94) 0%, rgba(8, 18, 13, 0.62) 48%, rgba(5, 12, 8, 0.92) 100%), url('https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=1400&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: '#f4efe1',
            padding: '3.75rem 0',
            marginBottom: '1.35rem',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            borderBottom: `1px solid ${theme.border}`,
            boxShadow: 'inset 0 -80px 110px rgba(0,0,0,0.45)'
          }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.85rem, 4.6vw, 3.05rem)', lineHeight: 1.02, textTransform: 'uppercase', letterSpacing: '0.04em', textShadow: '0 12px 32px rgba(0,0,0,0.55)' }}>
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


