import { parseReleaseList } from './release-list';

const release = (overrides: Record<string, unknown> = {}) => ({
  platform: 'desktop',
  build: 120,
  version: '1.2.0',
  releasedAt: '2026-11-10T09:00:00Z',
  ...overrides,
});

describe('releases.json (Part B Step 4, E4)', () => {
  it('reads every release, yanked ones included, with defaults', () => {
    const result = parseReleaseList(
      {
        generatedAt: '2026-11-11T10:00:00Z',
        releases: [
          release({ commit: 'a1b2', severity: 'critical', notes: ' n ', downloadUrl: '' }),
          release({ build: 119, isDeleted: true }),
        ],
      },
      '/r.json',
    );
    expect(result).toEqual({
      ok: true,
      list: {
        path: '/r.json',
        releases: [
          {
            platform: 'desktop',
            build: 120,
            version: '1.2.0',
            commit: 'a1b2',
            severity: 'critical',
            notes: 'n',
            downloadUrl: null,
            releasedAt: '2026-11-10T09:00:00.000Z',
            isDeleted: false,
          },
          expect.objectContaining({ build: 119, severity: 'normal', isDeleted: true }),
        ],
      },
    });
  });

  it('an empty list is valid', () => {
    expect(parseReleaseList({ releases: [] }, '/r.json')).toMatchObject({
      ok: true,
      list: { releases: [] },
    });
  });

  it.each([
    ['no releases array', {}, 'releases is missing or not an array'],
    ['an unknown top key', { releases: [], x: 1 }, 'unknown key(s) x'],
    ['a bad platform', { releases: [release({ platform: 'tv' })] }, 'releases[0]: platform'],
    ['a zero build', { releases: [release({ build: 0 })] }, 'releases[0]: build'],
    ['no version', { releases: [release({ version: ' ' })] }, 'releases[0]: version'],
    ['a bad severity', { releases: [release({ severity: 'urgent' })] }, 'severity must be'],
    ['no releasedAt', { releases: [release({ releasedAt: undefined })] }, 'releasedAt'],
    ['a string isDeleted', { releases: [release({ isDeleted: 'yes' })] }, 'isDeleted'],
    ['a long commit', { releases: [release({ commit: 'x'.repeat(41) })] }, 'commit must be'],
    ['a duplicate', { releases: [release(), release()] }, 'desktop build 120 is listed twice'],
  ])('rejects the whole file on %s', (_label, value, reason) => {
    const result = parseReleaseList(value, '/r.json');
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toContain(reason);
  });
});
