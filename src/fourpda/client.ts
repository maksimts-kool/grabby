import Constants from 'expo-constants';

import { decodeHtml } from './decode';
import { parsePost, parseTopic, TopicParseError, type Topic } from './parseTopic';
import { parseSearch, type SearchHit } from './parseSearch';
import { ORIGIN, searchUrl, topicUrl } from './urls';

/**
 * Network access to 4PDA. There is no public API: Grabby reads topic pages the way a browser
 * would, gently — one request per tracked topic per check (plus one when the header links its
 * files to a later post), conditional requests with If-Modified-Since, and an honest
 * User-Agent. Cookies from the in-app sign-in are shared with fetch on Android.
 */

export const USER_AGENT = `Grabby/${Constants.expoConfig?.version ?? '0'} (Android; personal 4PDA update checker)`;

export type FourPdaErrorCode =
  'network' | 'not-found' | 'sign-in' | 'parse' | 'server' | 'rate-limited';

export class FourPdaError extends Error {
  constructor(
    public readonly code: FourPdaErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'FourPdaError';
  }
}

interface Page {
  html: string;
  lastModified: string | null;
}

async function getPage(
  url: string,
  init: { ifModifiedSince?: string | null; signal?: AbortSignal } = {},
) {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'include',
      signal: init.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
        ...(init.ifModifiedSince ? { 'If-Modified-Since': init.ifModifiedSince } : {}),
      },
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new FourPdaError('network', (e as Error).message);
  }
  if (res.status === 304) return 'not-modified' as const;
  if (res.status === 404) throw new FourPdaError('not-found');
  if (res.status === 401 || res.status === 403) throw new FourPdaError('sign-in');
  if (res.status === 429) throw new FourPdaError('rate-limited');
  if (!res.ok) throw new FourPdaError('server', `HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const page: Page = {
    html: decodeHtml(bytes, res.headers.get('content-type')),
    lastModified: res.headers.get('last-modified'),
  };
  return page;
}

export type TopicResult =
  { status: 'not-modified' } | { status: 'ok'; topic: Topic; lastModified: string | null };

/**
 * Fetches and parses a topic's first post. When the header links its download to a later
 * post, that post is fetched too and its files (and changelog, if the header has none) used.
 */
export async function fetchTopic(
  topicId: number,
  options: { lastModified?: string | null; signal?: AbortSignal } = {},
): Promise<TopicResult> {
  const page = await getPage(topicUrl(topicId), {
    ifModifiedSince: options.lastModified,
    signal: options.signal,
  });
  if (page === 'not-modified') return { status: 'not-modified' };

  let topic: Topic;
  try {
    topic = parseTopic(page.html, topicId);
  } catch (e) {
    if (e instanceof TopicParseError && e.code === 'login-required')
      throw new FourPdaError('sign-in');
    throw new FourPdaError('parse', (e as Error).message);
  }

  const postId = topic.downloadPostIds[0];
  if (!topic.files.length && postId) {
    try {
      const linked = await getPage(
        `${ORIGIN}/forum/index.php?showtopic=${topicId}&view=findpost&p=${postId}`,
        {
          signal: options.signal,
        },
      );
      if (linked !== 'not-modified') {
        const post = parsePost(linked.html, postId);
        topic = {
          ...topic,
          files: post.files,
          changelog: topic.changelog.length ? topic.changelog : post.changelog,
          version: topic.version ?? post.version,
        };
      }
    } catch (e) {
      // The header still tells us the version; files stay empty and the app says so.
      if (e instanceof FourPdaError && e.code === 'network') throw e;
    }
  }
  return { status: 'ok', topic, lastModified: page.lastModified };
}

/** Topic search. 4PDA only lets members search, so guests get a `sign-in` error. */
export async function searchTopics(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const page = await getPage(searchUrl(query), { signal });
  if (page === 'not-modified') return [];
  return parseSearch(page.html);
}
