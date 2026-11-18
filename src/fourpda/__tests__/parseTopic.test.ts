/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encode } from 'windows-1251';

import { charsetOf, decodeHtml } from '../decode';
import { parsePost, parseSize, parseTopic, TopicParseError } from '../parseTopic';
import { parseSearch } from '../parseSearch';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8');

/** Fixtures are stored as UTF-8 for review; pages arrive as windows-1251 bytes. */
const asCp1251 = (html: string) => new Uint8Array(encode(html, { mode: 'replacement' }));

describe('decodeHtml', () => {
  it('decodes windows-1251 by the Content-Type charset', () => {
    const html = fixture('topic-direct.html');
    expect(decodeHtml(asCp1251(html), 'text/html; charset=windows-1251')).toContain(
      'Последнее обновление',
    );
  });

  it('falls back to the <meta> charset, then windows-1251', () => {
    expect(charsetOf(null, new TextEncoder().encode('<meta charset="utf-8">'))).toBe('utf-8');
    expect(charsetOf(undefined, new TextEncoder().encode('<html>'))).toBe('windows-1251');
  });

  it('decodes UTF-8 when the page says so', () => {
    const bytes = new TextEncoder().encode('<p>Версия</p>');
    expect(decodeHtml(bytes, 'text/html; charset=UTF-8')).toBe('<p>Версия</p>');
  });
});

describe('parseTopic — header with attached APKs', () => {
  const topic = parseTopic(
    decodeHtml(asCp1251(fixture('topic-direct.html')), 'text/html; charset=windows-1251'),
    555001,
  );

  it('reads the title, description and section', () => {
    expect(topic.title).toBe('Sample Player');
    expect(topic.description).toBe('Музыкальный плеер с эквалайзером');
    expect(topic.category).toBe('Мультимедиа');
  });

  it('reads the version, package name and header date as posted', () => {
    expect(topic.version).toBe('4.13.1541');
    expect(topic.isBeta).toBe(false);
    expect(topic.packageName).toBe('com.example.sampleplayer');
    expect(topic.headerUpdated).toBe('16.11.2026');
  });

  it('takes current APKs only: not old versions, screenshots or other files', () => {
    expect(topic.files.map((f) => f.name)).toEqual([
      'SamplePlayer_v4.13.1541_arm64-v8a.apk',
      'SamplePlayer_v4.13.1541_universal.apk',
    ]);
    expect(topic.files[0]).toMatchObject({
      attachId: 700010,
      url: 'https://4pda.to/forum/dl/post/700010/SamplePlayer_v4.13.1541_arm64-v8a.apk',
      sizeBytes: Math.round(18.03 * 1024 * 1024),
    });
    expect(topic.files[1].sizeBytes).toBe(Math.round(31.2 * 1024 * 1024));
    expect(topic.downloadPostIds).toEqual([]);
  });

  it('keeps the changelog as posted, without bullets or markup', () => {
    expect(topic.changelog).toEqual([
      '🚀 Пресеты эквалайзера можно закрепить',
      'Быстрее сканирование библиотеки на SD-картах',
      'Исправлено: воспроизведение останавливалось после переподключения Bluetooth',
    ]);
  });
});

describe('parseTopic — header linking to a later post', () => {
  const html = fixture('topic-linked.html');
  const topic = parseTopic(html, 555002);

  it('reads the header and points at the download post, not other findpost links', () => {
    expect(topic.title).toBe('Tube TV');
    expect(topic.version).toBe('1.2.0-RC.2');
    expect(topic.isBeta).toBe(true);
    expect(topic.files).toEqual([]);
    expect(topic.downloadPostIds).toEqual([146000099]);
  });

  it('parses the linked post for its files and changelog', () => {
    const post = parsePost(html, 146000099);
    expect(post.version).toBe('1.2.0-RC.2');
    expect(post.files.map((f) => f.name)).toEqual([
      'TubeTV_1.2.0-RC.2_universal.apk',
      'TubeTV_1.2.0-RC.2_arm64-v8a.apk',
      'TubeTV_1.2.0-RC.2_armeabi-v7a.apk',
    ]);
    expect(post.changelog).toEqual([
      'Часы на экране плеера синхронизированы',
      'Боковая панель доходит до края экрана',
    ]);
  });
});

describe('parseTopic — newer builds only as mods', () => {
  const html = fixture('topic-mods.html');
  const topic = parseTopic(html, 555003);

  it('keeps the official version and files, without old versions or mod attachments', () => {
    expect(topic.version).toBe('5.144.0.1632');
    expect(topic.files.map((f) => f.name)).toEqual(['Transit 5.144.0.1632.apk']);
    expect(topic.mod).toBeNull();
  });

  it('takes the header icon: not emoticons or screenshots in spoilers', () => {
    expect(topic.iconUrl).toBe('https://4pda.to/s/as6yxZENBVwcHAT4ewvmIIkKcookNGz2oXwI.png');
  });

  it('lists the mods with their posts, as posted', () => {
    expect(topic.mods).toEqual([
      { version: '5.205.0.1815', postId: 146100099, label: 'Plus (NURIK)' },
      { version: '5.204.1.1814', postId: 146100098, label: 'Plus (NURIK)' },
    ]);
  });

  it('parses the mod post for its per-ABI files', () => {
    const post = parsePost(html, 146100099);
    expect(post.version).toBe('5.205.0.1815');
    expect(post.changelog).toEqual(['Значок пробок рядом с вашей линией.']);
    expect(post.files.map((f) => [f.name, f.sizeBytes])).toEqual([
      ['Transit v5.205.0.1815 (1815) armeabi-v7a.apk', Math.round(38.6 * 1024 ** 2)],
      ['Transit v5.205.0.1815 (1815) arm64-v8a.apk', Math.round(39.15 * 1024 ** 2)],
    ]);
  });
});

describe('parseTopic — failures', () => {
  it('recognises the login page', () => {
    const html =
      '<html><body><form action="index.php?act=auth" method="post"><input name="login"></form></body></html>';
    expect(() => parseTopic(html, 1)).toThrow(new TopicParseError('login-required'));
  });

  it('refuses a page without a first post', () => {
    expect(() => parseTopic('<html><body><p>Тема не найдена</p></body></html>', 1)).toThrow(
      TopicParseError,
    );
  });

  it('refuses a missing post id', () => {
    expect(() => parsePost(fixture('topic-linked.html'), 1)).toThrow(
      new TopicParseError('no-post'),
    );
  });
});

describe('parseSize', () => {
  it.each([
    ['1.95 МБ', Math.round(1.95 * 1024 ** 2)],
    ['31,2 МБ', Math.round(31.2 * 1024 ** 2)],
    ['849.35 КБ', Math.round(849.35 * 1024)],
    ['1.2 ГБ', Math.round(1.2 * 1024 ** 3)],
    ['18 MB', 18 * 1024 ** 2],
    ['no size', null],
  ])('%s', (text, bytes) => expect(parseSize(text)).toBe(bytes));
});

describe('parseSearch', () => {
  it('returns one hit per topic and skips jump links', () => {
    expect(parseSearch(fixture('search.html'))).toEqual([
      { topicId: 555001, title: 'Sample Player', description: 'Музыкальный плеер с эквалайзером' },
      { topicId: 555003, title: 'Sample Player Remote', description: null },
    ]);
  });
});
