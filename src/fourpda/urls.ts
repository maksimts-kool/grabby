import { encode } from 'windows-1251';

export const ORIGIN = 'https://4pda.to';
export const LOGIN_URL = `${ORIGIN}/forum/index.php?act=auth`;
/** Cookies 4PDA sets for a signed-in member. */
export const SESSION_COOKIES = ['member_id', 'pass_hash'] as const;

export function topicUrl(topicId: number): string {
  return `${ORIGIN}/forum/index.php?showtopic=${topicId}`;
}

const HOSTS = /^(?:www\.)?4pda\.(?:to|ru|ws)$/i;

/** 4PDA's own account pages: sign in, register, recover the password, confirm an email. */
const AUTH_ACT = /^(auth|login|reg|register|lostpass|validate|activate)$/i;

/**
 * Where the sign-in web view may go. 4PDA's account pages load in place; links to other sites
 * open in the browser; any other 4PDA page (the forum, where 4PDA sends you after signing in)
 * is blocked, and the screen checks the session instead.
 */
export function signInRoute(raw: string): 'allow' | 'block' | 'external' {
  if (/^(about:blank|data:)/i.test(raw)) return 'allow';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'block';
  }
  if (!/^https?:$/.test(url.protocol)) return 'block';
  if (!HOSTS.test(url.hostname)) return 'external';
  const act = url.searchParams.get('act');
  return act && AUTH_ACT.test(act) ? 'allow' : 'block';
}

/**
 * Reads a topic id from anything the user might paste: a full topic link, a link to one post
 * (`…showtopic=123&view=findpost&p=456` — stripped to the topic), the mobile `?t=` form, or a
 * link inside other text. Returns null when there is no 4PDA topic in it.
 */
export function parseTopicLink(input: string): number | null {
  const candidates = input.match(
    /https?:\/\/[^\s<>"']+|(?:www\.)?4pda\.(?:to|ru|ws)\/[^\s<>"']+/gi,
  );
  for (const raw of candidates ?? []) {
    let url: URL;
    try {
      url = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`);
    } catch {
      continue;
    }
    if (!HOSTS.test(url.hostname)) continue;
    const id = url.searchParams.get('showtopic') ?? url.searchParams.get('t');
    if (id && /^\d+$/.test(id)) return Number(id);
    const path = url.pathname.match(/\/forum\/(?:topic|t)\/(\d+)/i);
    if (path) return Number(path[1]);
  }
  return null;
}

/** Percent-encodes text as windows-1251 bytes, the way the forum's search form submits it. */
export function encodeCp1251(text: string): string {
  const bytes = encode(text, { mode: 'replacement' });
  let out = '';
  for (const b of bytes) {
    const ch = String.fromCharCode(b);
    out += /[A-Za-z0-9\-_.~]/.test(ch) ? ch : `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

/**
 * Topic search in "Android - Программы" and its subsections, with the same parameters the
 * forum's own search box sends. 4PDA answers guests with 403, so this needs a session.
 */
export function searchUrl(query: string): string {
  return `${ORIGIN}/forum/index.php?act=search&source=top&forums=212&subforums=1&result=topics&query=${encodeCp1251(query)}`;
}
