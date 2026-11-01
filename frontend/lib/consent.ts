/** Cookie consent stored in a first-party cookie so the choice survives across visits. */

export const CONSENT_COOKIE = 'gio_consent';
export const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 6 months, then we ask again.
export const CONSENT_CHANGED = 'gio:consent-changed';
export const OPEN_PREFERENCES = 'gio:open-cookie-preferences';

export type ConsentCategories = { analytics: boolean; marketing: boolean };
export type Consent = ConsentCategories & { v: number; at: string };

export const CONSENT_CATEGORIES: {
  key: keyof ConsentCategories | 'necessary';
  title: string;
  description: string;
}[] = [
  {
    key: 'necessary',
    title: 'Necessários',
    description:
      'Permitem o funcionamento do site: sessão da área administrativa, segurança e a memória desta escolha. Não podem ser desligados.',
  },
  {
    key: 'analytics',
    title: 'Estatísticas',
    description:
      'Ajudam-nos a perceber que páginas são visitadas para melhorar o site. Os dados são agregados e anónimos.',
  },
  {
    key: 'marketing',
    title: 'Marketing',
    description: 'Permitem medir campanhas nas redes sociais e mostrar anúncios relevantes do GIO.',
  },
];

function readCookie() {
  if (typeof document === 'undefined') return '';
  return (
    document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
      ?.slice(CONSENT_COOKIE.length + 1) ?? ''
  );
}

export function parseConsent(raw: string): Consent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Consent;
    return value.v === CONSENT_VERSION ? value : null;
  } catch {
    return null;
  }
}

/** Raw cookie string; stable between calls so it works as a useSyncExternalStore snapshot. */
export function consentSnapshot() {
  return readCookie();
}

export function subscribeConsent(callback: () => void) {
  window.addEventListener(CONSENT_CHANGED, callback);
  return () => window.removeEventListener(CONSENT_CHANGED, callback);
}

export function saveConsent(categories: ConsentCategories) {
  const value: Consent = { ...categories, v: CONSENT_VERSION, at: new Date().toISOString() };
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  if (!categories.analytics) {
    // Stops an already-loaded Google Analytics from sending more hits in this page view.
    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    if (gaId) (window as unknown as Record<string, boolean>)[`ga-disable-${gaId}`] = true;
    clearAnalyticsCookies();
  }
  window.dispatchEvent(new Event(CONSENT_CHANGED));
}

export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_PREFERENCES));
}

/** Removes Google Analytics cookies when consent is withdrawn. */
function clearAnalyticsCookies() {
  const host = window.location.hostname;
  for (const name of document.cookie.split('; ').map((c) => c.split('=')[0])) {
    if (!/^_ga|^_gid|^_gat/.test(name)) continue;
    for (const domain of ['', `; Domain=${host}`, `; Domain=.${host.replace(/^www\./, '')}`])
      document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
  }
}
