'use client';

import { Check, Maximize, Minimize } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanRegistrationName, isRegistrationName, MAX_REGISTRATION_NAME_LENGTH, registrationCopy } from '../../lib/playerRegistration.js';

const t = registrationCopy.da;

export function RegistrationTablet({ code }) {
  const [status, setStatus] = useState('loading');
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenHelp, setFullscreenHelp] = useState(false);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const sendingRef = useRef(false);

  const checkStatus = useCallback(async signal => {
    setStatus('loading');
    try {
      const response = await fetch(`/api/player-registration?id=${code}`, { cache: 'no-store', signal });
      const result = await response.json();
      setStatus(result.code === 'ok' ? 'open' : result.code);
    } catch {
      if (!signal?.aborted) setStatus('failed');
    }
  }, [code]);

  useEffect(() => {
    const controller = new AbortController();
    checkStatus(controller.signal);
    return () => controller.abort();
  }, [checkStatus]);

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (draft && !dialog.open) dialog.showModal();
    if (!draft && dialog.open) dialog.close();
  }, [draft]);

  useEffect(() => {
    if (status !== 'success') return undefined;
    const timer = window.setTimeout(() => setStatus('open'), 2300);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenHelp(false);
    } catch {
      setFullscreenHelp(true);
    }
  }

  function editName() {
    if (sendingRef.current) return;
    dialogRef.current.close();
    setDraft(null);
    setError('');
    inputRef.current?.focus();
  }

  function review(event) {
    event.preventDefault();
    const name = cleanRegistrationName(input);
    if (!isRegistrationName(name)) {
      setError('invalid_name');
      inputRef.current?.focus();
      return;
    }
    setInput(name);
    setError('');
    setDraft({ name, requestId: crypto.randomUUID() });
  }

  async function confirm(event) {
    event.preventDefault();
    if (!draft || sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/player-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: code, ...draft }),
        signal: AbortSignal.timeout(12000)
      });
      const { code: result } = await response.json();
      if (result === 'ok') {
        setInput('');
        setDraft(null);
        setStatus('success');
      } else if (result === 'duplicate' || result === 'invalid_name') {
        dialogRef.current.close();
        setDraft(null);
        setError(result);
        inputRef.current?.focus();
      } else if (result === 'closed' || result === 'missing') {
        setInput('');
        setDraft(null);
        setStatus(result);
      } else {
        setError('failed');
      }
    } catch {
      setError('failed');
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="reg-tablet">
      <div className="reg-toolbar">
        <button type="button" className="reg-secondary" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize aria-hidden="true" size={18} /> : <Maximize aria-hidden="true" size={18} />}
          {fullscreen ? t.exitFullscreen : t.fullscreen}
        </button>
        {fullscreenHelp ? <p role="status">{t.fullscreenHelp}</p> : null}
      </div>
      <section className="reg-card" aria-labelledby="registration-title">
        <p className="reg-brand">Showdart</p>
        <h1 id="registration-title">{t.title}</h1>
        {status === 'open' ? (
          <form onSubmit={review}>
            <label htmlFor="registration-name">{t.name}</label>
            <input id="registration-name" ref={inputRef} value={input} maxLength={MAX_REGISTRATION_NAME_LENGTH}
              autoComplete="off" autoCapitalize="words" enterKeyHint="next" spellCheck={false}
              aria-invalid={Boolean(error && !draft)} aria-describedby={error && !draft ? 'registration-error' : undefined}
              onChange={event => { setInput(event.target.value); setError(''); }} required />
            {error && !draft ? <p id="registration-error" className="reg-error" role="alert">{t[error]}</p> : null}
            <button type="submit">{t.next}</button>
          </form>
        ) : status === 'success' ? (
          <div className="reg-success">
            <p role="status"><Check aria-hidden="true" /> {t.success}</p>
            <button type="button" className="reg-secondary" onClick={() => setStatus('open')}>{t.nextPlayer}</button>
          </div>
        ) : (
          <div className="reg-status">
            <p role="status">{t[status] || t.failed}</p>
            {status === 'failed' ? <button type="button" onClick={() => checkStatus()}>{t.retry}</button> : null}
          </div>
        )}
      </section>
      <dialog className="reg-dialog" ref={dialogRef} aria-labelledby="registration-confirm-title"
        onCancel={event => { event.preventDefault(); editName(); }}>
        <form onSubmit={confirm}>
          <h2 id="registration-confirm-title">{t.confirmTitle}</h2>
          <p className="reg-confirm-name">{draft?.name}</p>
          {draft && error ? <p className="reg-error" role="alert">{t[error]}</p> : null}
          <div className="reg-actions">
            <button type="button" className="reg-secondary" onClick={editName} disabled={busy}>{t.edit}</button>
            <button type="submit" disabled={busy}>{busy ? t.working : t.confirm}</button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
