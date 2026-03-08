'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';

const LANGUAGE_STORAGE_KEY = 'showdart-language';

const texts = {
  da: {
    loading: 'Indlæser...',
    title: 'Admin',
    subtitle: 'Opret nye login-konti',
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
    logout: 'Log ud'
  },
  en: {
    loading: 'Loading...',
    title: 'Admin',
    subtitle: 'Create new login accounts',
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
    logout: 'Logout'
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
      <button type="button" onClick={() => changeLanguage('da')} title="Dansk" style={{ width: 36, height: 36, borderRadius: 999, border: lang === 'da' ? '2px solid #f2d14c' : '1px solid #355748', background: '#10271e', color: '#fff', fontSize: 18, lineHeight: 1 }}>🇩🇰</button>
      <button type="button" onClick={() => changeLanguage('en')} title="English" style={{ width: 36, height: 36, borderRadius: 999, border: lang === 'en' ? '2px solid #f2d14c' : '1px solid #355748', background: '#10271e', color: '#fff', fontSize: 18, lineHeight: 1 }}>🇬🇧</button>
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
      setLoading(false);
    }

    init();

    const { data: subscription } = supabase.auth.onAuthStateChange((_evt, nextSession) => {
      setSession(nextSession || null);
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
    <main style={{ minHeight: '100vh', fontFamily: 'system-ui', background: '#0b1e16', color: '#ecf8f2', padding: 20 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0 }}>{t.title}</h1>
            <p style={{ margin: '6px 0 0 0' }}>{t.subtitle}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {flagLanguageButtons}
            <a href="/" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #3e6353', background: '#1a3b30', color: '#f2d14c', textDecoration: 'none' }}>{t.back}</a>
            <button onClick={handleLogout} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #a64a4a', background: '#a64a4a', color: '#fff' }}>{t.logout}</button>
          </div>
        </div>

        <div style={{ background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 16 }}>
          <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <input placeholder={t.email} type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #355748' }} />
            <input placeholder={t.password} type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #355748' }} />
            <input placeholder={t.displayName} value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #355748' }} />
            <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #355748' }}>
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
