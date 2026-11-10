import { resolveBackendBuild } from './backend-build';

describe('resolveBackendBuild (Part B Step 2)', () => {
  it('takes APP_VERSION / APP_BUILD / APP_COMMIT when CI sets them', () => {
    expect(
      resolveBackendBuild({ APP_VERSION: ' 1.2.0 ', APP_BUILD: '57', APP_COMMIT: 'aa10be0d' }),
    ).toEqual({ version: '1.2.0', build: 57, commit: 'aa10be0d' });
  });

  it('falls back to package.json for the version; build and commit stay null', () => {
    const resolved = resolveBackendBuild({}, __dirname);
    expect(resolved.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(resolved.build).toBeNull();
    expect(resolved.commit).toBeNull();
  });

  it("a bad APP_BUILD reads as null and never throws; no package.json at all reads 'unknown'", () => {
    expect(resolveBackendBuild({ APP_BUILD: 'abc' }, '/').build).toBeNull();
    expect(resolveBackendBuild({ APP_BUILD: '-3' }, '/').build).toBeNull();
    expect(resolveBackendBuild({}, '/').version).toBe('unknown');
  });
});
