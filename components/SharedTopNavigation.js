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
  showHero = true,
  activePage,
  onLanguageChange,
  onLogout,
  onNavigate
}) {
  const t = headerTexts[lang] || headerTexts.da;
  const isAdmin = role === 'admin';

  const navButtonStyle = isActive => ({
    color: isActive ? '#f2d14c' : '#b6cec1',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderRadius: 8,
    padding: '0.55rem 0.8rem',
    border: '1px solid transparent',
    background: isActive ? '#1a3b30' : 'transparent',
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
      <div style={{ background: 'rgba(11, 30, 22, 0.92)', borderBottom: '1px solid #355748', color: '#ecf8f2' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ color: '#d9ece2' }}>
            {t.loggedInAs} <strong>{email || '-'}</strong> ({role || 'user'})
          </div>
          <button onClick={onLogout} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #a64a4a', background: '#a64a4a', color: '#fff', fontWeight: 700, lineHeight: 1 }}>
            {t.logout}
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(11, 30, 22, 0.92)', borderBottom: '1px solid #355748' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ color: '#ecf8f2', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{t.siteTitle}</div>
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
              style={{ width: 40, height: 30, borderRadius: 6, border: lang === 'da' ? '2px solid #f2d14c' : '1px solid #3e6353', backgroundImage: "url('https://flagcdn.com/w40/dk.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#10271e', padding: 0 }}
            />
            <button
              type="button"
              onClick={() => onLanguageChange?.('en')}
              title="English"
              style={{ width: 40, height: 30, borderRadius: 6, border: lang === 'en' ? '2px solid #f2d14c' : '1px solid #3e6353', backgroundImage: "url('https://flagcdn.com/w40/gb.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#10271e', padding: 0 }}
            />
          </div>
        </div>
      </div>

      {showHero ? (
        <div
          style={{
            backgroundImage:
              "linear-gradient(115deg, rgba(9, 21, 15, 0.92) 0%, rgba(9, 21, 15, 0.66) 45%, rgba(9, 21, 15, 0.86) 100%), url('https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=1400&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: '#f4efe1',
            padding: '3.25rem 0',
            marginBottom: '1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            borderBottom: '1px solid #355748',
            boxShadow: 'inset 0 -60px 80px rgba(0,0,0,0.35)'
          }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.7rem, 4.4vw, 2.55rem)', lineHeight: 1.05, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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

