'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanRegistrationName, isRegistrationName, MAX_REGISTRATION_NAME_LENGTH, registrationCopy } from '../../lib/playerRegistration.js';

export function RegistrationPanel({ token, lang, onActiveChange, beforeUpdate, onTransfer, onConfirm }) {
  const t = registrationCopy[lang] || registrationCopy.da;
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const pending = useRef(false);
  const endpoint = '/api/player-registration/manage';

  const request = useCallback(async (payload, signal) => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (payload?.action === 'open' || payload?.action === 'transfer') await beforeUpdate();
      const response = await fetch(endpoint, {
        method: payload ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
        body: payload ? JSON.stringify(payload) : undefined,
        cache: 'no-store',
        signal: signal || AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (signal?.aborted) return;
      if ('registration' in result) {
        setRegistration(result.registration);
        onActiveChange(Boolean(result.registration && !result.registration.imported));
      }
      if (result.code !== 'ok') {
        const message = t[result.code] || t.failed;
        setError(result.name ? `${result.name} · ${message}` : message);
        return;
      }
      setEditing(null);
      if (payload?.action === 'transfer' && result.state) {
        onTransfer(result.state, result.updatedAt);
        setNotice(t.transferred);
      }
    } catch {
      if (!signal?.aborted) setError(t.failed);
    } finally {
      pending.current = false;
      if (!signal?.aborted) setLoading(false);
    }
  }, [beforeUpdate, onActiveChange, onTransfer, t, token]);

  useEffect(() => {
    const controller = new AbortController();
    request(null, controller.signal);
    return () => {
      controller.abort();
      pending.current = false;
    };
  }, [request]);

  const openRegistration = registration && !registration.imported;
  const tabletPath = openRegistration ? `/tilmelding/${registration.id}` : '';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(tabletPath, window.location.origin).href);
      setNotice(t.copied);
    } catch {
      window.open(tabletPath, '_blank', 'noopener,noreferrer');
    }
  }

  function rename(event) {
    event.preventDefault();
    const name = cleanRegistrationName(editing.name);
    if (!isRegistrationName(name)) {
      setError(t.invalid_name);
      return;
    }
    request({ action: 'rename', id: registration.id, entryId: editing.id, name });
  }

  return (
    <div className="sd-stack">
      {error ? <p className="sd-registration-message" role="alert">{error}</p> : null}
      {notice ? <p className="sd-registration-message sd-green-text" role="status">{notice}</p> : null}
      {openRegistration ? (
        <>
          <div className="sd-registration-actions">
            <a className="sd-button" href={tabletPath} target="_blank" rel="noreferrer">{t.tablet}</a>
            <button type="button" className="sd-button" onClick={copyLink}>{t.copy}</button>
            <button type="button" className="sd-button" onClick={() => request(null)} disabled={loading}>{t.refresh}</button>
          </div>
          {registration.entries.length === 0 ? <p className="sd-registration-message">{t.empty}</p> : (
            <ul className="sd-registration-list">
              {registration.entries.map(entry => (
                <li key={entry.id}>
                  {editing?.id === entry.id ? (
                    <form className="sd-registration-actions" onSubmit={rename}>
                      <input className="sd-input" aria-label={t.name} maxLength={MAX_REGISTRATION_NAME_LENGTH}
                        value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} autoFocus required />
                      <button type="submit" className="sd-button gold" disabled={loading}>{t.save}</button>
                      <button type="button" className="sd-button" disabled={loading} onClick={() => setEditing(null)}>{t.cancel}</button>
                    </form>
                  ) : (
                    <>
                      <span>{entry.name}</span>
                      <div className="sd-registration-actions">
                        <button type="button" className="sd-button" disabled={loading} onClick={() => setEditing(entry)}>{t.edit}</button>
                        <button type="button" className="sd-button" disabled={loading} onClick={() => onConfirm(
                          t.removePrompt.replace('{name}', () => entry.name),
                          () => request({ action: 'remove', id: registration.id, entryId: entry.id })
                        )}>{t.remove}</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="sd-button gold full" disabled={loading || Boolean(editing)} onClick={() => onConfirm(
            t.transferPrompt,
            () => request({ action: 'transfer', id: registration.id, revision: registration.revision })
          )}>{t.transfer}</button>
        </>
      ) : (
        <button type="button" className="sd-button gold full" disabled={loading}
          onClick={() => request({ action: 'open' })}>{loading ? t.loading : t.open}</button>
      )}
    </div>
  );
}
