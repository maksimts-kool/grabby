import { encodeCp1251, parseTopicLink, searchUrl, signInRoute, topicUrl } from '../urls';

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

describe('signInRoute', () => {
  it.each([
    ['https://4pda.to/forum/index.php?act=auth', 'allow'],
    ['https://4pda.to/forum/index.php?act=auth&return=https%3A%2F%2F4pda.to%2F', 'allow'],
    ['https://4pda.to/forum/index.php?act=Reg', 'allow'],
    ['https://4pda.to/forum/index.php?act=lostpass', 'allow'],
    ['about:blank', 'allow'],
    ['https://4pda.to/forum/index.php', 'block'],
    ['https://4pda.to/forum/index.php?showtopic=1', 'block'],
    ['https://4pda.to/', 'block'],
    ['intent://scan/#Intent;end', 'block'],
    ['https://vk.com/4pda', 'external'],
    ['https://t.me/four_pda', 'external'],
  ] as const)('%s → %s', (url, route) => expect(signInRoute(url)).toBe(route));
});
