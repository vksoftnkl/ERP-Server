import { Logger } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RedisCacheService } from '../../../common/redis/redis-cache.service';
import type { BackendBuild } from '../../health/backend-build';
import type { AppVersionStateStore, BackendUpdateOutcome } from './app-version-state.store';
import { AuthEpochService } from './auth-epoch.service';
import { BackendUpdateService } from './backend-update.service';
import { BuildPolicyService } from './build-policy.service';

const BUILD_57: BackendBuild = { version: '1.2.0', build: 57, commit: 'aa10be0d' };

describe('BackendUpdateService startup step (Part B Step 2 Rev 2 §5.1)', () => {
  let dir: string;
  let manifestPath: string;
  let env: NodeJS.ProcessEnv;
  let store: {
    applyBackendUpdate: jest.Mock;
    closeOpenLoginSessions: jest.Mock;
    readEpoch: jest.Mock;
    readPolicies: jest.Mock;
  };
  let redis: { isEnabled: jest.Mock; keys: jest.Mock; delMany: jest.Mock };
  let epoch: AuthEpochService;
  let service: BackendUpdateService;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  const bumped = (overrides: Partial<BackendUpdateOutcome> = {}): BackendUpdateOutcome => ({
    bumped: true,
    epoch: 2,
    previousBuild: 56,
    policiesWritten: ['web', 'desktop', 'mobile'],
    policiesKeptManual: [],
    ...overrides,
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backend-update-'));
    manifestPath = join(dir, 'compat-manifest.json');
    writeFileSync(
      manifestPath,
      JSON.stringify({
        backendBuild: 57,
        clients: { desktop: { expectedBuild: 120, enforce: true } },
      }),
    );
    env = { APP_COMPAT_MANIFEST: manifestPath };
    store = {
      // Like the real store: after a raise, run the tidy callback under the lock.
      applyBackendUpdate: jest.fn(
        async (_input: unknown, whileLocked?: (o: BackendUpdateOutcome) => Promise<void>) => {
          const outcome = bumped();
          await whileLocked?.(outcome);
          return outcome;
        },
      ),
      closeOpenLoginSessions: jest.fn().mockResolvedValue(7),
      readEpoch: jest.fn().mockResolvedValue(2),
      readPolicies: jest.fn().mockResolvedValue([]),
    };
    redis = {
      isEnabled: jest.fn().mockReturnValue(true),
      keys: jest.fn().mockResolvedValue(['auth:session:a', 'auth:session:b']),
      delMany: jest.fn().mockResolvedValue(2),
    };
    const typedStore = store as unknown as AppVersionStateStore;
    epoch = new AuthEpochService(typedStore);
    service = new BackendUpdateService(
      typedStore,
      epoch,
      new BuildPolicyService(typedStore),
      redis as unknown as RedisCacheService,
    );
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('no APP_BUILD: nothing is attempted, a warning is logged (test 15)', async () => {
    await expect(service.runStartupCheck({ ...BUILD_57, build: null }, env)).resolves.toBeNull();
    expect(store.applyBackendUpdate).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('APP_BUILD is not set'));
  });

  it('no manifest, or an invalid one: nothing is attempted, a warning is logged (test 15)', async () => {
    rmSync(manifestPath);
    await expect(service.runStartupCheck(BUILD_57, env)).resolves.toBeNull();
    writeFileSync(manifestPath, JSON.stringify({ backendBuild: 56, clients: {} }));
    await expect(service.runStartupCheck(BUILD_57, env)).resolves.toBeNull();
    expect(store.applyBackendUpdate).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(service.bundledManifest()).toBeNull();
  });

  it('a new build: one store call with the manifest, then the epoch is live and sessions are tidied (test 13)', async () => {
    const outcome = await service.runStartupCheck(BUILD_57, env);
    expect(outcome).toMatchObject({ bumped: true, epoch: 2 });
    expect(store.applyBackendUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        build: 57,
        version: '1.2.0',
        commit: 'aa10be0d',
        actor: 'system-update',
        manifest: expect.objectContaining({
          path: manifestPath,
          clients: expect.objectContaining({
            desktop: { expectedBuild: 120, enforce: true, message: null, downloadUrl: null },
          }),
        }),
      }),
      expect.any(Function),
    );
    expect(epoch.current()).toBe(2);
    expect(store.closeOpenLoginSessions).toHaveBeenCalledWith('system-update');
    expect(redis.delMany).toHaveBeenCalledWith(['auth:session:a', 'auth:session:b']);
    expect(service.bundledManifest()).not.toBeNull();
  });

  it('the same build: no logout, nothing tidied (test 12)', async () => {
    store.applyBackendUpdate.mockResolvedValue(
      bumped({ bumped: false, previousBuild: 57, policiesWritten: [] }),
    );
    await service.runStartupCheck(BUILD_57, env);
    expect(store.closeOpenLoginSessions).not.toHaveBeenCalled();
    expect(redis.keys).not.toHaveBeenCalled();
    expect(epoch.current()).toBe(2);
  });

  it('an APP_BUILD that is not 1..int4 max is refused up front, with a warning', async () => {
    for (const build of [0, 202611111030]) {
      await expect(service.runStartupCheck({ ...BUILD_57, build }, env)).resolves.toBeNull();
    }
    expect(store.applyBackendUpdate).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('is not a build number'));
  });

  it('a failed transaction is logged once and retried by the timer until it goes through', async () => {
    store.applyBackendUpdate.mockRejectedValueOnce(
      new Error('relation "app_auth_state" does not exist'),
    );
    await expect(service.runStartupCheck(BUILD_57, env)).resolves.toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('retrying every 30 s'));
    expect(epoch.current()).toBe(0);
    jest.useFakeTimers();
    try {
      store.applyBackendUpdate.mockRejectedValueOnce(new Error('still down'));
      await service.onApplicationBootstrap(); // NODE_ENV=test: no new attempt here
      expect(store.applyBackendUpdate).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(30_000); // retry 1 fails, logged no more
      expect(store.applyBackendUpdate).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(30_000); // retry 2 goes through
      expect(store.applyBackendUpdate).toHaveBeenCalledTimes(3);
      expect(store.closeOpenLoginSessions).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(30_000); // nothing left to retry
      expect(store.applyBackendUpdate).toHaveBeenCalledTimes(3);
      service.onModuleDestroy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('tidying is best effort: a failure there neither throws nor undoes the raise', async () => {
    store.closeOpenLoginSessions.mockRejectedValue(new Error('lock timeout'));
    redis.keys.mockRejectedValue(new Error('redis down'));
    await expect(service.runStartupCheck(BUILD_57, env)).resolves.toMatchObject({ bumped: true });
    expect(epoch.current()).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('token epoch raised to 2'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not close the open login'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not drop the Redis sessions'));
  });

  it('onApplicationBootstrap (NODE_ENV=test) skips the update step, loads both caches, re-reads', async () => {
    jest.useFakeTimers();
    try {
      await service.onApplicationBootstrap();
      expect(store.applyBackendUpdate).not.toHaveBeenCalled();
      expect(store.readEpoch).toHaveBeenCalledTimes(1);
      expect(store.readPolicies).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(30_000);
      expect(store.readEpoch).toHaveBeenCalledTimes(2);
      service.onModuleDestroy();
    } finally {
      jest.useRealTimers();
    }
  });
});
