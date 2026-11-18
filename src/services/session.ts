import { ORIGIN, SESSION_COOKIES } from '@/fourpda/urls';
import { settings } from '@/lib/settings';
import { native } from '@/native';

/**
 * The 4PDA session lives in Android's WebView cookie jar (CookieManager), which is shared with
 * fetch and with the native download worker. Grabby never sees or stores the password.
 */

/** "a=1; b=2" → { a: '1', b: '2' } */
export function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header?.split(';') ?? []) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function hasSession(cookies: Record<string, string>): boolean {
  const member = cookies[SESSION_COOKIES[0]];
  return !!member && member !== '0' && !!cookies[SESSION_COOKIES[1]];
}

export async function isSignedIn(): Promise<boolean> {
  if (!native.available) return settings.get('signedIn');
  const signedIn = hasSession(parseCookieHeader(native.getCookies(ORIGIN)));
  settings.set('signedIn', signedIn);
  if (signedIn) settings.set('sessionExpiredAt', null);
  return signedIn;
}

export async function signOut() {
  try {
    await native.clearCookies();
  } finally {
    settings.set('signedIn', false);
    settings.set('sessionExpiredAt', null);
  }
}

/** A download got 4PDA's login page while Grabby thought it was signed in. */
export function markSessionExpired() {
  if (!settings.get('signedIn')) return false;
  settings.set('signedIn', false);
  settings.set('sessionExpiredAt', Date.now());
  return true;
}
