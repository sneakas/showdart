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
    setLang(getInitialLanguage());
  }, []);

  function changeLanguage(nextLang) {
    setLang(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
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
    return <main style={{ padding: 24, fontFamily: 'system-ui' }}>{t.loading}</main>;
  }

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', background: '#0b1e16', color: '#ecf8f2' }}>
        <div style={{ width: 500, background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 20 }}>
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
          <p>{t.notAdmin}</p>
          <a href="/" style={{ color: '#f2d14c' }}>{t.back}</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ width: '100%', minHeight: '100vh', margin: 0, fontFamily: 'system-ui', background: '#0b1e16', color: '#ecf8f2' }}>
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
        <div style={{ background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 16, marginBottom: 14 }}>
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
        </div>

        <div style={{ background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{t.createdUsers}</h3>
            <button type="button" onClick={loadUsers} disabled={usersLoading} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #3e6353', background: '#1a3b30', color: '#f2d14c', fontWeight: 700 }}>{t.refresh}</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '30%', textAlign: 'left', borderBottom: '1px solid #355748', padding: '8px 6px' }}>{t.email}</th>
                  <th style={{ width: '28%', textAlign: 'left', borderBottom: '1px solid #355748', padding: '8px 6px' }}>{t.displayName}</th>
                  <th style={{ width: '17%', textAlign: 'left', borderBottom: '1px solid #355748', padding: '8px 6px' }}>{t.role}</th>
                  <th style={{ width: '25%', textAlign: 'left', borderBottom: '1px solid #355748', padding: '8px 6px' }}>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(userItem => (
                  <tr key={userItem.id}>
                    <td style={{ borderBottom: '1px solid #244336', padding: '8px 6px', verticalAlign: 'top', wordBreak: 'break-word' }}>{userItem.email}</td>
                    <td style={{ borderBottom: '1px solid #244336', padding: '8px 6px', verticalAlign: 'top' }}>
                      <input
                        value={userItem.display_name}
                        onChange={e => setUsers(prev => prev.map(u => (u.id === userItem.id ? { ...u, display_name: e.target.value } : u)))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 6, border: '1px solid #355748', background: '#0b1e16', color: '#ecf8f2' }}
                      />
                    </td>
                    <td style={{ borderBottom: '1px solid #244336', padding: '8px 6px', verticalAlign: 'top' }}>
                      <select
                        value={userItem.role}
                        onChange={e => setUsers(prev => prev.map(u => (u.id === userItem.id ? { ...u, role: e.target.value === 'admin' ? 'admin' : 'user' } : u)))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 6, border: '1px solid #355748', background: '#0b1e16', color: '#ecf8f2' }}
                      >
                        <option value="user">{t.user}</option>
                        <option value="admin">{t.admin}</option>
                      </select>
                    </td>
                    <td style={{ borderBottom: '1px solid #244336', padding: '8px 6px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => handleSaveUser(userItem.id)} disabled={savingId === userItem.id} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #3e6353', background: '#1a3b30', color: '#f2d14c', fontWeight: 700 }}>{t.save}</button>
                        <button type="button" onClick={() => handleDeleteUser(userItem.id)} disabled={deletingId === userItem.id || userItem.id === session.user?.id} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #a64a4a', background: '#a64a4a', color: '#fff', fontWeight: 700 }}>{t.delete}</button>
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
