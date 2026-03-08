'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';

const LANGUAGE_STORAGE_KEY = 'showdart-language';

const texts = {
  da: {
    loading: 'Indlæser...',
    title: 'Admin',
    subtitle: 'Administrer konti',
    notLoggedIn: 'Du skal være logget ind for at bruge adminsiden.',
    notAdmin: 'Du har ikke admin-adgang.',
    back: 'Tilbage til turnering',
    email: 'E-mail',
    password: 'Adgangskode (min 8 tegn)',
    displayName: 'Vist navn (valgfri)',
    create: 'Opret konto',
    creating: 'Opretter...',
    needFields: 'E-mail og adgangskode er påkrævet.',
    missingToken: 'Session mangler. Log ind igen.',
    user: 'Bruger',
    admin: 'Admin',
    logout: 'Log ud',
    loggedInAs: 'Logget ind som'
  },
  en: {
    loading: 'Loading...',
    title: 'Admin',
    subtitle: 'Manage accounts',
    notLoggedIn: 'You must be logged in to use the admin page.',
    notAdmin: 'You do not have admin access.',
    back: 'Back to tournament',
    email: 'Email',
    password: 'Password (min 8 chars)',
    displayName: 'Display name (optional)',
    create: 'Create account',
    creating: 'Creating...',
    needFields: 'Email and password are required.',
    missingToken: 'Session missing. Please log in again.',
    user: 'User',
    admin: 'Admin',
    logout: 'Logout',
    loggedInAs: 'Logged in as'
  }
};

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'da';
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'da' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('da') ? 'da' : 'en';
}

export default function AdminPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [lang, setLang] = useState('da');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState('user');
  const [profileEmail, setProfileEmail] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newRole, setNewRole] = useState('user');

  const t = texts[lang];

  useEffect(() => {
    const initialLang = getInitialLanguage();
    setLang(initialLang);
  }, []);

  function changeLanguage(nextLang) {
    setLang(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
    }
  }

  const flagLanguageButtons = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button type="button" onClick={() => changeLanguage('da')} title="Dansk" style={{ width: 36, height: 36, borderRadius: 999, border: lang === 'da' ? '2px solid #f2d14c' : '1px solid #355748', background: '#10271e', color: '#fff', fontSize: 18, lineHeight: 1 }}>{'\uD83C\uDDE9\uD83C\uDDF0'}</button>
      <button type="button" onClick={() => changeLanguage('en')} title="English" style={{ width: 36, height: 36, borderRadius: 999, border: lang === 'en' ? '2px solid #f2d14c' : '1px solid #355748', background: '#10271e', color: '#fff', fontSize: 18, lineHeight: 1 }}>{'\uD83C\uDDEC\uD83C\uDDE7'}</button>
    </div>
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session || null);
      setProfileEmail(data.session?.user?.email || '');
      setLoading(false);
    }

    init();

    const { data: subscription } = supabase.auth.onAuthStateChange((_evt, nextSession) => {
      setSession(nextSession || null);
      setProfileEmail(nextSession?.user?.email || '');
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    async function loadRole() {
      if (!session?.access_token) {
        setRole('user');
        return;
      }

      const response = await fetch('/api/profile/me', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const payload = await response.json();
      if (!response.ok) {
        setRole('user');
        return;
      }

      setRole(payload.role || 'user');
      setProfileEmail(payload.email || session.user?.email || '');
    }

    loadRole();
  }, [session]);

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setMessage('');

    if (!session?.access_token) {
      setMessage(t.missingToken);
      return;
    }

    if (!email || !password) {
      setMessage(t.needFields);
      return;
    }

    setCreating(true);

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email,
          password,
          displayName,
          role: newRole
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload?.error || payload?.detail || 'Failed to create account');
        return;
      }

      setMessage(`${payload.user.email} (${payload.user.role})`);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setNewRole('user');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <main style={{ padding: 24, fontFamily: 'system-ui' }}>{t.loading}</main>;
  }

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', background: '#0b1e16', color: '#ecf8f2' }}>
        <div style={{ width: 500, background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ marginTop: 0 }}>{t.title}</h2>
            {flagLanguageButtons}
          </div>
          <p>{t.notLoggedIn}</p>
          <a href="/" style={{ color: '#f2d14c' }}>{t.back}</a>
        </div>
      </main>
    );
  }

  if (role !== 'admin') {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', background: '#0b1e16', color: '#ecf8f2' }}>
        <div style={{ width: 500, background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ marginTop: 0 }}>{t.title}</h2>
            {flagLanguageButtons}
          </div>
          <p>{t.notAdmin}</p>
          <a href="/" style={{ color: '#f2d14c' }}>{t.back}</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ width: '100%', minHeight: '100vh', margin: 0, fontFamily: 'system-ui', background: '#0b1e16', color: '#ecf8f2' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #355748', background: '#10271e' }}>
        <div>
          {t.loggedInAs} <strong>{profileEmail || session.user?.email}</strong> ({role})
        </div>
        <button onClick={handleLogout} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #a64a4a', background: '#a64a4a', color: '#fff' }}>
          {t.logout}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #355748', background: '#10271e' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{t.title}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {flagLanguageButtons}
          <a href="/" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #3e6353', background: '#1a3b30', color: '#f2d14c', textDecoration: 'none' }}>{t.back}</a>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '20px auto', padding: '0 12px' }}>
        <div style={{ background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>{t.subtitle}</h2>
          <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <input placeholder={t.email} type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #355748', background: '#0b1e16', color: '#ecf8f2' }} />
            <input placeholder={t.password} type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #355748', background: '#0b1e16', color: '#ecf8f2' }} />
            <input placeholder={t.displayName} value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #355748', background: '#0b1e16', color: '#ecf8f2' }} />
            <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #355748', background: '#0b1e16', color: '#ecf8f2' }}>
              <option value="user">{t.user}</option>
              <option value="admin">{t.admin}</option>
            </select>
            <button type="submit" disabled={creating} style={{ padding: 10, borderRadius: 8, border: '1px solid #3e6353', background: '#1a3b30', color: '#f2d14c', fontWeight: 700 }}>
              {creating ? t.creating : t.create}
            </button>
          </form>

          {message ? <p style={{ marginTop: 10 }}>{message}</p> : null}
        </div>
      </div>
    </main>
  );
}