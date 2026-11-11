import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCompatManifest, locateCompatManifest, parseCompatManifest } from './compat-manifest';

const parse = (value: unknown, appBuild = 57) =>
  parseCompatManifest(
    typeof value === 'string' ? value : JSON.stringify(value),
    appBuild,
    '/m.json',
  );

describe('compat manifest (Part B Step 2 Rev 2)', () => {
  it('reads every platform; a platform left out expects nothing', () => {
    const result = parse({
      backendBuild: 57,
      generatedAt: '2026-11-11T10:00:00Z',
      clients: {
        desktop: {
          expectedBuild: 120,
          enforce: true,
          message: ' Please update ',
          downloadUrl: 'https://x/setup.exe',
        },
        web: { expectedBuild: 57 },
      },
    });
    expect(result).toEqual({
      ok: true,
      manifest: {
        path: '/m.json',
        backendBuild: 57,
        clients: {
          desktop: {
            expectedBuild: 120,
            enforce: true,
            message: 'Please update',
            downloadUrl: 'https://x/setup.exe',
          },
          // enforce defaults to false
          web: { expectedBuild: 57, enforce: false, message: null, downloadUrl: null },
          mobile: { expectedBuild: null, enforce: false, message: null, downloadUrl: null },
        },
      },
    });
  });

  it('backendBuild is optional, but when given it must be this APP_BUILD', () => {
    expect(parse({ clients: {} }).ok).toBe(true);
    expect(parse({ backendBuild: 56, clients: {} })).toMatchObject({
      ok: false,
      reason: "backendBuild 56 is not this backend's APP_BUILD 57",
    });
  });

  it.each([
    ['not JSON', '{oops', 'it is not valid JSON'],
    ['an array', [], 'it is not a JSON object'],
    ['no clients', { backendBuild: 57 }, 'clients is missing or not an object'],
    ['an unknown top key', { clients: {}, extra: 1 }, 'unknown key(s) extra'],
    ['an unknown platform', { clients: { tv: {} } }, 'unknown platform(s) tv'],
    [
      'enforce without a build',
      { clients: { desktop: { enforce: true } } },
      'clients.desktop: enforce is true but expectedBuild is missing',
    ],
    [
      'a zero build',
      { clients: { web: { expectedBuild: 0 } } },
      'clients.web: expectedBuild must be an integer',
    ],
    [
      'a string enforce',
      { clients: { web: { expectedBuild: 3, enforce: 'yes' } } },
      'clients.web: enforce must be true or false',
    ],
    [
      'an unknown entry key',
      { clients: { web: { build: 3 } } },
      'clients.web: unknown key(s) build',
    ],
  ])('rejects the whole manifest on %s', (_label, value, reason) => {
    const result = parse(value);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toContain(reason);
  });

  describe('where it is found', () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'compat-'));
      writeFileSync(join(dir, 'package.json'), '{}');
      mkdirSync(join(dir, 'dist', 'src'), { recursive: true });
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('beside the package.json above the code, else nowhere', () => {
      const start = join(dir, 'dist', 'src');
      expect(locateCompatManifest({}, start, null)).toBeNull();
      writeFileSync(join(dir, 'compat-manifest.json'), '{"clients":{}}');
      expect(locateCompatManifest({}, start, null)).toBe(join(dir, 'compat-manifest.json'));
    });

    it('APP_COMPAT_MANIFEST wins, and a missing file there is reported, not skipped', () => {
      writeFileSync(join(dir, 'compat-manifest.json'), '{"clients":{}}');
      const elsewhere = join(dir, 'ci', 'manifest.json');
      const env = { APP_COMPAT_MANIFEST: elsewhere };
      expect(locateCompatManifest(env, join(dir, 'dist', 'src'), null)).toBe(elsewhere);
      expect(loadCompatManifest(57, env, join(dir, 'dist', 'src'))).toMatchObject({
        ok: false,
        path: elsewhere,
      });
    });

    it('beside the packed exe before the package root', () => {
      const exeDir = join(dir, 'install');
      mkdirSync(exeDir);
      writeFileSync(join(exeDir, 'compat-manifest.json'), '{"clients":{}}');
      writeFileSync(join(dir, 'compat-manifest.json'), '{"clients":{}}');
      expect(
        locateCompatManifest({}, join(dir, 'dist', 'src'), join(exeDir, 'erp-server.exe')),
      ).toBe(join(exeDir, 'compat-manifest.json'));
    });
  });
});
