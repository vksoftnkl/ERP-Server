import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBackendBuild } from './backend-build';

describe('resolveBackendBuild (Part B Step 2 / Step 4)', () => {
  it('takes APP_VERSION / APP_BUILD / APP_COMMIT when they are set', () => {
    expect(
      resolveBackendBuild({ APP_VERSION: ' 1.2.0 ', APP_BUILD: '57', APP_COMMIT: 'aa10be0d' }),
    ).toEqual({
      version: '1.2.0',
      build: 57,
      commit: 'aa10be0d',
      builtAt: null,
      buildSource: 'env',
    });
  });

  it('falls back to package.json for the version; build and commit stay null', () => {
    const resolved = resolveBackendBuild({}, __dirname);
    expect(resolved.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(resolved.build).toBeNull();
    expect(resolved.commit).toBeNull();
    expect(resolved.buildSource).toBe('none');
  });

  it("a bad APP_BUILD reads as null and never throws; no package.json at all reads 'unknown'", () => {
    expect(resolveBackendBuild({ APP_BUILD: 'abc' }, '/').build).toBeNull();
    expect(resolveBackendBuild({ APP_BUILD: '-3' }, '/').build).toBeNull();
    expect(resolveBackendBuild({}, '/').version).toBe('unknown');
  });

  describe('build-info.json (Step 4: no APP_BUILD needed on-prem)', () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'buildinfo-'));
      writeFileSync(
        join(dir, 'build-info.json'),
        JSON.stringify({
          version: '1.3.0',
          build: 1057,
          commit: 'e48fc511',
          builtAt: '2026-11-11T10:00:00Z',
        }),
      );
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('is read from the package folder', () => {
      expect(resolveBackendBuild({ APP_PACKAGE_DIR: dir })).toEqual({
        version: '1.3.0',
        build: 1057,
        commit: 'e48fc511',
        builtAt: '2026-11-11T10:00:00Z',
        buildSource: 'build-info',
      });
    });

    it('each env var overrides its own field only', () => {
      expect(resolveBackendBuild({ APP_PACKAGE_DIR: dir, APP_BUILD: '2000' })).toMatchObject({
        version: '1.3.0',
        build: 2000,
        commit: 'e48fc511',
        buildSource: 'env',
      });
    });

    it('a malformed file is the same as no file', () => {
      writeFileSync(join(dir, 'build-info.json'), '{"build":"abc"');
      expect(resolveBackendBuild({ APP_PACKAGE_DIR: dir })).toMatchObject({
        build: null,
        buildSource: 'none',
      });
    });
  });
});
