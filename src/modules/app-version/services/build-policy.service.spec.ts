import { BadRequestException, ConflictException, HttpException, Logger } from '@nestjs/common';
import type { CompatManifest } from '../compat/compat-manifest';
import type {
  AppVersionStateStore,
  BuildPolicy,
  BuildPolicyValues,
} from './app-version-state.store';
import { BuildPolicyService } from './build-policy.service';

const policy = (overrides: Partial<BuildPolicy>): BuildPolicy => ({
  platform: 'desktop',
  enforce: true,
  expectedBuild: 12,
  message: null,
  downloadUrl: null,
  source: 'manifest',
  changedOn: null,
  changedBy: null,
  ...overrides,
});

describe('BuildPolicyService (Part B Step 2 Rev 2)', () => {
  let store: { readPolicies: jest.Mock; writePolicy: jest.Mock };
  let service: BuildPolicyService;
  let stored: Map<string, BuildPolicy>;

  beforeEach(() => {
    stored = new Map();
    store = {
      readPolicies: jest.fn(async () => [...stored.values()]),
      // Runs `change` the way the real store does, then "saves" the result.
      writePolicy: jest.fn(
        async (
          platform: BuildPolicy['platform'],
          source: BuildPolicy['source'] | null,
          actor: string,
          change: (current: BuildPolicy | null) => BuildPolicyValues,
        ) => {
          const current = stored.get(platform) ?? null;
          const saved = policy({
            ...change(current),
            platform,
            // null = keep the row's source (Step 4: an enforce-only change)
            source: source ?? current?.source ?? 'manifest',
            changedBy: actor,
          });
          stored.set(platform, saved);
          return saved;
        },
      ),
    };
    service = new BuildPolicyService(store as unknown as AppVersionStateStore);
  });

  const load = async (...rows: BuildPolicy[]) => {
    rows.forEach((row) => stored.set(row.platform, row));
    await service.reload();
  };
  const outcome = (platform: BuildPolicy['platform'] | null, build: number | null) => {
    try {
      service.assertClientBuild(platform, build);
      return 'ok';
    } catch (error: unknown) {
      return error instanceof HttpException ? error.getStatus() : 'other';
    }
  };

  it('nothing loaded, no row, or enforce false: every build passes', async () => {
    expect(outcome('desktop', null)).toBe('ok');
    await load(policy({ enforce: false }));
    expect(outcome('desktop', 3)).toBe('ok');
    expect(outcome('desktop', null)).toBe('ok');
    expect(outcome('web', null)).toBe('ok');
  });

  it('enforced: only the exact build passes; missing, older and newer are 426', async () => {
    await load(policy({}));
    expect(outcome('desktop', 12)).toBe('ok');
    expect(outcome('desktop', 10)).toBe(426);
    expect(outcome('desktop', 13)).toBe(426);
    expect(outcome('desktop', null)).toBe(426);
    // other platforms and an unknown platform are not touched
    expect(outcome('web', 1)).toBe('ok');
    expect(outcome(null, null)).toBe('ok');
  });

  it('lists all three platforms, defaults for a missing row', async () => {
    await load(policy({}));
    expect(service.list().map((row) => [row.platform, row.enforce, row.expectedBuild])).toEqual([
      ['web', false, null],
      ['desktop', true, 12],
      ['mobile', false, null],
    ]);
  });

  it('PATCH changes only the fields sent and applies at once; enforce alone keeps the source (Step 4)', async () => {
    await load(policy({ message: 'keep me' }));
    const saved = await service.update('desktop', { enforce: false }, 'user-1');
    expect(saved).toMatchObject({
      enforce: false,
      expectedBuild: 12,
      message: 'keep me',
      // still the manifest's: later backend updates keep refreshing its build
      source: 'manifest',
      changedBy: 'user-1',
    });
    // the emergency switch works without waiting for a reload
    expect(outcome('desktop', 10)).toBe('ok');
    await service.update('desktop', { message: null, expectedBuild: 15, enforce: true }, 'user-1');
    // a hand-set build / message / link makes the row manual
    expect(service.get('desktop')).toMatchObject({
      message: null,
      expectedBuild: 15,
      source: 'manual',
    });
    expect(outcome('desktop', 15)).toBe('ok');
  });

  it('refuses enforce = true with no expected build (400 APP_POLICY_BUILD_REQUIRED)', async () => {
    await expect(service.update('web', { enforce: true }, 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await load(policy({}));
    await expect(
      service.update('desktop', { expectedBuild: null }, 'user-1'),
    ).rejects.toMatchObject({
      response: { errors: [{ code: 'APP_POLICY_BUILD_REQUIRED' }] },
    });
  });

  it('use-manifest writes the bundled values back as source manifest, keeps enforce; no manifest is 409', async () => {
    await load(
      policy({ source: 'manual', enforce: true, expectedBuild: 12, downloadUrl: 'https://old' }),
    );
    const none = { expectedBuild: null, message: null, downloadUrl: null };
    const manifest = {
      path: '/c.json',
      backendBuild: 57,
      clients: {
        web: none,
        desktop: { expectedBuild: 20, message: 'Update', downloadUrl: null },
        mobile: none,
      },
    } as CompatManifest;
    await expect(service.useManifest('desktop', manifest, 'user-1')).resolves.toMatchObject({
      source: 'manifest',
      enforce: true, // never touched by the manifest (Step 4)
      expectedBuild: 20,
      message: 'Update',
      downloadUrl: 'https://old', // the manifest named none: the stored one stays
    });
    await expect(service.useManifest('desktop', null, 'user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('a failed read keeps the last copy and never throws', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await load(policy({}));
    store.readPolicies.mockRejectedValue(new Error('relation "app_build_policy" does not exist'));
    await expect(service.reload()).resolves.toBeUndefined();
    expect(outcome('desktop', 10)).toBe(426);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('a timed read that started before an admin change cannot undo it in memory', async () => {
    await load(policy({}));
    let release!: (rows: BuildPolicy[]) => void;
    store.readPolicies.mockImplementationOnce(
      () => new Promise<BuildPolicy[]>((resolve) => (release = resolve)),
    );
    const slowRead = service.reload(); // reads the old row (enforce true)...
    await service.update('desktop', { enforce: false }, 'user-1'); // ...the switch lands
    release([policy({})]); // ...then the stale answer arrives
    await slowRead;
    expect(outcome('desktop', 10)).toBe('ok');
  });
});
