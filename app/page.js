'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser';
import { ShowdartDashboard } from '../components/dashboard/ShowdartDashboard';
import './dashboard.css';

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
    tournamentTitle: 'Showdart Turnerings Organisator',
    screenPanelTitle: 'Tilskuerskaerm',
    screenPanelBody: 'Aabn dette link pa en separat skaerm for deltagere og tilskuere.',
    screenOpen: 'Aabn skaerm',
    screenCopy: 'Kopier link',
    screenCopied: 'Tilskuerskaerm-link kopieret.',
    screenCopyFailed: 'Kunne ikke kopiere linket.',
    screenLoading: 'Indlaeser tilskuerskaerm-link...',
    screenLive: 'Live opdateringer aktive',
    screenError: 'Kunne ikke klargoere tilskuerskaermen.'
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
    tournamentTitle: 'Showdart Tournament Organizer',
    screenPanelTitle: 'Spectator Screen',
    screenPanelBody: 'Open this link on a separate display for participants and spectators.',
    screenOpen: 'Open Screen',
    screenCopy: 'Copy Link',
    screenCopied: 'Spectator screen link copied.',
    screenCopyFailed: 'Could not copy the link.',
    screenLoading: 'Loading spectator screen link...',
    screenLive: 'Live updates active',
    screenError: 'Could not prepare the spectator screen.'
  }
};

const theme = {
  page: 'radial-gradient(circle at 18% 0%, rgba(216, 169, 40, 0.08), transparent 25rem), linear-gradient(180deg, #030806 0%, #07120d 48%, #020504 100%)',
  surface: 'linear-gradient(145deg, rgba(12, 44, 30, 0.88), rgba(5, 18, 12, 0.96))',
  input: 'rgba(2, 8, 5, 0.72)',
  border: '#244438',
  borderStrong: '#3b6a55',
  text: '#f6f6ed',
  textSoft: '#dfe8de',
  textMuted: '#a7b7ad',
  gold: '#d8a928',
  goldSoft: '#f0c24b',
  danger: '#9b3f3f'
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
  const [screenInfo, setScreenInfo] = useState(null);
  const [screenError, setScreenError] = useState('');
  const [screenNotice, setScreenNotice] = useState('');
  const screenChannelRef = useRef(null);
  const screenChannelReadyRef = useRef(false);
  const pendingScreenPayloadRef = useRef(null);

  const t = texts[lang] || texts.da;

  useEffect(() => {
    const initialLang = getInitialLanguage();
    setLang(initialLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, initialLang);
      document.documentElement.lang = initialLang;
    }
  }, []);

  async function sendSpectatorPayload(payload) {
    const channel = screenChannelRef.current;
    if (!channel || !screenChannelReadyRef.current) {
      pendingScreenPayloadRef.current = payload;
      return;
    }

    try {
      await channel.send({
        type: 'broadcast',
        event: 'tournament-state',
        payload
      });
    } catch (_error) {
      pendingScreenPayloadRef.current = payload;
    }
  }

  function changeLanguage(nextLang) {
    setLang(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
      document.documentElement.lang = nextLang;
    }
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
    if (!session?.access_token) {
      setScreenInfo(null);
      setScreenError('');
      return;
    }

    let cancelled = false;

    async function loadScreenInfo() {
      setScreenError('');

      const response = await fetch('/api/tournament-screen?id=showdart-default', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const payload = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setScreenInfo(null);
        setScreenError(payload?.error || 'Spectator screen error');
        return;
      }

      setScreenInfo(payload);
    }

    loadScreenInfo();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!supabase || !screenInfo?.realtimeChannel || !session) {
      return undefined;
    }

    screenChannelReadyRef.current = false;
    pendingScreenPayloadRef.current = null;

    const channel = supabase.channel(screenInfo.realtimeChannel, {
      config: {
        broadcast: { self: false }
      }
    });

    screenChannelRef.current = channel;

    channel.subscribe(async status => {
      const isReady = status === 'SUBSCRIBED';
      screenChannelReadyRef.current = isReady;

      if (!isReady || !pendingScreenPayloadRef.current) {
        return;
      }

      const nextPayload = pendingScreenPayloadRef.current;
      pendingScreenPayloadRef.current = null;
      await sendSpectatorPayload(nextPayload);
    });

    return () => {
      screenChannelReadyRef.current = false;
      pendingScreenPayloadRef.current = null;
      screenChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [screenInfo, session, supabase]);

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

  async function handleCopyScreenLink() {
    if (!screenInfo?.screenUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(screenInfo.screenUrl);
      setScreenNotice(t.screenCopied);
    } catch (_error) {
      setScreenNotice(t.screenCopyFailed);
    }
  }

  useEffect(() => {
    if (!screenNotice) return undefined;
    const timer = window.setTimeout(() => {
      setScreenNotice('');
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [screenNotice]);

  const flagLanguageButtons = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        onClick={() => changeLanguage('da')}
        title="Dansk"
        aria-label="Skift sprog til dansk"
        style={{ width: 40, height: 30, borderRadius: 6, border: lang === 'da' ? `2px solid ${theme.gold}` : `1px solid ${theme.borderStrong}`, backgroundImage: "url('https://flagcdn.com/w40/dk.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: theme.surface, padding: 0 }}
      />
      <button
        type="button"
        onClick={() => changeLanguage('en')}
        title="English"
        aria-label="Switch language to English"
        style={{ width: 40, height: 30, borderRadius: 6, border: lang === 'en' ? `2px solid ${theme.gold}` : `1px solid ${theme.borderStrong}`, backgroundImage: "url('https://flagcdn.com/w40/gb.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: theme.surface, padding: 0 }}
      />
    </div>
  );

  if (loadingSession) {
    return <main style={{ padding: 24, fontFamily: 'system-ui' }}>{t.loading}</main>;
  }

  if (!isSupabaseConfigured) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Manrope, system-ui, sans-serif', background: theme.page, color: theme.text, padding: 20 }}>
        <div style={{ maxWidth: 680, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 22, boxShadow: '0 18px 45px rgba(0,0,0,0.34)' }}>
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
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Manrope, system-ui, sans-serif', background: theme.page, color: theme.text, padding: 18 }}>
        <form onSubmit={handleAuthSubmit} style={{ width: 'min(390px, 100%)', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 22, boxShadow: '0 18px 45px rgba(0,0,0,0.34)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>{flagLanguageButtons}</div>
          <h2 style={{ marginTop: 0, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{mode === 'login' ? t.login : t.signup}</h2>

          <label style={{ display: 'block', marginBottom: 6 }}>{t.email}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', marginBottom: 12, padding: 11, borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }} />

          <label style={{ display: 'block', marginBottom: 6 }}>{t.password}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 12, padding: 11, borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }} />

          {authError ? <p style={{ color: theme.goldSoft, marginTop: 0 }}>{authError}</p> : null}

          <button type="submit" style={{ width: '100%', padding: 11, borderRadius: 7, border: `1px solid ${theme.goldSoft}`, background: `linear-gradient(135deg, ${theme.gold}, ${theme.goldSoft})`, color: '#11170f', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {mode === 'login' ? t.login : t.createAccount}
          </button>

          <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ marginTop: 10, width: '100%', padding: 11, borderRadius: 7, border: `1px solid ${theme.border}`, background: 'rgba(12,24,19,0.35)', color: theme.textSoft, fontWeight: 700 }}>
            {mode === 'login' ? t.needAccount : t.haveAccount}
          </button>
        </form>
      </main>
    );
  }

  return (
    <ShowdartDashboard
      lang={lang}
      role={profileRole}
      email={profileEmail || session.user.email}
      session={session}
      screenInfo={screenInfo}
      screenNotice={screenNotice}
      screenError={screenError ? t.screenError : ''}
      onCopyScreenLink={handleCopyScreenLink}
      onOpenAdmin={() => { window.location.href = '/admin'; }}
      onOpenRules={() => {}}
      onLogout={handleLogout}
      onLanguageChange={changeLanguage}
      onStateSync={sendSpectatorPayload}
    />
  );
}

