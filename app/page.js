'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser';
import { SharedTopNavigation } from '../components/SharedTopNavigation';

const TOKEN_STORAGE_KEY = 'supabase_access_token';
const LANGUAGE_STORAGE_KEY = 'showdart-language';

const texts = {
  da: {
    loading: 'Indlaeser...',
    missingEnvTitle: 'Manglende Supabase miljoevariabler',
    missingEnvBody: 'Tilfoej disse variabler i din lokale .env.local og i Vercel projektindstillinger:',
    login: 'Log ind',
    signup: 'Opret konto',
    email: 'E-mail',
    password: 'Adgangskode',
    createAccount: 'Opret konto',
    needAccount: 'Har du ikke en konto? Opret konto',
    haveAccount: 'Har du allerede konto? Log ind',
    missingEmailPassword: 'E-mail og adgangskode er paakraevet.',
    signupSuccess: 'Konto oprettet. Hvis e-mail bekraeftelse er slaaet til, bekraeft e-mail foerst.',
    tournamentTitle: 'Showdart Turnerings Organisator'
  },
  en: {
    loading: 'Loading...',
    missingEnvTitle: 'Missing Supabase Environment Variables',
    missingEnvBody: 'Set these variables in your local .env.local and in Vercel project settings:',
    login: 'Login',
    signup: 'Sign up',
    email: 'Email',
    password: 'Password',
    createAccount: 'Create account',
    needAccount: 'Need an account? Sign up',
    haveAccount: 'Already have account? Login',
    missingEmailPassword: 'Email and password are required.',
    signupSuccess: 'Signup successful. If email confirmation is enabled, confirm email first.',
    tournamentTitle: 'Showdart Tournament Organizer'
  }
};

function setStoredAccessToken(session) {
  if (typeof window === 'undefined') return;
  if (session?.access_token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'da';
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'da' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('da') ? 'da' : 'en';
}

export default function Page() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const isSupabaseConfigured = !!supabase;

  const [lang, setLang] = useState('da');
  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [profileRole, setProfileRole] = useState('user');
  const [profileEmail, setProfileEmail] = useState('');
  const [iframeHeight, setIframeHeight] = useState(1200);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef(null);

  const t = texts[lang] || texts.da;

  useEffect(() => {
    const initialLang = getInitialLanguage();
    setLang(initialLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, initialLang);
      document.documentElement.lang = initialLang;
    }
  }, []);

  function getTargetOrigin() {
    if (typeof window === 'undefined') return '*';
    return window.location.origin;
  }

  function postToIframe(message) {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(message, getTargetOrigin());
  }

  function changeLanguage(nextLang) {
    setLang(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
      document.documentElement.lang = nextLang;
    }
    postToIframe({ type: 'showdart-set-language', language: nextLang });
  }

  function handleNavigate(target) {
    if (target === 'admin') {
      window.location.href = '/admin';
      return;
    }

    if (target === 'rules') {
      postToIframe({ type: 'showdart-open-rules' });
      return;
    }

    postToIframe({ type: 'showdart-nav', target });
  }

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
    if (!supabase || !session?.access_token || !session?.user?.id) {
      if (!session?.user?.id) {
        setProfileRole('user');
        setProfileEmail('');
      }
      return;
    }

    async function loadProfileRole() {
      const response = await fetch('/api/profile/me', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const payload = await response.json();

      if (!response.ok) {
        setProfileRole('user');
        setProfileEmail(session.user.email || '');
        return;
      }

      const role = payload.role || 'user';
      setProfileRole(role);
      setProfileEmail(payload.email || session.user.email || '');
    }

    loadProfileRole();
  }, [session, supabase]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const allowedOrigin = window.location.origin;

    function handleIframeMessage(event) {
      if (event.origin !== allowedOrigin) return;
      const data = event.data || {};
      if (data.type !== 'showdart-height') return;
      const nextHeight = Number(data.height);
      if (!Number.isFinite(nextHeight)) return;
      const safeHeight = Math.max(900, Math.ceil(nextHeight));
      setIframeHeight(prev => (Math.abs(prev - safeHeight) > 2 ? safeHeight : prev));
    }

    window.addEventListener('message', handleIframeMessage);
    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }, []);

  useEffect(() => {
    if (!session || !iframeLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const nav = params.get('nav');
    if (nav === 'registration' || nav === 'tournament') {
      postToIframe({ type: 'showdart-nav', target: nav });
    }
    if (nav === 'rules') {
      postToIframe({ type: 'showdart-open-rules' });
    }
    if (nav) {
      params.delete('nav');
      const next = params.toString();
      window.history.replaceState({}, '', next ? `/?${next}` : '/');
    }
  }, [session, iframeLoaded]);

  useEffect(() => {
    if (!session || !iframeLoaded) return;
    postToIframe({ type: 'showdart-set-user', userId: session.user.id });
    postToIframe({ type: 'showdart-set-role', role: profileRole === 'admin' ? 'admin' : 'user' });
  }, [session, iframeLoaded, profileRole]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError('');

    if (!email || !password) {
      setAuthError(t.missingEmailPassword);
      return;
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError(t.signupSuccess);
      setMode('login');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setStoredAccessToken(null);
    setSession(null);
  }

  const flagLanguageButtons = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        onClick={() => changeLanguage('da')}
        title="Dansk"
        aria-label="Skift sprog til dansk"
        style={{ width: 40, height: 30, borderRadius: 6, border: lang === 'da' ? '2px solid #f2d14c' : '1px solid #3e6353', backgroundImage: "url('https://flagcdn.com/w40/dk.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#10271e', padding: 0 }}
      />
      <button
        type="button"
        onClick={() => changeLanguage('en')}
        title="English"
        aria-label="Switch language to English"
        style={{ width: 40, height: 30, borderRadius: 6, border: lang === 'en' ? '2px solid #f2d14c' : '1px solid #3e6353', backgroundImage: "url('https://flagcdn.com/w40/gb.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#10271e', padding: 0 }}
      />
    </div>
  );

  if (loadingSession) {
    return <main style={{ padding: 24, fontFamily: 'system-ui' }}>{t.loading}</main>;
  }

  if (!isSupabaseConfigured) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', background: '#0b1e16', color: '#ecf8f2', padding: 20 }}>
        <div style={{ maxWidth: 680, background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>{flagLanguageButtons}</div>
          <h2 style={{ marginTop: 0 }}>{t.missingEnvTitle}</h2>
          <p>{t.missingEnvBody}</p>
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
        <form onSubmit={handleAuthSubmit} style={{ width: 380, background: '#10271e', border: '1px solid #355748', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>{flagLanguageButtons}</div>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>{mode === 'login' ? t.login : t.signup}</h2>

          <label style={{ display: 'block', marginBottom: 6 }}>{t.email}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', marginBottom: 12, padding: 10, borderRadius: 8, border: '1px solid #355748', background: '#0b1e16', color: '#ecf8f2' }} />

          <label style={{ display: 'block', marginBottom: 6 }}>{t.password}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 12, padding: 10, borderRadius: 8, border: '1px solid #355748', background: '#0b1e16', color: '#ecf8f2' }} />

          {authError ? <p style={{ color: '#f3e39f', marginTop: 0 }}>{authError}</p> : null}

          <button type="submit" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #3e6353', background: '#1a3b30', color: '#f2d14c', fontWeight: 700 }}>
            {mode === 'login' ? t.login : t.createAccount}
          </button>

          <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ marginTop: 10, width: '100%', padding: 10, borderRadius: 8, border: '1px solid #355748', background: 'transparent', color: '#ecf8f2' }}>
            {mode === 'login' ? t.needAccount : t.haveAccount}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={{ width: '100%', minHeight: '100vh', margin: 0, fontFamily: 'system-ui', background: '#0b1e16' }}>
      <SharedTopNavigation
        lang={lang}
        role={profileRole}
        email={profileEmail || session.user.email}
        showRules
        activePage="tournament"
        onLanguageChange={changeLanguage}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />

      <div style={{ width: '100%' }}>
        <iframe
          ref={iframeRef}
          src="/index.html"
          title={t.tournamentTitle}
          onLoad={() => {
            setIframeLoaded(true);
            postToIframe({ type: 'showdart-set-language', language: lang });
            postToIframe({ type: 'showdart-set-user', userId: session.user.id });
            postToIframe({ type: 'showdart-set-role', role: profileRole === 'admin' ? 'admin' : 'user' });
          }}
          style={{ width: '100%', height: `${iframeHeight}px`, border: 0 }}
          scrolling="no"
        />
      </div>
    </main>
  );
}
