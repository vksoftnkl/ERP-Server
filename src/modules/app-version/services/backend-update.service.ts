import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { MAX_CLIENT_BUILD } from '../../../common/client-info/client-info';
import { RedisCacheService } from '../../../common/redis/redis-cache.service';
import { AUTH_SESSION_KEY_PREFIX } from '../../auth/auth-session.service';
import { backendBuild, type BackendBuild } from '../../health/backend-build';
import { STATE_REFRESH_INTERVAL_MS, SYSTEM_UPDATE_ACTOR } from '../app-version.constants';
import { loadCompatManifest, type CompatManifest } from '../compat/compat-manifest';
import { AppVersionStateStore, type BackendUpdateOutcome } from './app-version-state.store';
import { AuthEpochService } from './auth-epoch.service';
import { BuildPolicyService } from './build-policy.service';

/**
 * Part B Step 2 Rev 2 §5.1: what the backend does when it starts.
 *
 *   1. Read APP_BUILD and the bundled compat manifest. Either one missing or
 *      invalid: change nothing, log a warning, go on (no logout, policy as is).
 *   2. In one transaction under an advisory lock (so of two API processes only
 *      the first does it): if APP_BUILD is not the build stored in
 *      app_auth_state, raise the token epoch by one, store the build, and write
 *      the manifest into app_build_policy (rows set by hand stay as they are).
 *   3. After a raise, best effort and still under the lock: close the open
 *      audit.user_login_sessions rows and drop the Redis sessions. The `ep`
 *      claim already refuses the old tokens; this only tidies what is stored
 *      about them. Under the lock, so it cannot catch a login made on a second
 *      process (that process is still waiting on the lock, port closed).
 *   4. Load the epoch and the policies into memory, and re-read both every
 *      STATE_REFRESH_INTERVAL_MS.
 *
 * Runs in onApplicationBootstrap, which Nest finishes before the HTTP port
 * opens, so no request meets a stale epoch or policy. A failure in any step is
 * logged and the boot goes on: the API then answers with the last known state
 * (epoch 0 and no enforcement on a fresh process). A failed step 2 (database
 * busy, lock wait too long, migration not yet run) is retried with every
 * re-read until it goes through.
 *
 * Skipped under NODE_ENV=test: e2e suites boot the whole AppModule against the
 * live dev database, and a test run must never log the dev users out.
 */
@Injectable()
export class BackendUpdateService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('BackendUpdate');
  private timer: NodeJS.Timeout | null = null;
  private manifest: CompatManifest | null = null;
  /** Set when step 2 failed: the timer retries it with these arguments. */
  private retry: { build: BackendBuild; env: NodeJS.ProcessEnv } | null = null;
  private ticking = false;

  constructor(
    private readonly store: AppVersionStateStore,
    private readonly epoch: AuthEpochService,
    private readonly policies: BuildPolicyService,
    private readonly redis: RedisCacheService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      this.logger.log(
        'NODE_ENV=test: backend update step skipped (a test run never logs users out)',
      );
    } else {
      await this.runStartupCheck();
    }
    await this.refresh();
    this.timer = setInterval(() => {
      void this.tick();
    }, STATE_REFRESH_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** The valid compat manifest this process started with, or null. */
  bundledManifest(): CompatManifest | null {
    return this.manifest;
  }

  /** Steps 1-3. Returns null when nothing was attempted or it failed. */
  async runStartupCheck(
    build: BackendBuild = backendBuild(),
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<BackendUpdateOutcome | null> {
    if (build.build === null) {
      this.logger.warn(
        'APP_BUILD is not set: no logout after an update, and the build policy is left as it is',
      );
      return null;
    }
    if (build.build < 1 || build.build > MAX_CLIENT_BUILD) {
      this.logger.warn(
        `APP_BUILD ${build.build} is not a build number 1..${MAX_CLIENT_BUILD}: no logout after ` +
          'an update, and the build policy is left as it is',
      );
      return null;
    }
    const loaded = loadCompatManifest(build.build, env);
    if (!loaded.ok) {
      this.logger.warn(
        `Compat manifest${loaded.path ? ` ${loaded.path}` : ''} not used (${loaded.reason}): ` +
          `no logout after an update, and the build policy is left as it is`,
      );
      return null;
    }
    this.manifest = loaded.manifest;
    let outcome: BackendUpdateOutcome;
    try {
      outcome = await this.store.applyBackendUpdate(
        {
          build: build.build,
          version: build.version,
          commit: build.commit,
          manifest: loaded.manifest,
          actor: SYSTEM_UPDATE_ACTOR,
        },
        () => this.tidySessions(),
      );
    } catch (error: unknown) {
      if (!this.retry) {
        this.logger.error(
          `Could not run the backend update step for build ${build.build}; retrying every ` +
            `${STATE_REFRESH_INTERVAL_MS / 1000} s: ${describe(error)}`,
        );
      }
      this.retry = { build, env };
      return null;
    }
    if (this.retry) {
      this.retry = null;
      this.logger.log(`Backend update step for build ${build.build} went through on a retry`);
    }
    this.epoch.set(outcome.epoch);
    if (!outcome.bumped) {
      this.logger.log(`Build ${build.build} unchanged: token epoch ${outcome.epoch}, no logout`);
      return outcome;
    }
    this.logger.warn(
      `Backend build ${outcome.previousBuild ?? 'none'} -> ${build.build}: token epoch raised to ` +
        `${outcome.epoch}, every user must log in again. Build policy from ${loaded.manifest.path}: ` +
        `written ${outcome.policiesWritten.join(', ') || 'none'}` +
        (outcome.policiesKeptManual.length
          ? `; kept (manual) ${outcome.policiesKeptManual.join(', ')}`
          : ''),
    );
    return outcome;
  }

  /** The timer: retry a failed step 2 first, then re-read the caches. */
  private async tick(): Promise<void> {
    if (this.ticking) {
      return; // a slow retry is still running; never stack them
    }
    this.ticking = true;
    try {
      if (this.retry) {
        await this.runStartupCheck(this.retry.build, this.retry.env);
      }
      await this.refresh();
    } finally {
      this.ticking = false;
    }
  }

  private async refresh(): Promise<void> {
    await Promise.all([this.epoch.reload(), this.policies.reload()]);
  }

  private async tidySessions(): Promise<void> {
    try {
      const closed = await this.store.closeOpenLoginSessions(SYSTEM_UPDATE_ACTOR);
      this.logger.log(`Closed ${closed} open login session row(s)`);
    } catch (error: unknown) {
      this.logger.warn(`Could not close the open login session rows: ${describe(error)}`);
    }
    if (!this.redis.isEnabled()) {
      return;
    }
    try {
      const keys = await this.redis.keys(`${AUTH_SESSION_KEY_PREFIX}:*`);
      let removed = 0;
      for (let start = 0; start < keys.length; start += REDIS_DELETE_CHUNK) {
        removed += await this.redis.delMany(keys.slice(start, start + REDIS_DELETE_CHUNK));
      }
      this.logger.log(`Dropped ${removed} Redis session(s)`);
    } catch (error: unknown) {
      this.logger.warn(`Could not drop the Redis sessions: ${describe(error)}`);
    }
  }
}

/** Redis sessions are dropped this many keys per DEL. */
const REDIS_DELETE_CHUNK = 500;

function describe(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
}
