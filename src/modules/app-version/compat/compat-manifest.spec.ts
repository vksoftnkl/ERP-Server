import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCompatManifest, parseCompatManifest } from './compat-manifest';

const parse = (value: unknown, appBuild = 1057) => parseCompatManifest(value, appBuild, '/c.json');
const NONE = { expectedBuild: null, message: null, downloadUrl: null };

describe('compat.json (Part B Step 4)', () => {
  it('reads a number, an object or nothing per platform', () => {
    expect(
      parse({
        backendBuild: 1057,
        generatedAt: '2026-11-11T10:00:00Z',
        clients: {
          web: 24,
          desktop: { expectedBuild: 120, message: ' Update ', downloadUrl: 'https://x/120.exe' },
          mobile: null,
        },
      }),
    ).toEqual({
      ok: true,
      manifest: {
        path: '/c.json',
        backendBuild: 1057,
        clients: {
          web: { expectedBuild: 24, message: null, downloadUrl: null },
          desktop: { expectedBuild: 120, message: 'Update', downloadUrl: 'https://x/120.exe' },
          // null or left out = no new value (the stored one stays)
          mobile: NONE,
        },
      },
    });
    expect(parse({ clients: {} })).toMatchObject({
      ok: true,
      manifest: { clients: { web: NONE, desktop: NONE, mobile: NONE } },
    });
  });

  it('never carries enforce: a manifest that does is refused (enforce is an admin call)', () => {
    const result = parse({ clients: { desktop: { expectedBuild: 120, enforce: true } } });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toContain('enforce is not read from compat.json');
  });

  it('backendBuild is optional, but when given it must be this build', () => {
    expect(parse({ backendBuild: 1056, clients: {} })).toMatchObject({
      ok: false,
      reason: "backendBuild 1056 is not this backend's build 1057",
    });
  });

  it.each([
    ['an array', [], 'it is not a JSON object'],
    ['no clients', { backendBuild: 1057 }, 'clients is missing or not an object'],
    ['an unknown top key', { clients: {}, extra: 1 }, 'unknown key(s) extra'],
    ['an unknown platform', { clients: { tv: 3 } }, 'unknown platform(s) tv'],
    ['a zero build', { clients: { web: 0 } }, 'clients.web: a build must be an integer'],
    ['a string build', { clients: { web: '24' } }, 'clients.web: not a build number or an object'],
    [
      'an unknown entry key',
      { clients: { web: { build: 3 } } },
      'clients.web: unknown key(s) build',
    ],
  ])('rejects the whole file on %s', (_label, value, reason) => {
    const result = parse(value);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toContain(reason);
  });

  it('loads from APP_PACKAGE_DIR, and reports a missing or broken file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'compat-'));
    try {
      const env = { APP_PACKAGE_DIR: dir };
      expect(loadCompatManifest(1057, env)).toMatchObject({ ok: false });
      writeFileSync(join(dir, 'compat.json'), '{oops');
      expect(loadCompatManifest(1057, env)).toMatchObject({
        ok: false,
        reason: 'it is not valid JSON',
      });
      writeFileSync(join(dir, 'compat.json'), '﻿{"clients":{"desktop":7}}');
      expect(loadCompatManifest(1057, env)).toMatchObject({
        ok: true,
        manifest: { path: join(dir, 'compat.json'), clients: { desktop: { expectedBuild: 7 } } },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
