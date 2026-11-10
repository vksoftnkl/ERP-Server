import {
  EMPTY_CLIENT_INFO,
  clientInfoOf,
  hasClientBuild,
  parseClientBuild,
  parseClientInfo,
} from './client-info';

describe('parseClientInfo (Part B Step 2)', () => {
  it('reads all six headers', () => {
    expect(
      parseClientInfo({
        'x-app-platform': 'Desktop',
        'x-app-build': '10',
        'x-app-version': '1.2.0',
        'x-app-commit': 'aa10be0d',
        'x-device-id': 'pc-1',
        'x-device-os': 'Windows 11 23H2',
      }),
    ).toEqual({
      platform: 'desktop',
      build: 10,
      version: '1.2.0',
      commit: 'aa10be0d',
      deviceId: 'pc-1',
      deviceOs: 'Windows 11 23H2',
    });
  });

  it('an old build (no headers) reads as all-null, and never throws on junk', () => {
    expect(parseClientInfo({})).toEqual(EMPTY_CLIENT_INFO);
    expect(parseClientInfo(undefined)).toEqual(EMPTY_CLIENT_INFO);
    expect(parseClientInfo(null)).toEqual(EMPTY_CLIENT_INFO);
    expect(
      parseClientInfo({ 'x-app-platform': 'ios', 'x-app-build': '1.2', 'x-app-version': '   ' }),
    ).toEqual(EMPTY_CLIENT_INFO);
  });

  it.each([
    ['0', null],
    ['-1', null],
    ['12abc', null],
    ['1e3', null],
    [' 42 ', null], // headerText trims; parseClientBuild alone does not
    ['2147483647', 2147483647],
    ['2147483648', null],
    ['99999999999', null],
    ['007', 7],
  ])('build %p -> %p', (raw, expected) => {
    expect(parseClientBuild(raw)).toBe(expected);
  });

  it('trims header values, drops control characters and cuts to the column width', () => {
    const info = parseClientInfo({
      'x-app-build': ' 42 ',
      'x-device-id': `pc\u0000-1\r\n`,
      'x-app-version': 'v'.repeat(50),
      'x-device-os': ['', 'Linux'],
    });
    expect(info.build).toBe(42);
    expect(info.deviceId).toBe('pc-1');
    expect(info.version).toHaveLength(32);
    expect(info.deviceOs).toBe('Linux');
  });

  it('hasClientBuild needs BOTH platform and build', () => {
    expect(hasClientBuild(parseClientInfo({ 'x-app-platform': 'web' }))).toBe(false);
    expect(hasClientBuild(parseClientInfo({ 'x-app-build': '3' }))).toBe(false);
    expect(hasClientBuild(parseClientInfo({ 'x-app-platform': 'web', 'x-app-build': '3' }))).toBe(
      true,
    );
    expect(hasClientBuild(null)).toBe(false);
  });

  it('clientInfoOf prefers what the middleware attached, else parses the headers', () => {
    const attached = { ...EMPTY_CLIENT_INFO, platform: 'mobile' as const, build: 5 };
    expect(clientInfoOf({ headers: {}, clientInfo: attached })).toBe(attached);
    expect(
      clientInfoOf({ headers: { 'x-app-platform': 'web', 'x-app-build': '9' } }),
    ).toMatchObject({ platform: 'web', build: 9 });
    expect(clientInfoOf(undefined)).toEqual(EMPTY_CLIENT_INFO);
  });
});
