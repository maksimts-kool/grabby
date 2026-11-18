import { encodeCp1251, parseTopicLink, searchUrl, topicUrl } from '../urls';

describe('parseTopicLink', () => {
  it.each([
    ['https://4pda.to/forum/index.php?showtopic=1129777', 1129777],
    ['4pda.to/forum/index.php?showtopic=123', 123],
    ['http://4pda.ru/forum/index.php?showtopic=55', 55],
    ['https://4pda.to/forum/index.php?showtopic=1129776&view=findpost&p=146071883', 1129776],
    ['https://4pda.to/forum/index.php?act=findpost&t=987&p=1', 987],
    ['Глянь: https://4pda.to/forum/index.php?showtopic=42 — там новая версия', 42],
  ])('%s → %s', (input, id) => expect(parseTopicLink(input)).toBe(id));

  it.each([
    'https://4pda.to/forum/index.php?showforum=212',
    'https://example.com/forum/index.php?showtopic=1',
    'aimp',
    '',
  ])('%s → null', (input) => expect(parseTopicLink(input)).toBeNull());
});

describe('urls', () => {
  it('builds topic links', () => {
    expect(topicUrl(5)).toBe('https://4pda.to/forum/index.php?showtopic=5');
  });

  it('percent-encodes search queries as windows-1251 bytes', () => {
    expect(encodeCp1251('aimp')).toBe('aimp');
    expect(encodeCp1251('плеер')).toBe('%EF%EB%E5%E5%F0');
    expect(encodeCp1251('a b')).toBe('a%20b');
    expect(searchUrl('плеер')).toContain('query=%EF%EB%E5%E5%F0');
  });
});
