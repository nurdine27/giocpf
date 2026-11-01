'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { Icon } from './icon';
import {
  CONSENT_CATEGORIES,
  OPEN_PREFERENCES,
  consentSnapshot,
  openCookiePreferences,
  parseConsent,
  saveConsent,
  subscribeConsent,
  type ConsentCategories,
} from '@/lib/consent';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
/** Sentinel for the server render, where cookies are unknown: nothing is shown or loaded. */
const SERVER = '__server__';

export function CookieConsent() {
  const raw = useSyncExternalStore(subscribeConsent, consentSnapshot, () => SERVER);
  const consent = raw === SERVER ? null : parseConsent(raw);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const open = () => setPreferencesOpen(true);
    window.addEventListener(OPEN_PREFERENCES, open);
    return () => window.removeEventListener(OPEN_PREFERENCES, open);
  }, []);

  const showBanner = raw !== SERVER && !consent && !preferencesOpen;

  return (
    <>
      {consent?.analytics && GA_ID && <Analytics id={GA_ID} />}
      {showBanner && (
        <section className="cookie-banner" role="region" aria-label="Consentimento de cookies">
          <div className="cookie-banner-copy">
            <Icon name="cookie" />
            <p>
              Usamos cookies necessários para o site funcionar e, com a sua autorização, cookies de
              estatística e marketing para melhorar a experiência. Saiba mais na{' '}
              <Link href="/politica-de-privacidade#cookies">Política de Privacidade</Link>.
            </p>
          </div>
          <div className="cookie-banner-actions">
            <button
              type="button"
              className="button button-light"
              onClick={() => setPreferencesOpen(true)}
            >
              Personalizar
            </button>
            <button
              type="button"
              className="button button-light"
              onClick={() => saveConsent({ analytics: false, marketing: false })}
            >
              Só necessários
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => saveConsent({ analytics: true, marketing: true })}
            >
              Aceitar todos
            </button>
          </div>
        </section>
      )}
      {preferencesOpen && (
        <Preferences
          initial={{
            analytics: consent?.analytics ?? false,
            marketing: consent?.marketing ?? false,
          }}
          onClose={() => setPreferencesOpen(false)}
        />
      )}
    </>
  );
}

function Preferences({ initial, onClose }: { initial: ConsentCategories; onClose: () => void }) {
  const [choice, setChoice] = useState(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function save(categories: ConsentCategories) {
    saveConsent(categories);
    onClose();
  }

  return (
    <div className="cookie-modal-backdrop" onMouseDown={onClose}>
      <div
        className="cookie-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cookie-modal-head">
          <h2 id="cookie-title">
            <Icon name="cookie" /> Preferências de cookies
          </h2>
          <button type="button" className="cookie-close" aria-label="Fechar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <p className="page-muted">
          Escolha que cookies autoriza. Pode mudar a decisão a qualquer momento em «Preferências de
          cookies», no rodapé do site.
        </p>
        <ul className="cookie-categories">
          {CONSENT_CATEGORIES.map((c) => {
            const locked = c.key === 'necessary';
            const checked = locked || choice[c.key as keyof ConsentCategories];
            return (
              <li key={c.key}>
                <div>
                  <strong>{c.title}</strong>
                  <p>{c.description}</p>
                </div>
                <label
                  className={`cookie-toggle ${checked ? 'is-on' : ''} ${locked ? 'is-locked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={(e) => setChoice((s) => ({ ...s, [c.key]: e.target.checked }))}
                  />
                  <span aria-hidden="true" />
                  <span className="sr-only">{c.title}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="cookie-modal-actions">
          <button
            type="button"
            className="button button-light"
            onClick={() => save({ analytics: false, marketing: false })}
          >
            Recusar opcionais
          </button>
          <button type="button" className="button button-light" onClick={() => save(choice)}>
            Guardar escolha
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => save({ analytics: true, marketing: true })}
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}

/** Google Analytics 4, loaded only after the visitor accepts statistics cookies. */
function Analytics({ id }: { id: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`}
      </Script>
    </>
  );
}

export function CookiePreferencesLink() {
  return (
    <button type="button" className="footer-link-button" onClick={openCookiePreferences}>
      Preferências de cookies
    </button>
  );
}
