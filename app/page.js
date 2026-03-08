'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser';

const TOKEN_STORAGE_KEY = 'supabase_access_token';

function setStoredAccessToken(session) {
  if (typeof window === 'undefined') return;

  if (session?.access_token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export default function Page() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const isSupabaseConfigured = !!supabase;

  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [profileRole, setProfileRole] = useState('user');
  const [profileEmail, setProfileEmail] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      return;
    }

    let isMounted = true;

    async function bootstrapSession() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      setSession(data.session ?? null);
      setStoredAccessToken(data.session ?? null);
      setLoadingSession(false);
    }

    bootstrapSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setStoredAccessToken(nextSession ?? null);
      setAuthError('');
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    async function loadProfileRole() {
      if (!session?.user?.id) {
        setProfileRole('user');
        setProfileEmail('');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error || !data) {
        setProfileRole('user');
        setProfileEmail(session.user.email || '');
        return;
      }

      setProfileRole(data.role || 'user');
      setProfileEmail(data.email || session.user.email || '');
    }

    loadProfileRole();
  }, [session, supabase]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError('');

    if (!email || !password) {
      setAuthError('Email and password are required.');
      return;
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
      }
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError('Signup successful. If email confirmation is enabled, confirm email first.');
      setMode('login');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setStoredAccessToken(null);
    setSession(null);
    setAdminMessage('');
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setAdminMessage('');

    if (!session?.access_token) {
      setAdminMessage('Missing session token. Please log in again.');
      return;
    }

    if (!newUserEmail || !newUserPassword) {
      setAdminMessage('New user email and password are required.');
      return;
    }

    setCreatingUser(true);

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          displayName: newUserDisplayName,
          role: newUserRole
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        setAdminMessage(payload?.error || payload?.detail || 'Failed to create account.');
        return;
      }

      setAdminMessage(`Created account: ${payload.user.email} (${payload.user.role})`);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserDisplayName('');
      setNewUserRole('user');
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Failed to create account.');
    } finally {
      setCreatingUser(false);
    }
  }

  if (loadingSession) {
    return <main style={{ padding: 24, fontFamily: 'system-ui' }}>Loading...</main>;
  }

  if (!isSupabaseConfigured) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', background: '#0b1e16', color: '#ecf8f2', padding: 20 }}>
        <div style={{ maxWidth: 640, background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Missing Supabase Environment Variables</h2>
          <p>Set these variables in your local <code>.env.local</code> and in Vercel project settings:</p>
          <ul>
            <li><code>NEXT_PUBLIC_SUPABASE_URL</code></li>
            <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
            <li><code>SUPABASE_SERVICE_ROLE_KEY</code></li>
          </ul>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', background: '#0b1e16', color: '#ecf8f2' }}>
        <form onSubmit={handleAuthSubmit} style={{ width: 360, background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 20 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>{mode === 'login' ? 'Login' : 'Sign up'}</h2>

          <label style={{ display: 'block', marginBottom: 6 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', marginBottom: 12, padding: 10, borderRadius: 8, border: '1px solid #355748', background: '#0b1e16', color: '#ecf8f2' }}
          />

          <label style={{ display: 'block', marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', marginBottom: 12, padding: 10, borderRadius: 8, border: '1px solid #355748', background: '#0b1e16', color: '#ecf8f2' }}
          />

          {authError ? <p style={{ color: '#f3e39f', marginTop: 0 }}>{authError}</p> : null}

          <button type="submit" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #3e6353', background: '#1a3b30', color: '#f2d14c', fontWeight: 700 }}>
            {mode === 'login' ? 'Login' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            style={{ marginTop: 10, width: '100%', padding: 10, borderRadius: 8, border: '1px solid #355748', background: 'transparent', color: '#ecf8f2' }}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Already have account? Login'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={{ width: '100vw', height: '100vh', margin: 0, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #355748', background: '#10271e', color: '#ecf8f2' }}>
        <div>
          Logged in as <strong>{profileEmail || session.user.email}</strong> ({profileRole})
        </div>
        <button onClick={handleLogout} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #a64a4a', background: '#a64a4a', color: '#fff' }}>
          Logout
        </button>
      </div>

      {profileRole === 'admin' ? (
        <section style={{ padding: 12, borderBottom: '1px solid #355748', background: '#0f2219', color: '#ecf8f2' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Admin: Create login account</h3>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              placeholder="Email"
              type="email"
              value={newUserEmail}
              onChange={e => setNewUserEmail(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #355748', minWidth: 220 }}
            />
            <input
              placeholder="Password (min 8 chars)"
              type="password"
              value={newUserPassword}
              onChange={e => setNewUserPassword(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #355748', minWidth: 220 }}
            />
            <input
              placeholder="Display name (optional)"
              value={newUserDisplayName}
              onChange={e => setNewUserDisplayName(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #355748', minWidth: 200 }}
            />
            <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #355748' }}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <button type="submit" disabled={creatingUser} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #3e6353', background: '#1a3b30', color: '#f2d14c' }}>
              {creatingUser ? 'Creating...' : 'Create account'}
            </button>
          </form>
          {adminMessage ? <p style={{ margin: '8px 0 0 0' }}>{adminMessage}</p> : null}
        </section>
      ) : null}

      <div style={{ width: '100%', height: profileRole === 'admin' ? 'calc(100% - 148px)' : 'calc(100% - 50px)' }}>
        <iframe
          src="/index.html"
          title="Showdart Tournament Organizer"
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      </div>
    </main>
  );
}



