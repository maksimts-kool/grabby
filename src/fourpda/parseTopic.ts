import { parse, type HTMLElement, NodeType } from 'node-html-parser';
import { z } from 'zod';

import { isPrerelease } from '@/lib/version';

/**
 * Parser for 4PDA topic pages. Grabby reads the first post (the "шапка"), which by forum
 * convention holds the current version, the APKs and the changelog:
 *
 *   <div class="topic_title_post">Name | Description<br/>…
 *   <div id="navstrip">… <a>Android - Программы</a></div>
 *   <div class="post_body …" id="post-main-<postId>">
 *     <b>Версия: 0.34</b> … <b>Имя пакета:</b> com.example.app …
 *     <div class="post-block spoil"><div class="block-title">Изменения:</div><div class="block-body">…</div></div>
 *     <b>Скачать:</b> <a class="ipb-attach attach-file" href="…/forum/dl/post/36574014/App_0.34.apk">App_0.34.apk</a> ( 1.95 МБ )
 *     <div class="post-block spoil"><div class="block-title">Прошлые версии</div>…older APKs…</div>
 *
 * Many headers don't attach the APK themselves: "Скачать" links to a later post
 * (`…showtopic=1&view=findpost&p=2`). Those post ids come back as `downloadPostIds`;
 * the client fetches that post and reads it with `parsePost`.
 *
 * Markup changes, so everything is defensive and every field but the title may be missing.
 * Fixtures live in __fixtures__/. When parsing fails the app offers "Open topic on 4PDA".
 */

export const TopicFileSchema = z.object({
  attachId: z.number().int().positive(),
  name: z.string().min(1),
  url: z.url(),
  sizeBytes: z.number().int().nonnegative().nullable(),
});

export const PostSchema = z.object({
  version: z.string().nullable(),
  changelog: z.array(z.string()),
  files: z.array(TopicFileSchema),
});

export const ModSchema = z.object({
  version: z.string().min(1),
  /** The post that attaches the mod's APKs (a `findpost` link in the header). */
  postId: z.number().int().positive(),
  /** Link text as posted, e.g. "Plus (NURIK)". */
  label: z.string().nullable(),
});

export const TopicSchema = PostSchema.extend({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().nullable(),
  category: z.string().nullable(),
  isBeta: z.boolean(),
  packageName: z.string().nullable(),
  headerUpdated: z.string().nullable(),
  /** Posts the header's download section points to, when it attaches no APK itself. */
  downloadPostIds: z.array(z.number().int().positive()),
  /** Mods listed in the header's "Модификации" spoiler, newest first as posted. */
  mods: z.array(ModSchema),
  /** Set when version and files come from a mod newer than the official build. */
  mod: z.string().nullable(),
  /** The header's first picture outside spoilers: by forum convention, the app's icon. */
  iconUrl: z.url().nullable(),
});

export type Topic = z.infer<typeof TopicSchema>;
export type TopicFile = z.infer<typeof TopicFileSchema>;
export type Post = z.infer<typeof PostSchema>;
export type Mod = z.infer<typeof ModSchema>;

export class TopicParseError extends Error {
  constructor(public readonly code: 'login-required' | 'no-first-post' | 'no-title' | 'no-post') {
    super(code);
    this.name = 'TopicParseError';
  }
}

const APK = /\.(apk|apks|xapk|apkm)$/i;
const OLD_VERSIONS = /прошл|предыдущ|стар|архив|old|previous|history|другим именем/i;
const SKIP_SPOILERS = /скриншот|screenshot|скрины/i;
const MODS = /модифи|^mods?\b/i;
const CHANGELOG = /измен|что нового|новое в|changelog|what'?s new|история версий/i;
const DOWNLOAD = /Скачать|Download/i;
const VERSION =
  /(?:Версия|Version)\s*:?\s*(?:<[^>]+>\s*)*v?([0-9][\w.+-]*(?:\s+(?:beta|alpha|rc|build)\s*[\w.]*)?)/i;
const FILE_VERSION = /[_\-\s]v?(\d+(?:\.\d+)+(?:[-_.]?(?:beta|alpha|rc)\.?\d*)?)/i;
const PACKAGE = /Имя пакета|Package(?: name)?/i;
const PACKAGE_ID = /\b([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\b/i;
const HEADER_DATE = /Последнее обновление[^:]*:\s*(?:<[^>]+>\s*)*(\d{1,2}\.\d{1,2}\.\d{4})/i;

const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** "1.95 МБ" → bytes. */
export function parseSize(text: string): number | null {
  // No \b: JS word boundaries ignore Cyrillic, so "МБ" would never end a word.
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(ГБ|МБ|КБ|Б|GB|MB|KB|B)(?![A-Za-zА-Яа-яЁё])/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(',', '.'));
  const unit = m[2].toUpperCase();
  const mult =
    unit === 'ГБ' || unit === 'GB'
      ? 1024 ** 3
      : unit === 'МБ' || unit === 'MB'
        ? 1024 ** 2
        : unit === 'КБ' || unit === 'KB'
          ? 1024
          : 1;
  return Math.round(n * mult);
}

/** Title of the spoiler an element sits in, if any. */
function spoilerTitle(el: HTMLElement, body: HTMLElement): string | null {
  for (
    let node: HTMLElement | null = el.parentNode;
    node && node !== body;
    node = node.parentNode
  ) {
    if (node.classList?.contains('post-block') && node.classList.contains('spoil')) {
      return clean(node.querySelector('.block-title')?.text ?? '');
    }
  }
  return null;
}

function inOldOrMedia(el: HTMLElement, body: HTMLElement) {
  const t = spoilerTitle(el, body);
  return !!t && (OLD_VERSIONS.test(t) || SKIP_SPOILERS.test(t) || MODS.test(t));
}

function fileFromLink(a: HTMLElement): TopicFile | null {
  const href = a.getAttribute('href') ?? '';
  const id = href.match(/\/forum\/dl\/post\/(\d+)\//)?.[1];
  if (!id) return null;
  let name = clean(a.text);
  if (!name) {
    const last = href.split('/').pop() ?? '';
    try {
      name = decodeURIComponent(last.replace(/\+/g, ' '));
    } catch {
      name = last;
    }
  }
  if (!APK.test(name)) return null;
  // The size follows the link as a text node: " ( 1.95 МБ )".
  let sizeBytes: number | null = null;
  const siblings = a.parentNode?.childNodes ?? [];
  const next = siblings[siblings.indexOf(a) + 1];
  if (next && next.nodeType === NodeType.TEXT_NODE) {
    const size = next.rawText.match(/^\s*\(([^)]*)\)/)?.[1];
    if (size) sizeBytes = parseSize(size);
  }
  const url = href.startsWith('//') ? `https:${href}` : href.replace(/^http:/, 'https:');
  return { attachId: Number(id), name, url, sizeBytes };
}

function filesIn(body: HTMLElement): TopicFile[] {
  const out: TopicFile[] = [];
  for (const a of body.querySelectorAll('a')) {
    if (!/\/forum\/dl\/post\/\d+\//.test(a.getAttribute('href') ?? '')) continue;
    if (inOldOrMedia(a, body)) continue;
    const f = fileFromLink(a);
    if (f && !out.some((c) => c.attachId === f.attachId)) out.push(f);
  }
  return out;
}

/** Changelog spoiler → one entry per line, forum markup and bullets stripped, text as posted. */
function changelogIn(body: HTMLElement): string[] {
  for (const block of body.querySelectorAll('.post-block.spoil')) {
    const title = clean(block.querySelector('.block-title')?.text ?? '');
    if (!CHANGELOG.test(title)) continue;
    const content = block.querySelector('.block-body');
    if (!content) continue;
    return parse(content.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n'))
      .text.split('\n')
      .map((l) => clean(l).replace(/^[•·\-*–—▪◦●]+\s*/, ''))
      .filter((l) => l.length > 1)
      .slice(0, 40);
  }
  return [];
}

function versionIn(body: HTMLElement, files: TopicFile[]): string | null {
  const v = body.innerHTML.match(VERSION)?.[1]?.trim();
  if (v) return v;
  for (const f of files) {
    const fv = f.name.match(FILE_VERSION)?.[1];
    if (fv) return fv;
  }
  return null;
}

function readPost(body: HTMLElement): Post {
  const files = filesIn(body);
  return { version: versionIn(body, files), changelog: changelogIn(body), files };
}

function findpostId(a: HTMLElement): number | null {
  const href = (a.getAttribute('href') ?? '').replace(/&amp;/g, '&');
  const p =
    href.match(/[?&]view=findpost&p=(\d+)/)?.[1] ?? href.match(/[?&]p=(\d+).*view=findpost/)?.[1];
  return p ? Number(p) : null;
}

/**
 * The header's "Модификации" spoiler: one line per mod, `<b>Версия: 5.205.0.1815</b> <a
 * href="…findpost&p=…">Plus (NURIK)</a>`. Lines without a version or a post link are skipped.
 */
function modsIn(body: HTMLElement): Mod[] {
  const out: Mod[] = [];
  for (const block of body.querySelectorAll('.post-block.spoil')) {
    if (!MODS.test(clean(block.querySelector('.block-title')?.text ?? ''))) continue;
    const content = block.querySelector('.block-body');
    if (!content) continue;
    for (const line of content.innerHTML.split(/<br\s*\/?>/i)) {
      const version = line.match(VERSION)?.[1]?.trim();
      const link = parse(line)
        .querySelectorAll('a')
        .map((a) => ({ id: findpostId(a), label: clean(a.text) || null }))
        .find((l) => l.id);
      if (version && link?.id && !out.some((m) => m.postId === link.id)) {
        out.push({ version, postId: link.id, label: link.label });
      }
    }
  }
  return out;
}

/**
 * Headers open with the app's icon (`<img class="linked-image">`) before any spoiler. Skip
 * spoiler content (screenshots), attachment clips and emoticons. The app still checks the
 * image is square before showing it, in case a header opens with a banner instead.
 */
function iconIn(body: HTMLElement): string | null {
  for (const img of body.querySelectorAll('img')) {
    if (spoilerTitle(img, body) !== null) continue;
    if (img.closest('a.attach-file')) continue;
    const src = img.getAttribute('src') ?? '';
    if (/emoticon|smiles?\//i.test(src) || img.classList.contains('emoticon')) continue;
    const url = src.startsWith('//') ? `https:${src}` : src.replace(/^http:/, 'https:');
    if (/^https:\/\/[^\s"']+\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) return url;
  }
  return null;
}

/** `findpost&p=<id>` links after the header's "Скачать" marker, outside old-version spoilers. */
function downloadLinksIn(body: HTMLElement): number[] {
  // Source offset of the first "Скачать" text; `range` is the node's position in the page.
  let markerAt = -1;
  const walk = (node: HTMLElement): boolean => {
    for (const child of node.childNodes) {
      if (child.nodeType === NodeType.TEXT_NODE && DOWNLOAD.test(child.rawText)) {
        markerAt = child.range[0];
        return true;
      }
      if (child.nodeType === NodeType.ELEMENT_NODE && walk(child as HTMLElement)) return true;
    }
    return false;
  };
  if (!walk(body)) return [];
  const ids: number[] = [];
  for (const a of body.querySelectorAll('a')) {
    const id = findpostId(a);
    if (!id) continue;
    if (a.range[0] < markerAt) continue;
    if (inOldOrMedia(a, body)) continue;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function parseTopic(html: string, topicId: number): Topic {
  const root = parse(html, { blockTextElements: { script: false, style: false } });

  const body = root.querySelector('div.post_body');
  if (!body) {
    if (/act=auth|name="login"|Авторизация/i.test(html))
      throw new TopicParseError('login-required');
    throw new TopicParseError('no-first-post');
  }

  const titleBlock = root.querySelector('.topic_title_post');
  const titleText = titleBlock
    ? clean(
        titleBlock.childNodes
          .filter((n) => n.nodeType === NodeType.TEXT_NODE)
          .map((n) => n.text)
          .join(' '),
      )
    : clean(root.querySelector('title')?.text.replace(/\s*-\s*4PDA\s*$/i, '') ?? '');
  const [rawTitle, ...rest] = titleText.split(' | ');
  const title = clean(rawTitle ?? '');
  if (!title) throw new TopicParseError('no-title');
  const description = rest.length ? clean(rest.join(' | ')) : null;

  const crumbs = root.querySelectorAll('#navstrip a');
  const category = crumbs.length
    ? clean(crumbs[crumbs.length - 1].text).replace(/^Android\s*-\s*/i, '')
    : null;

  const post = readPost(body);
  let version = post.version;
  if (!version && description) version = description.match(/\b(\d+(?:\.\d+)+)\b/)?.[1] ?? null;

  let packageName: string | null = null;
  const text = body.text;
  const pkgAt = text.search(PACKAGE);
  if (pkgAt >= 0) {
    const after = text
      .slice(pkgAt, pkgAt + 160)
      .split(':')
      .slice(1)
      .join(':');
    packageName = after.match(PACKAGE_ID)?.[1] ?? null;
  }

  return TopicSchema.parse({
    id: topicId,
    title,
    description,
    category,
    version,
    isBeta: version ? isPrerelease(version) : false,
    packageName,
    headerUpdated: body.innerHTML.match(HEADER_DATE)?.[1] ?? null,
    changelog: post.changelog,
    files: post.files,
    downloadPostIds: post.files.length ? [] : downloadLinksIn(body),
    mods: modsIn(body),
    mod: null,
    iconUrl: iconIn(body),
  } satisfies Topic);
}

/** One post on a topic page (the target of a `findpost` link). */
export function parsePost(html: string, postId: number): Post {
  const root = parse(html, { blockTextElements: { script: false, style: false } });
  const body = root.getElementById(`post-main-${postId}`);
  if (!body) throw new TopicParseError('no-post');
  return PostSchema.parse(readPost(body));
}
