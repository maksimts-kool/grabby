import { parse } from 'node-html-parser';

export interface SearchHit {
  topicId: number;
  title: string;
  description: string | null;
}

/**
 * Topic search results. Every result row links to its topic with a plain `showtopic=<id>`
 * link; links that jump into a topic (getnewpost, getlastpost, findpost) are skipped.
 * Unverified against a signed-in results page — keep the fixture in step with the real one.
 */
export function parseSearch(html: string): SearchHit[] {
  const root = parse(html);
  const hits = new Map<number, SearchHit>();
  for (const a of root.querySelectorAll('a')) {
    const href = a.getAttribute('href') ?? '';
    const m = href.match(/[?&]showtopic=(\d+)(?:&(?:amp;)?(.*))?$/);
    if (!m) continue;
    if (m[2] && /view=|p=|st=/.test(m[2])) continue;
    const title = a.text.replace(/\s+/g, ' ').trim();
    if (!title || /^\d+$/.test(title)) continue;
    const id = Number(m[1]);
    if (hits.has(id)) continue;
    // Only the result's own row: looking higher would borrow a neighbour's description.
    const desc = a.parentNode
      ?.querySelector('.desc, .topic-desc')
      ?.text.replace(/\s+/g, ' ')
      .trim();
    hits.set(id, { topicId: id, title, description: desc || null });
  }
  return [...hits.values()];
}
