import { parse, type HTMLElement } from 'node-html-parser';

export interface SearchHit {
  topicId: number;
  title: string;
  description: string | null;
  /** Forum section the topic lives in ("Программы", "Архив программ"). */
  forum: string | null;
}

const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** `…showtopic=123` with nothing else: the topic itself, not a page, post or "new" jump. */
function plainTopicId(a: HTMLElement): number | null {
  const href = (a.getAttribute('href') ?? '').replace(/&amp;/g, '&');
  const m = href.match(/[?&]showtopic=(\d+)(&.*)?$/);
  return m && !m[2] ? Number(m[1]) : null;
}

/**
 * Topic search results, requested with `result=topics` (Nov 2026 markup):
 *
 *   <div data-topic="966470">
 *     <div class="topic_title"><span class="modifier">+</span><a href="…showtopic=966470">Title</a>
 *       … page links (st=…) …</div>
 *     <div class="topic_body"><span class="topic_desc">Description<br />форум: <a>Forum</a><br />
 *       </span><span class="topic_desc">автор: …</span> … getnewpost / getlastpost …</div>
 *   </div>
 *
 * The default posts layout is kept as a fallback: a `.cat_name` heading links to the matching
 * post as "Title, description", and the post's own "открыть тему" link must never become a title.
 */
export function parseSearch(html: string): SearchHit[] {
  const root = parse(html);
  const hits = new Map<number, SearchHit>();

  for (const block of root.querySelectorAll('[data-topic]')) {
    const id = Number(block.getAttribute('data-topic'));
    if (!id || hits.has(id)) continue;
    const link = block
      .querySelectorAll('.topic_title a')
      .find((a) => plainTopicId(a) === id && clean(a.text));
    if (!link) continue;
    const desc = block.querySelector('.topic_desc');
    let description: string | null = null;
    let forum: string | null = null;
    if (desc) {
      // Description is the text before the first <br>; "форум: <a>…</a>" follows it.
      const [first, ...rest] = desc.innerHTML.split(/<br\s*\/?>/i);
      const text = clean(parse(first).text);
      if (text && !/^(форум|автор):/i.test(text)) description = text;
      const forumLine = [first, ...rest].find((l) => /форум:/i.test(l));
      if (forumLine) forum = clean(parse(forumLine).querySelector('a')?.text ?? '') || null;
    }
    hits.set(id, { topicId: id, title: clean(link.text), description, forum });
  }
  if (hits.size) return [...hits.values()];

  for (const a of root.querySelectorAll('.cat_name a')) {
    const href = (a.getAttribute('href') ?? '').replace(/&amp;/g, '&');
    const id = Number(href.match(/[?&]showtopic=(\d+)/)?.[1]);
    const text = clean(a.text);
    if (!id || !text || hits.has(id)) continue;
    const comma = text.indexOf(', ');
    hits.set(id, {
      topicId: id,
      title: comma > 0 ? text.slice(0, comma) : text,
      description: comma > 0 ? text.slice(comma + 2) : null,
      forum: null,
    });
  }
  return [...hits.values()];
}
