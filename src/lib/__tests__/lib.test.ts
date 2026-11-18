import { abiFromFileName, fileNamePattern, pickFile } from '../abi';
import {
  formatDay,
  formatEta,
  formatRelative,
  formatSize,
  formatTransferred,
  meta,
} from '../format';
import { hasUpdate } from '../updates';
import { compareVersions, isNewer, isPrerelease } from '../version';

describe('compareVersions', () => {
  it.each([
    ['4.13.1541', '4.12.1531', 1],
    ['6.69.0', '6.68.2', 1],
    ['3.6.5', '3.6.5', 0],
    ['1.0', '1.0.1', -1],
    ['6.70.0-beta1', '6.70.0', -1],
    ['6.70.0-beta2', '6.70.0-beta1', 1],
    ['1.2.0-RC.2', '1.2.0-Beta.4', 1],
    ['v2.0', '1.9.9', 1],
    ['0.34', '0.33', 1],
    ['10.0', '9.9', 1],
  ])('%s vs %s', (a, b, sign) => expect(Math.sign(compareVersions(a, b))).toBe(sign));

  it('treats any version as newer than nothing installed', () => {
    expect(isNewer('1.0', null)).toBe(true);
    expect(isNewer(null, '1.0')).toBe(false);
  });

  it('spots pre-releases', () => {
    expect(isPrerelease('6.70.0-beta1')).toBe(true);
    expect(isPrerelease('1.2.0-RC.2')).toBe(true);
    expect(isPrerelease('4.13.1541')).toBe(false);
  });
});

describe('hasUpdate', () => {
  const base = {
    latestVersion: '2.0',
    installedVersion: '1.0',
    ignoredVersion: null,
    latestIsBeta: false,
    notifyBetas: null,
  };
  it('offers newer versions', () => expect(hasUpdate(base, false)).toBe(true));
  it('skips the same version', () =>
    expect(hasUpdate({ ...base, installedVersion: '2.0' }, false)).toBe(false));
  it('skips an ignored version', () =>
    expect(hasUpdate({ ...base, ignoredVersion: '2.0' }, false)).toBe(false));
  it('offers not-installed apps', () =>
    expect(hasUpdate({ ...base, installedVersion: null }, false)).toBe(true));
  it('mutes betas unless turned on globally or per app', () => {
    const beta = { ...base, latestVersion: '2.0-beta1', latestIsBeta: true };
    expect(hasUpdate(beta, false)).toBe(false);
    expect(hasUpdate(beta, true)).toBe(true);
    expect(hasUpdate({ ...beta, notifyBetas: true }, false)).toBe(true);
    expect(hasUpdate({ ...beta, notifyBetas: false }, true)).toBe(false);
  });
});

describe('abi', () => {
  it.each([
    ['AIMP_v4.13.1541_arm64-v8a.apk', 'arm64-v8a'],
    ['MeeTubeTV_1.1.1_armeabi-v7a.apk', 'armeabi-v7a'],
    ['app-x86_64-release.apk', 'x86_64'],
    ['VLC-Android-3.6.5-x86.apk', 'x86'],
    ['MeeTubeTV_1.1.1_universal.apk', 'universal'],
    ['MLauncher_0.34.apk', null],
  ])('%s → %s', (name, abi) => expect(abiFromFileName(name)).toBe(abi));

  const files = [
    { name: 'App_1.1_universal.apk' },
    { name: 'App_1.1_armeabi-v7a.apk' },
    { name: 'App_1.1_arm64-v8a.apk' },
    { name: 'App_1.1_arm64-v8a_mod.apk' },
  ];

  it('picks the phone’s best ABI, skipping mods', () => {
    expect(pickFile(files, ['arm64-v8a', 'armeabi-v7a'])?.name).toBe('App_1.1_arm64-v8a.apk');
    expect(pickFile(files, ['armeabi-v7a'])?.name).toBe('App_1.1_armeabi-v7a.apk');
    expect(pickFile(files, ['x86_64'])?.name).toBe('App_1.1_universal.apk');
  });

  it('honours the preferred build, then the remembered pattern', () => {
    expect(pickFile(files, ['arm64-v8a'], { preferredAbi: 'universal' })?.name).toBe(
      'App_1.1_universal.apk',
    );
    const pattern = fileNamePattern('App_1.0_arm64-v8a_mod.apk');
    expect(pickFile(files, ['arm64-v8a'], { rememberedPattern: pattern })?.name).toBe(
      'App_1.1_arm64-v8a_mod.apk',
    );
  });

  it('picks a zipped build for the phone when the post only has archives', () => {
    const zips = [
      { name: 'OsmAnd+-Live-v5.5.0-Mod-armeabi-v7a.zip' },
      { name: 'OsmAnd+-Live-v5.5.0-Mod-arm64-v8a.zip' },
    ];
    expect(pickFile(zips, ['arm64-v8a', 'armeabi-v7a'])?.name).toBe(
      'OsmAnd+-Live-v5.5.0-Mod-arm64-v8a.zip',
    );
  });

  it('remembers a build across versions', () => {
    expect(fileNamePattern('SamplePlayer_v4.12.1531_arm64-v8a.apk')).toBe(
      fileNamePattern('SamplePlayer_v4.13.1541_arm64-v8a.apk'),
    );
  });

  it('ignores non-APK files', () => {
    expect(pickFile([{ name: 'notes.txt' }], ['arm64-v8a'])).toBeNull();
  });
});

describe('format', () => {
  const MB = 1024 * 1024;
  it('sizes: no decimals above 10 MB', () => {
    expect(formatSize(18.03 * MB)).toBe('18 MB');
    expect(formatSize(9.4 * MB)).toBe('9.4 MB');
    expect(formatSize(2 * MB)).toBe('2 MB');
    expect(formatSize(500 * 1024)).toBe('500 KB');
    expect(formatSize(null)).toBe('');
  });

  it('transferred: "25.4 of 41 MB"', () => {
    expect(formatTransferred(25.4 * MB, 41 * MB)).toBe('25.4 of 41 MB');
  });

  it('relative times under a day, then dates', () => {
    const now = new Date(2026, 10, 18, 12, 0).getTime();
    expect(formatRelative(now - 30_000, now)).toBe('just now');
    expect(formatRelative(now - 12 * 60_000, now)).toBe('12 min ago');
    expect(formatRelative(now - 2 * 3_600_000, now)).toBe('2 h ago');
    expect(formatRelative(new Date(2026, 10, 16, 9, 0).getTime(), now)).toBe('16 Nov');
  });

  it('day headers', () => {
    const now = new Date(2026, 10, 18, 12, 0).getTime();
    expect(formatDay(new Date(2026, 10, 18, 1, 0).getTime(), now)).toBe('Today');
    expect(formatDay(new Date(2026, 10, 17, 23, 0).getTime(), now)).toBe('Yesterday');
    expect(formatDay(new Date(2026, 10, 1, 9, 0).getTime(), now)).toBe('1 Nov');
  });

  it('eta and meta', () => {
    expect(formatEta(5)).toBe('5 s left');
    expect(formatEta(130)).toBe('3 min left');
    expect(meta('18 MB', null, 'checked 12 min ago', '')).toBe('18 MB, checked 12 min ago');
  });
});
