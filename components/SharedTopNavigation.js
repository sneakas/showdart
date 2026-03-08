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

export function SharedTopNavigation({
  lang,
  role,
  email,
  showRules,
  activePage,
  onLanguageChange,
  onLogout,
  onNavigate
}) {
  const t = headerTexts[lang] || headerTexts.da;

  const navButtonStyle = {
    color: '#ecf8f2',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderRadius: 8,
    padding: '0.55rem 0.8rem',
    border: '1px solid #3e6353',
    background: '#1a3b30',
    textDecoration: 'none',
    cursor: 'pointer'
  };

  const activeNavStyle = {
    ...navButtonStyle,
    color: '#f2d14c'
  };

  const navItem = (key, label) => (
    <button
      key={key}
      type="button"
      onClick={() => onNavigate?.(key)}
      style={activePage === key ? activeNavStyle : navButtonStyle}
    >
      {label}
    </button>
  );

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #355748', background: '#10271e', color: '#ecf8f2' }}>
        <div>
          {t.loggedInAs} <strong>{email || '-'}</strong> ({role || 'user'})
        </div>
        <button onClick={onLogout} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #a64a4a', background: '#a64a4a', color: '#fff' }}>
          {t.logout}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #355748', background: '#10271e' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: '#ecf8f2', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.siteTitle}</div>
          {navItem('registration', t.registration)}
          {navItem('tournament', t.tournament)}
          {showRules ? navItem('rules', t.rules) : null}
          {navItem('admin', t.admin)}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => onLanguageChange?.('da')} title="Dansk" style={{ width: 36, height: 36, borderRadius: 999, border: lang === 'da' ? '2px solid #f2d14c' : '1px solid #355748', background: '#10271e', color: '#fff', fontSize: 18, lineHeight: 1 }}>{'\uD83C\uDDE9\uD83C\uDDF0'}</button>
          <button type="button" onClick={() => onLanguageChange?.('en')} title="English" style={{ width: 36, height: 36, borderRadius: 999, border: lang === 'en' ? '2px solid #f2d14c' : '1px solid #355748', background: '#10271e', color: '#fff', fontSize: 18, lineHeight: 1 }}>{'\uD83C\uDDEC\uD83C\uDDE7'}</button>
        </div>
      </div>
    </>
  );
}

export function getHeaderTexts(lang) {
  return headerTexts[lang] || headerTexts.da;
}
