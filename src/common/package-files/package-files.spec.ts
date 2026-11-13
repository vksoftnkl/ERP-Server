import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { locatePackageFile, readPackageFile } from './package-files';

describe('package files (Part B Step 4)', () => {
  let dir: string;
  let start: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pkgfiles-'));
    writeFileSync(join(dir, 'package.json'), '{}');
    start = join(dir, 'dist', 'src', 'modules');
    mkdirSync(start, { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('beside the package.json above the running code, else nowhere', () => {
    expect(locatePackageFile('compat.json', {}, start, null)).toBeNull();
    writeFileSync(join(dir, 'compat.json'), '{}');
    expect(locatePackageFile('compat.json', {}, start, null)).toBe(join(dir, 'compat.json'));
  });

  it('beside the packed exe before the package root', () => {
    const exeDir = join(dir, 'install');
    mkdirSync(exeDir);
    writeFileSync(join(exeDir, 'releases.json'), '{}');
    writeFileSync(join(dir, 'releases.json'), '{}');
    expect(locatePackageFile('releases.json', {}, start, join(exeDir, 'erp-server.exe'))).toBe(
      join(exeDir, 'releases.json'),
    );
  });

  it('APP_PACKAGE_DIR is final: a missing file there is reported, not looked for elsewhere', () => {
    writeFileSync(join(dir, 'build-info.json'), '{"build":5}');
    const other = join(dir, 'pkg');
    const env = { APP_PACKAGE_DIR: other };
    expect(locatePackageFile('build-info.json', env, start, null)).toBe(
      join(other, 'build-info.json'),
    );
    expect(readPackageFile('build-info.json', env, start)).toMatchObject({
      found: false,
      path: join(other, 'build-info.json'),
    });
    mkdirSync(other);
    writeFileSync(join(other, 'build-info.json'), '{"build":6}');
    expect(readPackageFile('build-info.json', env, start)).toEqual({
      found: true,
      path: join(other, 'build-info.json'),
      json: { build: 6 },
    });
  });
});
