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
  page: 'radial-gradient(circle at 14% 0%, rgba(214, 184, 77, 0.1), transparent 28rem), radial-gradient(circle at 86% 12%, rgba(79, 117, 95, 0.16), transparent 24rem), linear-gradient(180deg, #0a1711 0%, #07120d 50%, #050b08 100%)',
  surface: 'linear-gradient(180deg, rgba(20, 39, 31, 0.98), rgba(12, 24, 19, 0.98))',
  input: '#091610',
  border: '#29463a',
  borderStrong: '#4f755f',
  text: '#f1f7f0',
  textSoft: '#d6e6dc',
  textMuted: '#94ad9e',
  gold: '#d6b84d',
  goldSoft: '#f1d56d',
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
  const [iframeHeight, setIframeHeight] = useState(1200);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [screenInfo, setScreenInfo] = useState(null);
  const [screenError, setScreenError] = useState('');
  const [screenNotice, setScreenNotice] = useState('');
  const iframeRef = useRef(null);
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

  function getTargetOrigin() {
    if (typeof window === 'undefined') return '*';
    return window.location.origin;
  }

  function postToIframe(message) {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(message, getTargetOrigin());
  }

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const allowedOrigin = window.location.origin;

    function handleIframeMessage(event) {
      if (event.origin !== allowedOrigin) return;
      const data = event.data || {};
      if (data.type === 'showdart-height') {
        const nextHeight = Number(data.height);
        if (!Number.isFinite(nextHeight)) return;
        const safeHeight = Math.max(900, Math.ceil(nextHeight));
        setIframeHeight(prev => (Math.abs(prev - safeHeight) > 2 ? safeHeight : prev));
        return;
      }

      if (data.type === 'showdart-state-sync' && data.state && typeof data.state === 'object') {
        sendSpectatorPayload({
          tournamentId: data.tournamentId || 'showdart-default',
          state: data.state,
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      }
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

  useEffect(() => {
    if (!iframeLoaded || !screenInfo?.realtimeChannel) return;
    postToIframe({ type: 'showdart-request-state-sync' });
  }, [iframeLoaded, screenInfo]);

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
    <main style={{ width: '100%', minHeight: '100vh', margin: 0, fontFamily: 'Manrope, system-ui, sans-serif', background: theme.page }}>
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

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 16px' }}>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '13px 15px', color: theme.text, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', boxShadow: '0 14px 32px rgba(0,0,0,0.22)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 260 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 4 }}>
                {t.screenPanelTitle}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.textSoft, fontWeight: 800 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: screenInfo?.screenUrl ? '#46c37b' : '#b88b45', boxShadow: `0 0 12px ${screenInfo?.screenUrl ? 'rgba(70,195,123,0.55)' : 'rgba(184,139,69,0.45)'}` }} />
                {screenInfo?.screenUrl ? t.screenLive : t.screenLoading}
              </div>
            </div>
            {screenNotice ? <div style={{ color: theme.goldSoft, fontSize: 14 }}>{screenNotice}</div> : null}
            {screenError ? <div style={{ color: '#f3a7a7', fontSize: 14 }}>{t.screenError}</div> : null}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={!screenInfo?.screenUrl}
              onClick={() => screenInfo?.screenUrl && window.open(screenInfo.screenUrl, '_blank', 'noopener,noreferrer')}
              style={{ padding: '10px 14px', borderRadius: 7, border: `1px solid ${theme.goldSoft}`, background: `linear-gradient(135deg, ${theme.gold}, ${theme.goldSoft})`, color: '#11170f', fontWeight: 800, cursor: screenInfo?.screenUrl ? 'pointer' : 'default', opacity: screenInfo?.screenUrl ? 1 : 0.65 }}
            >
              {screenInfo?.screenUrl ? t.screenOpen : t.screenLoading}
            </button>
            <button
              type="button"
              disabled={!screenInfo?.screenUrl}
              onClick={handleCopyScreenLink}
              style={{ padding: '10px 14px', borderRadius: 7, border: `1px solid ${theme.border}`, background: 'rgba(12,24,19,0.35)', color: theme.textSoft, fontWeight: 800, cursor: screenInfo?.screenUrl ? 'pointer' : 'default', opacity: screenInfo?.screenUrl ? 1 : 0.65 }}
            >
              {t.screenCopy}
            </button>
          </div>
        </div>
      </section>

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
