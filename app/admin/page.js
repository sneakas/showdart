'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';
import { SharedTopNavigation } from '../../components/SharedTopNavigation';

const LANGUAGE_STORAGE_KEY = 'showdart-language';

const texts = {
  da: {
    loading: 'Indlaeser...',
    title: 'Admin',
    subtitle: 'Administrer konti',
    notLoggedIn: 'Du skal vaere logget ind for at bruge adminsiden.',
    notAdmin: 'Du har ikke admin-adgang.',
    back: 'Tilbage til turnering',
    email: 'E-mail',
    password: 'Adgangskode (min 8 tegn)',
    displayName: 'Vist navn (valgfri)',
    create: 'Opret konto',
    creating: 'Opretter...',
    needFields: 'E-mail og adgangskode er paakraevet.',
    missingToken: 'Session mangler. Log ind igen.',
    user: 'Bruger',
    admin: 'Admin',
    createdUsers: 'Oprettede brugere',
    actions: 'Handlinger',
    role: 'Rolle',
    save: 'Gem',
    delete: 'Slet',
    refresh: 'Opdater',
    confirmDelete: 'Er du sikker paa at du vil slette denne bruger?',
    cannotDeleteSelf: 'Du kan ikke slette din egen admin-konto'
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
    createdUsers: 'Created users',
    actions: 'Actions',
    role: 'Role',
    save: 'Save',
    delete: 'Delete',
    refresh: 'Refresh',
    confirmDelete: 'Are you sure you want to delete this user?',
    cannotDeleteSelf: 'You cannot delete your own admin account'
  }
};

const theme = {
  page: 'radial-gradient(circle at 14% 0%, rgba(214, 184, 77, 0.1), transparent 28rem), radial-gradient(circle at 86% 12%, rgba(79, 117, 95, 0.16), transparent 24rem), linear-gradient(180deg, #0a1711 0%, #07120d 50%, #050b08 100%)',
  surface: 'linear-gradient(180deg, rgba(20, 39, 31, 0.98), rgba(12, 24, 19, 0.98))',
  input: '#091610',
  border: '#29463a',
  borderStrong: '#4f755f',
  rowBorder: '#20382d',
  text: '#f1f7f0',
  textSoft: '#d6e6dc',
  textMuted: '#94ad9e',
  gold: '#d6b84d',
  goldSoft: '#f1d56d',
  danger: '#9b3f3f'
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

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const t = texts[lang] || texts.da;

  useEffect(() => {
    const initialLang = getInitialLanguage();
    setLang(initialLang);
    if (typeof window !== 'undefined') {
      document.documentElement.lang = initialLang;
    }
  }, []);

  function changeLanguage(nextLang) {
    setLang(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
      document.documentElement.lang = nextLang;
    }
  }

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

  async function loadUsers() {
    if (!session?.access_token || role !== 'admin') return;

    setUsersLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload?.error || payload?.detail || 'Failed to load users');
        return;
      }
      const mapped = (payload.users || []).map(u => ({
        id: u.id,
        email: u.email || '',
        display_name: u.display_name || '',
        role: u.role === 'admin' ? 'admin' : 'user'
      }));
      setUsers(mapped);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [session, role]);

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  function handleNavigate(target) {
    if (target === 'admin') return;
    window.location.href = `/?nav=${target}`;
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
        body: JSON.stringify({ email, password, displayName, role: newRole })
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
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveUser(userId) {
    if (!session?.access_token) return;
    const user = users.find(u => u.id === userId);
    if (!user) return;

    setSavingId(userId);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: user.id, displayName: user.display_name, role: user.role })
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload?.error || payload?.detail || 'Failed to update user');
        return;
      }
      setMessage(`${payload.user.email} (${payload.user.role})`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setSavingId('');
    }
  }

  async function handleDeleteUser(userId) {
    if (!session?.access_token) return;
    if (userId === session.user?.id) {
      setMessage(t.cannotDeleteSelf);
      return;
    }

    if (!window.confirm(t.confirmDelete)) return;

    setDeletingId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload?.error || payload?.detail || 'Failed to delete user');
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete user');
    } finally {
      setDeletingId('');
    }
  }

  if (loading) {
    return <main style={{ padding: 24, fontFamily: 'Manrope, system-ui, sans-serif', background: theme.page, color: theme.text, minHeight: '100vh' }}>{t.loading}</main>;
  }

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Manrope, system-ui, sans-serif', background: theme.page, color: theme.text, padding: 18 }}>
        <div style={{ width: 'min(500px, 100%)', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 22, boxShadow: '0 18px 45px rgba(0,0,0,0.34)' }}>
          <p>{t.notLoggedIn}</p>
          <a href="/" style={{ color: theme.goldSoft }}>{t.back}</a>
        </div>
      </main>
    );
  }

  if (role !== 'admin') {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Manrope, system-ui, sans-serif', background: theme.page, color: theme.text, padding: 18 }}>
        <div style={{ width: 'min(500px, 100%)', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 22, boxShadow: '0 18px 45px rgba(0,0,0,0.34)' }}>
          <p>{t.notAdmin}</p>
          <a href="/" style={{ color: theme.goldSoft }}>{t.back}</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ width: '100%', minHeight: '100vh', margin: 0, fontFamily: 'Manrope, system-ui, sans-serif', background: theme.page, color: theme.text }}>
      <SharedTopNavigation
        lang={lang}
        role={role}
        email={profileEmail || session.user?.email}
        showRules
        activePage="admin"
        onLanguageChange={changeLanguage}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />

      <div style={{ maxWidth: 1180, margin: '20px auto', padding: '0 12px' }}>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 18, marginBottom: 14, boxShadow: '0 18px 45px rgba(0,0,0,0.28)' }}>
          <h2 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.04em', color: theme.goldSoft }}>{t.subtitle}</h2>
          <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <input placeholder={t.email} type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 11, borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }} />
            <input placeholder={t.password} type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: 11, borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }} />
            <input placeholder={t.displayName} value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ padding: 11, borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }} />
            <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ padding: 11, borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }}>
              <option value="user">{t.user}</option>
              <option value="admin">{t.admin}</option>
            </select>
            <button type="submit" disabled={creating} style={{ padding: 11, borderRadius: 7, border: `1px solid ${theme.goldSoft}`, background: `linear-gradient(135deg, ${theme.gold}, ${theme.goldSoft})`, color: '#11170f', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {creating ? t.creating : t.create}
            </button>
          </form>
        </div>

        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 18, boxShadow: '0 18px 45px rgba(0,0,0,0.28)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', color: theme.goldSoft }}>{t.createdUsers}</h3>
            <button type="button" onClick={loadUsers} disabled={usersLoading} style={{ padding: '8px 12px', borderRadius: 7, border: `1px solid ${theme.borderStrong}`, background: 'rgba(12,24,19,0.35)', color: theme.textSoft, fontWeight: 800 }}>{t.refresh}</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '30%', textAlign: 'left', borderBottom: `1px solid ${theme.border}`, padding: '9px 6px', color: theme.goldSoft, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.06em' }}>{t.email}</th>
                  <th style={{ width: '28%', textAlign: 'left', borderBottom: `1px solid ${theme.border}`, padding: '9px 6px', color: theme.goldSoft, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.06em' }}>{t.displayName}</th>
                  <th style={{ width: '17%', textAlign: 'left', borderBottom: `1px solid ${theme.border}`, padding: '9px 6px', color: theme.goldSoft, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.06em' }}>{t.role}</th>
                  <th style={{ width: '25%', textAlign: 'left', borderBottom: `1px solid ${theme.border}`, padding: '9px 6px', color: theme.goldSoft, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.06em' }}>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(userItem => (
                  <tr key={userItem.id}>
                    <td style={{ borderBottom: `1px solid ${theme.rowBorder}`, padding: '9px 6px', verticalAlign: 'top', wordBreak: 'break-word' }}>{userItem.email}</td>
                    <td style={{ borderBottom: `1px solid ${theme.rowBorder}`, padding: '9px 6px', verticalAlign: 'top' }}>
                      <input
                        value={userItem.display_name}
                        onChange={e => setUsers(prev => prev.map(u => (u.id === userItem.id ? { ...u, display_name: e.target.value } : u)))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }}
                      />
                    </td>
                    <td style={{ borderBottom: `1px solid ${theme.rowBorder}`, padding: '9px 6px', verticalAlign: 'top' }}>
                      <select
                        value={userItem.role}
                        onChange={e => setUsers(prev => prev.map(u => (u.id === userItem.id ? { ...u, role: e.target.value === 'admin' ? 'admin' : 'user' } : u)))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }}
                      >
                        <option value="user">{t.user}</option>
                        <option value="admin">{t.admin}</option>
                      </select>
                    </td>
                    <td style={{ borderBottom: `1px solid ${theme.rowBorder}`, padding: '9px 6px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => handleSaveUser(userItem.id)} disabled={savingId === userItem.id} style={{ padding: '7px 10px', borderRadius: 7, border: `1px solid ${theme.goldSoft}`, background: `linear-gradient(135deg, ${theme.gold}, ${theme.goldSoft})`, color: '#11170f', fontWeight: 800 }}>{t.save}</button>
                        <button type="button" onClick={() => handleDeleteUser(userItem.id)} disabled={deletingId === userItem.id || userItem.id === session.user?.id} style={{ padding: '7px 10px', borderRadius: 7, border: `1px solid ${theme.danger}`, background: theme.danger, color: '#fff', fontWeight: 800 }}>{t.delete}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
        </div>
      </div>
    </main>
  );
}

